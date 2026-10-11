// Reference build for the grader checks: a small booking app with validation, persistence and
// an HTML page that survives a lost network. Grader-side only; never shown to an arm.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(path.dirname(new URL(import.meta.url).pathname), "data", "state.json");
const CLASSES = [{ id: "flow", name: "Morning flow", at: "08:00", priceCents: 1850, capacity: 10 }, { id: "yin", name: "Evening yin", at: "18:30", priceCents: 1600, capacity: 8 }];
let bookings = [];
try { bookings = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
const save = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(bookings)); };
const left = (c) => c.capacity - bookings.filter((b) => b.classId === c.id).length;

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Quiet Studio</title>
<style>body{font:18px/1.5 system-ui,sans-serif;margin:0;background:#fbf7ef;color:#1d1d1f}main{max-width:36rem;margin:0 auto;padding:16px}h1{font-size:1.6rem}label{display:block;margin:12px 0 4px}input,select,button{font:inherit;min-height:48px;padding:6px 12px;border:2px solid #1d1d1f;border-radius:6px;width:100%;box-sizing:border-box;background:#fff;color:#1d1d1f}button{background:#1d1d1f;color:#fff;cursor:pointer;margin-top:12px}#msg{margin-top:16px;min-height:2em}</style></head>
<body><main><h1>Quiet Studio classes</h1><ul id="list"></ul>
<form id="f"><label for="n">Your name</label><input id="n" autocomplete="name"><label for="c">Class</label><select id="c"></select>
<button type="submit" id="b">Book</button><button type="button" id="x">Cancel last booking</button></form><p id="msg" role="status"></p></main>
<script>
let last=null;const $=(i)=>document.getElementById(i);
async function api(p,o){try{const r=await fetch(p,o);return{ok:r.ok,body:await r.json().catch(()=>({}))}}catch{return{ok:false,body:{error:"No connection. Try again in a moment."}}}}
async function load(){const r=await api("/api/classes");if(!r.ok){$("msg").textContent=r.body.error||"Could not load classes.";return}
$("list").textContent="";$("c").textContent="";for(const c of r.body){const li=document.createElement("li");li.textContent=c.name+", "+c.at+", "+c.left+" places left";$("list").append(li);const o=document.createElement("option");o.value=c.id;o.textContent=c.name;$("c").append(o)}}
$("f").addEventListener("submit",async(e)=>{e.preventDefault();const name=$("n").value.trim();if(!name){$("msg").textContent="Please enter your name.";return}
const r=await api("/api/book",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({classId:$("c").value,name})});
if(r.ok){last=r.body.id;$("msg").textContent="Booked. See you there.";load()}else $("msg").textContent=r.body.error||"Could not book."});
$("x").addEventListener("click",async()=>{if(!last){$("msg").textContent="Nothing to cancel yet.";return}
const r=await api("/api/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:last})});
$("msg").textContent=r.ok?"Cancelled.":r.body.error||"Could not cancel.";if(r.ok){last=null;load()}});
load();
</script></body></html>`;

function body(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on("data", (c) => { n += c.length; if (n > 10000) { reject(Object.assign(new Error("too large"), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(parts).toString() || "{}")); } catch { reject(Object.assign(new Error("invalid JSON"), { code: 400 })); } });
    req.on("error", () => reject(Object.assign(new Error("aborted"), { code: 400 })));
  });
}

http.createServer(async (req, res) => {
  const send = (code, type, text) => { res.writeHead(code, { "content-type": type, "x-content-type-options": "nosniff" }); res.end(text); };
  const json = (code, o) => send(code, "application/json", JSON.stringify(o));
  let path;
  try { path = new URL(req.url, "http://x").pathname; } catch { return json(400, { error: "bad url" }); }
  try {
    if (req.method === "GET" && path === "/") return send(200, "text/html; charset=utf-8", page);
    if (req.method === "GET" && path === "/api/classes") return json(200, CLASSES.map((c) => ({ ...c, left: left(c) })));
    if (req.method === "POST" && path === "/api/book") {
      const b = await body(req);
      const cls = CLASSES.find((c) => c.id === b?.classId);
      if (!cls) return json(404, { error: "No such class." });
      const name = typeof b.name === "string" ? b.name.trim() : "";
      if (!name || name.length > 80) return json(400, { error: "Enter a name of up to 80 characters." });
      if (left(cls) <= 0) return json(409, { error: "That class is full." });
      const id = `b${Date.now().toString(36)}${bookings.length}`;
      bookings.push({ id, classId: cls.id, name }); save();
      return json(201, { id });
    }
    if (req.method === "POST" && path === "/api/cancel") {
      const b = await body(req);
      const i = bookings.findIndex((x) => x.id === b?.id);
      if (i < 0) return json(404, { error: "No such booking." });
      bookings.splice(i, 1); save();
      return json(200, { ok: true });
    }
    json(404, { error: "Not found." });
  } catch (e) { json(e.code === 413 ? 413 : 400, { error: e.message }); }
}).listen(Number(process.env.PORT || 3000));
