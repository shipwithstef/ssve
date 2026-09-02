import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getObject, putObject } from "./review-evidence-store.mjs";
import { acquireLock } from "../state-lock.mjs";
import { familyOf } from "./cognitive-family.mjs";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=(bytes)=>crypto.createHash("sha256").update(bytes).digest("hex");
const canonical=(value)=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`:value&&typeof value==="object"?`{${Object.keys(value).sort().map((key)=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`:JSON.stringify(value);

function secureDirectory(directory,label,{create=false}={}){
  const lexical=path.resolve(directory);if(create)fs.mkdirSync(lexical,{recursive:true,mode:0o700});const stat=fs.lstatSync(lexical);
  if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync(lexical)!==lexical||(stat.mode&0o022)!==0||(typeof process.getuid==="function"&&stat.uid!==process.getuid()))throw new Error(`${label} is insecure or foreign-owned`);return lexical;
}
function secureFile(file,label){const lexical=path.resolve(file),stat=fs.lstatSync(lexical);if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(lexical)!==lexical||(stat.mode&0o022)!==0||(typeof process.getuid==="function"&&stat.uid!==process.getuid()))throw new Error(`${label} is insecure or foreign-owned`);return fs.readFileSync(lexical);}
export function externalReviewProvenanceRoot({receiptPath=null}={}){
  const configured=process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT;
  if(configured&&process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE!=="1")throw new Error("SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT is fixture-only");
  if(configured)return path.resolve(configured);
  if(receiptPath){
    const resolved=path.resolve(receiptPath);
    const svcMarker=path.join(".svc","external-review-artifacts");
    const idx=resolved.indexOf(svcMarker);
    if(idx!==-1){
      const fixtureRoot=path.join(resolved.slice(0,idx),".svc","external-review-authority-fixture");
      if(fs.existsSync(fixtureRoot))return fixtureRoot;
    }
  }
  return path.resolve(path.join(os.homedir(),".svc","external-review-authority-v1"));
}
function authorityKey(root,{create=false}={}){
  const directory=secureDirectory(root,"external review authority root",{create:create||!fs.existsSync(root)});const file=path.join(directory,"authority.key");
  if(!fs.existsSync(file)){if(!create)throw new Error("external review authority key is missing");const fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);try{fs.writeFileSync(fd,crypto.randomBytes(32));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
  return secureFile(file,"external review authority key");
}
export function candidateTreeIdentity(repository,{candidateSha=null,treeHash=null}={}){
  const repo=fs.realpathSync(path.resolve(repository));let tree=treeHash;
  if(treeHash){
    if(!/^[0-9a-f]{40}$/.test(treeHash)) throw new Error("candidate tree identity is invalid");
    try {
      const type=execFileSync("git",["-C",repo,"cat-file","-t",treeHash],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
      if(type!=="tree") throw new Error();
    } catch { throw new Error(`candidate tree object ${treeHash} does not exist in repository`); }
  } else if(candidateSha){
    try { tree=execFileSync("git",["-C",repo,"rev-parse",`${candidateSha}^{tree}`],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim(); }
    catch { throw new Error(`candidate commit ${candidateSha} does not exist in repository`); }
  }
  if(!tree)tree=execFileSync("git",["-C",repo,"write-tree"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
  if(!/^[0-9a-f]{40}$/.test(tree))throw new Error("candidate tree identity is invalid");
  return {tree_hash:tree,candidate_digest:sha(Buffer.from(`git-tree:${tree}\n`))};
}
export function externalReviewCycleId({wi,reviewKind,candidateDigest=null,preExecutionBase=null,overrideSha=null}){
  if(!String(wi||"").trim())throw new Error("external review cycle WI is missing");
  if(!["plan","exec","design"].includes(reviewKind))throw new Error("external review cycle kind is invalid");
  if(reviewKind==="plan"&&!/^[0-9a-f]{40}$/.test(String(preExecutionBase||"")))throw new Error("plan review cycle requires a pre-execution base");
  if(reviewKind!=="plan"&&!/^[0-9a-f]{64}$/.test(String(candidateDigest||"")))throw new Error("non-plan external review cycle requires a candidate digest");
  if(overrideSha!==null&&!/^[0-9a-f]{64}$/.test(String(overrideSha)))throw new Error("plan review cycle override digest is invalid");
  const subject=reviewKind==="plan"?`${preExecutionBase}:${overrideSha||"no-override"}`:candidateDigest;
  return sha(Buffer.from(`external-review-cycle:v1:${reviewKind}:${wi}:${subject}`));
}
export function externalReviewCycleIdFromReceipt(receipt){
  const guard=receipt?.phase_guard||{};
  return externalReviewCycleId({wi:guard.wi,reviewKind:receipt?.review_kind,candidateDigest:receipt?.candidate_digest,preExecutionBase:guard.pre_execution_base,overrideSha:guard.override?.actual_sha256||null});
}
function markerReceiptBytes(payload,label){
  if(!/^[0-9a-f]{64}$/.test(String(payload.receipt_sha256||"")))return null;
  try{const bytes=secureFile(payload.receipt_path,label);if(sha(bytes)===payload.receipt_sha256)return bytes;}catch{}
  try{const bytes=getObject(payload.receipt_sha256,{start:process.cwd()}).bytes;return sha(bytes)===payload.receipt_sha256?bytes:null;}catch{return null;}
}
function reviewAuthority(receipt){
  const author=familyOf(receipt?.effective_tuple?.orchestrator);
  const reviewer=familyOf(receipt?.effective_tuple?.family||receipt?.effective_tuple?.host);
  return author!=="unknown"&&reviewer!=="unknown"&&author!==reviewer?"independent":"advisory";
}
function receiptClassification(receipt){
  const wi=String(receipt?.phase_guard?.wi||"").trim()||null;
  return {review_kind:receipt?.review_kind||null,wi,review_cycle_id:wi?externalReviewCycleIdFromReceipt(receipt):null,review_authority:reviewAuthority(receipt),candidate_digest:receipt?.candidate_digest||null};
}
function classificationFile(directory,requestId){return path.join(directory,`${requestId}.json`);}
function readClassification(directory,requestId,key){
  const file=classificationFile(directory,requestId);if(!fs.existsSync(file))return null;
  const marker=JSON.parse(secureFile(file,"external review cycle classification"));const {authority_hmac_sha256,...payload}=marker;const expected=crypto.createHmac("sha256",key).update(canonical(payload)).digest("hex");
  if(typeof authority_hmac_sha256!=="string"||!/^[0-9a-f]{64}$/.test(authority_hmac_sha256)||!crypto.timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(authority_hmac_sha256,"hex")))throw new Error(`external review classification HMAC mismatch: ${requestId}`);
  if(payload.schema_version!==1||payload.request_id!==requestId)throw new Error(`external review classification identity mismatch: ${requestId}`);return payload;
}
function mergeClassification(marker,indexed){
  if(!indexed)return {...marker};
  for(const key of ["request_id","candidate_digest","review_kind","wi","review_cycle_id","review_authority"]){
    if(marker[key]!==undefined&&canonical(marker[key])!==canonical(indexed[key]))throw new Error(`external review classification conflicts with issuance marker: ${marker.request_id}`);
  }
  return {...marker,...indexed};
}
function writeClassification(directory,payload,key){
  const body={schema_version:1,request_id:payload.request_id,candidate_digest:payload.candidate_digest,review_kind:payload.review_kind,wi:payload.wi,review_cycle_id:payload.review_cycle_id,review_authority:payload.review_authority};
  const record={...body,authority_hmac_sha256:crypto.createHmac("sha256",key).update(canonical(body)).digest("hex")};const file=classificationFile(directory,body.request_id);
  if(fs.existsSync(file)){const existing=readClassification(directory,body.request_id,key);if(canonical(existing)!==canonical(body))throw new Error(`external review classification conflict: ${body.request_id}`);return existing;}
  const fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);try{fs.writeFileSync(fd,`${JSON.stringify(record,null,2)}\n`);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return body;
}
export function issueExternalReviewProvenance({receiptPath,packagePath,findingsPath}){
  const receiptBytes=secureFile(receiptPath,"external review receipt");const receipt=JSON.parse(receiptBytes);if(!UUID.test(String(receipt.request_id||"")))throw new Error("external review request id must be a UUID");
  const immutableReceipt=putObject(receiptBytes);if(immutableReceipt.sha256!==sha(receiptBytes))throw new Error("external review receipt object digest mismatch");
  const packageBytes=secureFile(packagePath,"external review package");const findingsBytes=secureFile(findingsPath,"external review findings");
  const root=externalReviewProvenanceRoot({receiptPath}),key=authorityKey(root,{create:true}),issuance=secureDirectory(path.join(root,"issuance"),"external review issuance directory",{create:true}),classifications=secureDirectory(path.join(root,"classifications"),"external review classification directory",{create:true});
  const release=acquireLock(path.join(root,"issuance-sequence"),{staleMs:60_000});
  try{
  const wi=String(receipt.phase_guard?.wi||"").trim()||null;
  const reviewCycleId=wi?externalReviewCycleIdFromReceipt(receipt):null;
  const currentAuthority=reviewAuthority(receipt);
  let matchingLegacy=0, maxSequence=0;
  if(currentAuthority==="independent")for(const name of fs.readdirSync(issuance)){
    if(!name.endsWith(".json"))continue;
    const marker=JSON.parse(secureFile(path.join(issuance,name),"external review issuance marker"));const {authority_hmac_sha256,...prior}=marker;const expected=crypto.createHmac("sha256",key).update(canonical(prior)).digest("hex");
    if(typeof authority_hmac_sha256!=="string"||!/^[0-9a-f]{64}$/.test(authority_hmac_sha256)||!crypto.timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(authority_hmac_sha256,"hex")))throw new Error(`external review issuance HMAC mismatch: ${name}`);
    const indexed=readClassification(classifications,prior.request_id,key);const known=mergeClassification(prior,indexed);
    if(!reviewCycleId&&known.candidate_digest!==receipt.candidate_digest)continue;
    if(reviewCycleId&&known.review_cycle_id&&known.review_cycle_id!==reviewCycleId)continue;
    if(known.review_kind&&known.review_kind!==receipt.review_kind)continue;
    if(known.wi&&known.wi!==wi)continue;
    let priorKind=known.review_kind;
    let priorReceipt=null;
    if(!priorKind||!known.wi||!known.review_cycle_id||!known.review_authority){const priorBytes=markerReceiptBytes(prior,"legacy external review inventory receipt");if(!priorBytes){const related=(known.review_kind===receipt.review_kind&&known.wi===wi)||known.candidate_digest===receipt.candidate_digest;if(related)throw new Error(`external review legacy receipt is unavailable or digest-mismatched: ${prior.request_id}`);continue;}try{priorReceipt=JSON.parse(priorBytes);const derived=writeClassification(classifications,{request_id:prior.request_id,...receiptClassification(priorReceipt)},key);Object.assign(known,mergeClassification(prior,derived));priorKind=known.review_kind;}catch(error){if(/classification conflict/.test(error.message))throw error;throw new Error(`external review legacy receipt is invalid: ${prior.request_id}`);}}
    if(priorKind!==receipt.review_kind)continue;
    if(known.review_authority!=="independent")continue;
    if(reviewCycleId){
      const priorWi=String(known.wi||"").trim();
      const priorCycle=known.review_cycle_id||null;
      if(priorCycle!==reviewCycleId)continue;
    }else if(prior.candidate_digest!==receipt.candidate_digest)continue;
    matchingLegacy+=1;if(Number.isInteger(prior.cycle_sequence))maxSequence=Math.max(maxSequence,prior.cycle_sequence);
  }
  const cycleSequence=Math.max(matchingLegacy,maxSequence)+1;
  if(reviewCycleId&&cycleSequence>3)throw new Error(`external review cycle hard cap reached for ${receipt.review_kind}/${wi}`);
  const payload={schema_version:1,request_id:receipt.request_id,candidate_digest:receipt.candidate_digest,review_kind:receipt.review_kind,wi,review_cycle_id:reviewCycleId,review_authority:currentAuthority,cycle_sequence:currentAuthority==="independent"?cycleSequence:null,package_sha256:sha(packageBytes),findings_sha256:sha(findingsBytes),receipt_sha256:sha(receiptBytes),receipt_path:fs.realpathSync(receiptPath),package_path:fs.realpathSync(packagePath),findings_path:fs.realpathSync(findingsPath),launcher_version:receipt.launcher_version,effective_tuple:receipt.effective_tuple,issued_at:new Date().toISOString()};
  const marker={...payload,authority_hmac_sha256:crypto.createHmac("sha256",key).update(canonical(payload)).digest("hex")};const file=path.join(issuance,`${receipt.request_id}.json`);const fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);try{fs.writeFileSync(fd,`${JSON.stringify(marker,null,2)}\n`);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}writeClassification(classifications,payload,key);return file;
  }finally{release();}
}
function bytesOrFile(fileOrBytes, label, explicitBytes) {
  if (Buffer.isBuffer(explicitBytes)) return explicitBytes;
  if (fileOrBytes && Buffer.isBuffer(fileOrBytes.bytes)) return fileOrBytes.bytes;
  if (typeof fileOrBytes === "string") return secureFile(fileOrBytes, label);
  throw new Error(`${label} bytes are missing`);
}

export function verifyExternalReviewProvenance({receiptPath,packagePath,findingsPath,receiptBytes=null,packageBytes=null,findingsBytes=null}){
  const resolvedReceiptBytes=bytesOrFile(receiptPath,"external review receipt",receiptBytes);
  const receipt=JSON.parse(resolvedReceiptBytes);if(!UUID.test(String(receipt.request_id||"")))throw new Error("external review request id must be a UUID");
  const resolvedPackageBytes=bytesOrFile(packagePath,"external review package",packageBytes);
  const resolvedFindingsBytes=bytesOrFile(findingsPath,"external review findings",findingsBytes);
  const provenanceHint=typeof receiptPath==="string"?receiptPath:null;
  const root=externalReviewProvenanceRoot({receiptPath:provenanceHint}),key=authorityKey(root),file=path.join(secureDirectory(path.join(root,"issuance"),"external review issuance directory"),`${receipt.request_id}.json`);const marker=JSON.parse(secureFile(file,"external review issuance marker"));
  const {authority_hmac_sha256,...payload}=marker;const expected=crypto.createHmac("sha256",key).update(canonical(payload)).digest("hex");if(typeof authority_hmac_sha256!=="string"||!crypto.timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(authority_hmac_sha256,"hex")))throw new Error("external review issuance HMAC mismatch");
  const wanted={request_id:receipt.request_id,candidate_digest:receipt.candidate_digest,package_sha256:sha(resolvedPackageBytes),findings_sha256:sha(resolvedFindingsBytes),receipt_sha256:sha(resolvedReceiptBytes),launcher_version:receipt.launcher_version,effective_tuple:receipt.effective_tuple};
  for(const [keyName,value]of Object.entries(wanted))if(canonical(payload[keyName])!==canonical(value))throw new Error(`external review issuance mismatch: ${keyName}`);
  const hashesMatch=payload.receipt_sha256===wanted.receipt_sha256&&payload.package_sha256===wanted.package_sha256&&payload.findings_sha256===wanted.findings_sha256;
  if(!hashesMatch)throw new Error("external review issuance content hashes do not match relocated bytes");
  return marker;
}

export function listExternalReviewProvenance({receiptPath,candidateDigest,reviewKind}){
  if(!/^[0-9a-f]{64}$/.test(String(candidateDigest||"")))throw new Error("external review inventory candidate digest is invalid");
  if(!["plan","exec","design"].includes(reviewKind))throw new Error("external review inventory kind is invalid");
  const root=externalReviewProvenanceRoot({receiptPath}),key=authorityKey(root),issuance=secureDirectory(path.join(root,"issuance"),"external review issuance directory"),classifications=secureDirectory(path.join(root,"classifications"),"external review classification directory",{create:true});
  const rows=[];
  for(const name of fs.readdirSync(issuance).sort()){
    if(!name.endsWith(".json"))continue;
    const marker=JSON.parse(secureFile(path.join(issuance,name),"external review issuance marker"));
    const {authority_hmac_sha256,...payload}=marker;
    const expected=crypto.createHmac("sha256",key).update(canonical(payload)).digest("hex");
    if(typeof authority_hmac_sha256!=="string"||!/^[0-9a-f]{64}$/.test(authority_hmac_sha256)||!crypto.timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(authority_hmac_sha256,"hex")))throw new Error(`external review issuance HMAC mismatch: ${name}`);
    if(payload.candidate_digest!==candidateDigest)continue;
    const receiptBytes=secureFile(payload.receipt_path,`external review inventory receipt ${payload.request_id}`);
    if(sha(receiptBytes)!==payload.receipt_sha256)throw new Error(`external review inventory receipt digest mismatch: ${payload.request_id}`);
    const receipt=JSON.parse(receiptBytes);
    if(receipt.request_id!==payload.request_id||receipt.candidate_digest!==candidateDigest)throw new Error(`external review inventory receipt identity mismatch: ${payload.request_id}`);
    if(receipt.review_kind!==reviewKind)continue;
    rows.push({request_id:payload.request_id,receipt_sha256:payload.receipt_sha256,issued_at:payload.issued_at,cycle_sequence:Number.isInteger(payload.cycle_sequence)?payload.cycle_sequence:null});
  }
  if(rows.every((row)=>row.cycle_sequence!==null)){
    rows.sort((left,right)=>left.cycle_sequence-right.cycle_sequence);
    if(rows.some((row,index)=>row.cycle_sequence!==index+1))throw new Error("external review issuance cycle sequence is non-contiguous or duplicated");
  }else rows.sort((left,right)=>String(left.issued_at).localeCompare(String(right.issued_at))||left.request_id.localeCompare(right.request_id));
  return rows;
}

export function listExternalReviewCycleProvenance({receiptPath,wi,reviewKind,cycleId,candidateDigests=[]}){
  if(!/^[0-9a-f]{64}$/.test(String(cycleId||"")))throw new Error("external review cycle identity is invalid");
  const root=externalReviewProvenanceRoot({receiptPath}),key=authorityKey(root),issuance=secureDirectory(path.join(root,"issuance"),"external review issuance directory"),classifications=secureDirectory(path.join(root,"classifications"),"external review classification directory",{create:true});
  const rows=[];const declaredDigests=new Set(candidateDigests);
  for(const name of fs.readdirSync(issuance).sort()){
    if(!name.endsWith(".json"))continue;
    const marker=JSON.parse(secureFile(path.join(issuance,name),"external review issuance marker"));
    const {authority_hmac_sha256,...payload}=marker;
    const expected=crypto.createHmac("sha256",key).update(canonical(payload)).digest("hex");
    if(typeof authority_hmac_sha256!=="string"||!/^[0-9a-f]{64}$/.test(authority_hmac_sha256)||!crypto.timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(authority_hmac_sha256,"hex")))throw new Error(`external review issuance HMAC mismatch: ${name}`);
    const indexed=readClassification(classifications,payload.request_id,key);const known=mergeClassification(payload,indexed);
    if(known.review_cycle_id&&known.review_cycle_id!==cycleId)continue;
    if(known.review_kind&&known.review_kind!==reviewKind)continue;
    if(known.wi&&known.wi!==wi)continue;
    if(known.review_authority==="advisory")continue;
    const receiptBytes=markerReceiptBytes(payload,`external review inventory receipt ${payload.request_id}`);
    if(!receiptBytes){const related=known.review_cycle_id===cycleId||(known.review_kind===reviewKind&&known.wi===wi)||declaredDigests.has(known.candidate_digest);if(related)throw new Error(`external review ${known.review_cycle_id?"cycle":"legacy"} receipt is unavailable or digest-mismatched: ${payload.request_id}`);continue;}
    const receipt=JSON.parse(receiptBytes);
    if(receipt.request_id!==payload.request_id||receipt.candidate_digest!==payload.candidate_digest)throw new Error(`external review inventory receipt identity mismatch: ${payload.request_id}`);
    if(!indexed&&(!known.review_kind||!known.wi||!known.review_cycle_id||!known.review_authority)){const derived=writeClassification(classifications,{request_id:payload.request_id,...receiptClassification(receipt)},key);Object.assign(known,mergeClassification(payload,derived));}
    const markerKind=known.review_kind||receipt.review_kind;
    const markerWi=String(known.wi||receipt.phase_guard?.wi||"").trim();
    if(markerKind!==reviewKind||markerWi!==wi)continue;
    if((known.review_authority||reviewAuthority(receipt))!=="independent")continue;
    let markerCycle=known.review_cycle_id||null;try{markerCycle||=externalReviewCycleIdFromReceipt(receipt);}catch{throw new Error(`external review legacy receipt cannot be classified: ${payload.request_id}`);}
    if(markerCycle!==cycleId)continue;
    rows.push({request_id:payload.request_id,receipt_sha256:payload.receipt_sha256,candidate_digest:payload.candidate_digest,issued_at:payload.issued_at,cycle_sequence:Number.isInteger(payload.cycle_sequence)?payload.cycle_sequence:null});
  }
  if(rows.length===0)return rows;
  if(rows.every((row)=>row.cycle_sequence!==null)&&new Set(rows.map((row)=>row.cycle_sequence)).size===rows.length){
    rows.sort((left,right)=>left.cycle_sequence-right.cycle_sequence);
    if(rows.some((row,index)=>row.cycle_sequence!==index+1))throw new Error("external review issuance cycle sequence is non-contiguous");
  }else rows.sort((left,right)=>String(left.issued_at).localeCompare(String(right.issued_at))||left.request_id.localeCompare(right.request_id));
  return rows;
}
