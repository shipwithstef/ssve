import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

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
export function issueExternalReviewProvenance({receiptPath,packagePath,findingsPath}){
  const receiptBytes=secureFile(receiptPath,"external review receipt");const receipt=JSON.parse(receiptBytes);if(!UUID.test(String(receipt.request_id||"")))throw new Error("external review request id must be a UUID");
  const packageBytes=secureFile(packagePath,"external review package");const findingsBytes=secureFile(findingsPath,"external review findings");
  const root=externalReviewProvenanceRoot({receiptPath}),key=authorityKey(root,{create:true}),issuance=secureDirectory(path.join(root,"issuance"),"external review issuance directory",{create:true});
  const payload={schema_version:1,request_id:receipt.request_id,candidate_digest:receipt.candidate_digest,package_sha256:sha(packageBytes),findings_sha256:sha(findingsBytes),receipt_sha256:sha(receiptBytes),receipt_path:fs.realpathSync(receiptPath),package_path:fs.realpathSync(packagePath),findings_path:fs.realpathSync(findingsPath),launcher_version:receipt.launcher_version,effective_tuple:receipt.effective_tuple,issued_at:new Date().toISOString()};
  const marker={...payload,authority_hmac_sha256:crypto.createHmac("sha256",key).update(canonical(payload)).digest("hex")};const file=path.join(issuance,`${receipt.request_id}.json`);const fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);try{fs.writeFileSync(fd,`${JSON.stringify(marker,null,2)}\n`);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return file;
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
