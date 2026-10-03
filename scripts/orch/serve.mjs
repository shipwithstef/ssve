#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { stateRoot, options, isMain } from './common.mjs';
export const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orchestrator OS</title>
<style>body{font:16px system-ui;margin:2rem auto;padding:0 1rem;max-width:1100px;background:#111827;color:#e5e7eb}summary{cursor:pointer;padding:.65rem}details{border-left:2px solid #374151;margin:.5rem;padding-left:.8rem}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px monospace}.running{color:#60a5fa}.done{color:#a3e635}.stalled{color:#fbbf24}.failed,.timeout{color:#fb7185}small{color:#9ca3af}#error{color:#fbbf24}</style>
<h1>Orchestrator OS</h1><p><small id="stamp">Loading…</small></p><p id="error" role="status"></p><pre id="recovery"></pre><main id="tree"></main>
<script>
const expanded=new Set();const tree=document.getElementById('tree');
function text(tag,value,parent){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el}
function box(key,label,parent){const d=document.createElement('details');d.open=expanded.has(key);d.addEventListener('toggle',()=>d.open?expanded.add(key):expanded.delete(key));text('summary',label,d);parent.append(d);return d}
function minutes(ms){return ms==null?'unknown':Math.round(ms/60000)+'m'}
function known(value){return value==null?'unknown':String(value)}
function goalLabel(g){return '#'+known(g.priority)+' '+g.title+' · '+(g.desired_state||'unregistered')+' / '+(g.observed_state||'unknown')+' · child '+(g.child?.health||'unobserved')+' ('+(g.child?.state||'needs_owner')+') · '+(g.child?.effort==='low'?'LOW':'effort unknown')+' · session '+(g.child?.session_id||'unbound')+' · turns '+known(g.usage?.claude?.turns)+'/'+known(g.budget?.claude_turn_cap)+' · blockers '+(g.blockers||[]).map(b=>b.code).join(', ')}
function budgetLabel(g){let lines=['Counts-v1 · Claude turns used '+known(g.usage?.claude?.turns)+' / cap '+known(g.budget?.claude_turn_cap)+' · reserved '+known(g.reserved?.claude_turns)+' · remaining '+known(g.remaining?.claude_turns)];for(const cli of ['codex','cursor','agy'])lines.push(cli+' attempts used '+known(g.usage?.workers?.[cli]?.attempts)+' / cap '+known(g.budget?.worker_caps?.[cli]?.runs)+' · reserved active '+known(g.reserved?.worker_runs?.[cli])+' · remaining '+known(g.remaining?.worker_runs?.[cli]));lines.push('Active reservations are included in attempts used. Token/quota attribution unknown.');return lines.join('\\n')}
function ownerCommands(s){const rows=s.orchestrators||s.recovery?.orchestrators||[];return rows.length?['Owner action only · parent first, then children · verify native ownership and LOW',...rows.map(o=>o.role+' '+o.goal_id+' · '+o.session_id+' · generation '+o.generation+' · '+o.state+' · auto_start=false'+'\\nLive attach: '+(o.attach_command||'held')+'\\nStopped resume (owner must verify native stopped): '+(o.resume_command||'held')+'\\n'+(o.reason||''))].join('\\n'):s.recovery?'Owner attach: '+(s.recovery.parent?.resume_command||s.recovery.parent?.reason||'Configure parent session'):''}
function validStatus(s){const task=t=>typeof t?.id==='string'&&typeof t.state==='string'&&!!t.executor&&!!t.estimate_ms&&Array.isArray(t.acceptance);return s?.schema_version===1&&Number.isInteger(s.revision)&&typeof s.collector_heartbeat_at==='string'&&Array.isArray(s.warnings)&&Array.isArray(s.tasks)&&s.tasks.every(task)&&Array.isArray(s.goals)&&s.goals.every(g=>typeof g.id==='string'&&typeof g.title==='string'&&Array.isArray(g.lanes)&&g.lanes.every(l=>typeof l.id==='string'&&Array.isArray(l.tasks)&&l.tasks.every(task)))}
function renderStatus(s){
 tree.replaceChildren();const age=Date.now()-Date.parse(s.collector_heartbeat_at);document.getElementById('stamp').textContent='Updated '+s.generated_at+' · revision '+s.revision+' · refresh 60s · read-only';document.getElementById('error').textContent=!Number.isFinite(age)||age>90000||age< -60000?'Collector stale: heartbeat unavailable or out of date':(s.warnings||[]).map(w=>w.description).join('; ');
 document.getElementById('recovery').textContent=ownerCommands(s)+(s.recovery?'\\nBoot recovery: '+s.recovery.boot_id+'\\n'+(s.recovery.tasks||[]).map(t=>t.id+': '+t.action+(t.reason?' · '+t.reason:'')).join('\\n'):'');
 for(const g of [...s.goals].sort((a,b)=>(a.priority??Number.MAX_SAFE_INTEGER)-(b.priority??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id))){const gd=box('g:'+g.id,goalLabel(g),tree);text('pre',budgetLabel(g),gd);for(const b of g.blockers||[])text('p','Blocker: '+b.code+' · '+b.description,gd);if(!g.lanes.length)text('p','No lanes or tasks registered.',gd);
 for(const l of g.lanes){const ld=box('l:'+g.id+':'+l.id,l.title+' · '+l.tasks.length+' tasks',gd);for(const t of l.tasks){const key='t:'+g.id+':'+t.id;const d=box(key,t.id+' · '+t.title+' · '+t.state+' · '+minutes(t.elapsed_ms)+' / est '+minutes(t.estimate_ms.high),ld);d.firstChild.className=t.state;d.firstChild.title=t.description+' · '+(t.acceptance[0]||'Acceptance unrecorded');text('p',t.description,d);text('p','Executor: '+[t.executor.cli,t.executor.model,t.executor.effort].filter(Boolean).join(' / ')+' · '+t.verification_state,d);text('pre',JSON.stringify({session_id:t.session_id,deadline:t.deadline_at,health:t.health,last_progress:t.last_progress_at,events:t.events_last_3,blockers:t.blockers,artifacts:t.artifacts,git:{branch:t.branch,ahead:t.ahead,behind:t.behind,status:t.status,diffstat:t.diffstat},completion_report:t.completion_report,cost:t.cost_so_far},null,2),d)}}}}
async function refresh(){try{const r=await fetch('/status.json',{cache:'no-store'});if(!r.ok)throw Error('Status unavailable ('+r.status+')');const s=await r.json();if(!validStatus(s))throw Error('Unsupported status schema');renderStatus(s)}catch(e){document.getElementById('error').textContent=e.message+'; showing last snapshot'}}refresh();setInterval(refresh,60000);
</script></html>`;
export function createServer(root = stateRoot()) {
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    if (req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(req.method === 'HEAD' ? '' : html); return; }
    if (req.url === '/status.json') {
      fs.readFile(path.join(root, 'status.json'), (error, data) => { res.writeHead(error ? 503 : 200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(req.method === 'HEAD' ? '' : error ? JSON.stringify({ error: 'Status unavailable' }) : data); }); return;
    }
    res.writeHead(404); res.end();
  });
}
if (isMain(import.meta.url)) {
  try { const o = options(process.argv.slice(2)); const port = Number(o.port || process.env.ORCH_SERVE_PORT || 8787); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port'); const bind = o.bind || process.env.ORCH_SERVE_BIND || '127.0.0.1'; const server = createServer(); server.on('error', e => { console.error(e.message); process.exitCode = 1; }); server.listen(port, bind, () => console.log('Read-only Orchestrator OS at http://' + bind + ':' + port)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
