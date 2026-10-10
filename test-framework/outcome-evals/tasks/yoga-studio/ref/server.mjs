// Minimal smoke reference: the graders' floor, not a model answer.
import http from "node:http";
const page = `<!doctype html><meta charset="utf-8"><title>Studio</title><main><h1>Classes</h1><p>Morning flow, 08:00, 10 places left.</p><button id="b">Book</button><button id="c">Cancel</button><p id="m"></p></main><script>b.onclick=()=>m.textContent="Booked";c.onclick=()=>m.textContent="Cancelled";</script>`;
http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(page); }).listen(Number(process.env.PORT || 3000));
