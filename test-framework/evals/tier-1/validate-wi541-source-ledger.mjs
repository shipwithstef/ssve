#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const file='docs/specs/evidence/wi-541-source-ledger.json';
const ledger=JSON.parse(fs.readFileSync(file,'utf8'));
const allowed=new Set(['implemented','implement','rejected','track']);
if(ledger.schema!==1||ledger.wi!=='WI-541'||!Array.isArray(ledger.entries)) throw new Error('ledger header invalid');
if(typeof ledger.source_manifest!=='string'||!Array.isArray(ledger.source_rows)) throw new Error('source snapshot binding missing');
const sourcePath=path.resolve(ledger.source_manifest);const sourceBytes=fs.readFileSync(sourcePath);
if(createHash('sha256').update(sourceBytes).digest('hex')!==ledger.source_manifest_sha256) throw new Error('source snapshot digest mismatch');
const survey=sourceBytes.toString('utf8');const sections=[...survey.matchAll(/## (Findings by priority|Implemented or superseded source families)\n([\s\S]*?)(?=\n## )/g)];
const discovered=[];
for(const section of sections) for(const line of section[2].split('\n')){
  if(!line.startsWith('|')||line.includes('|---')||line.includes('Priority |')||line.includes('Source family |')) continue;
  const cells=line.split('|').slice(1,-1).map(value=>value.trim());if(cells.length<3) continue;
  const label=section[1].startsWith('Findings')?cells[1]:cells[0];
  discovered.push(createHash('sha256').update(label.replace(/\s+/g,' ').trim().toLowerCase()).digest('hex'));
}
if(discovered.length===0||discovered.length!==ledger.source_rows.length) throw new Error(`source census mismatch: discovered=${discovered.length} declared=${ledger.source_rows.length}`);
if(ledger.denominator!==ledger.entries.length) throw new Error('denominator mismatch');
if(ledger.denominator!==discovered.length) throw new Error('denominator does not match discovered source snapshot');
const digests=new Set();
for(let index=0;index<ledger.entries.length;index++){
  const entry=ledger.entries[index];const source=ledger.source_rows[index];
  if(!source||source.family!==entry.family||source.source_sha256!==discovered[index]) throw new Error(`${entry.family}: source snapshot row binding mismatch at ${index+1}`);
  if(!allowed.has(entry.disposition)) throw new Error(`${entry.family}: invalid disposition`);
  if(!Array.isArray(entry.evidence)||entry.evidence.length===0) throw new Error(`${entry.family}: missing evidence`);
  for(const evidence of entry.evidence){const normalized=path.normalize(String(evidence||''));if(!evidence||path.isAbsolute(evidence)||normalized.startsWith('..')||!fs.existsSync(path.resolve(normalized)))throw new Error(`${entry.family}: evidence target does not exist: ${evidence}`);}
  const normalized=String(entry.claim||'').trim().replace(/\s+/g,' ').toLowerCase();
  const digest=createHash('sha256').update(normalized).digest('hex');
  if(digests.has(digest)) throw new Error(`${entry.family}: duplicate normalized claim`);
  digests.add(digest);
}
console.log(JSON.stringify({pass:true,denominator:ledger.denominator,disposition_counts:Object.fromEntries([...allowed].map(value=>[value,ledger.entries.filter(entry=>entry.disposition===value).length]))}));
