#!/usr/bin/env node
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  PRAGMA foreign_keys=ON;
  CREATE TABLE candidate (
    project TEXT NOT NULL,
    scope TEXT NOT NULL,
    id TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY(project, scope, id)
  );
  CREATE TABLE outbox (
    event_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    logged INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO candidate VALUES ('project-a', 'consumer', 'CAND-001', 'candidate');
`);

const eventId = createHash("sha256")
  .update(JSON.stringify([1, "project-a", "consumer", "CAND-001", "promote", "WI-508"]))
  .digest("hex");

function transition() {
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT status FROM candidate WHERE project=? AND scope=? AND id=?")
      .get("project-a", "consumer", "CAND-001");
    if (row.status === "candidate") {
      db.prepare("UPDATE candidate SET status='promoted' WHERE project=? AND scope=? AND id=?")
        .run("project-a", "consumer", "CAND-001");
      db.prepare("INSERT INTO outbox(event_id,payload) VALUES(?,?)")
        .run(eventId, JSON.stringify({ event_id: eventId, action: "promote" }));
    } else if (row.status !== "promoted") {
      throw new Error("conflicting terminal state");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const ledger = [];
function flush({ crashAfterAppend = false } = {}) {
  const pending = db.prepare("SELECT event_id,payload FROM outbox WHERE logged=0").all();
  for (const row of pending) {
    if (!ledger.some((event) => event.event_id === row.event_id)) ledger.push(JSON.parse(row.payload));
    if (crashAfterAppend) throw new Error("simulated crash after append");
    db.prepare("UPDATE outbox SET logged=1 WHERE event_id=?").run(row.event_id);
  }
}

transition();
try { flush({ crashAfterAppend: true }); } catch {}
transition();
flush();

const status = db.prepare("SELECT status FROM candidate").get().status;
const pending = db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE logged=0").get().n;
db.close();

if (status !== "promoted" || ledger.length !== 1 || pending !== 0) process.exit(1);
console.log(JSON.stringify({ status, ledger_events: ledger.length, pending_outbox: pending }));
