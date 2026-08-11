#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "svc-candidate-json-probe-"));
const file = join(dir, "pool.json");

try {
  writeFileSync(file, JSON.stringify({ revision: 0, candidates: { "CAND-001": "candidate" } }));

  // Two writers read the same revision before either writes. Atomic rename can
  // prevent a partial file, but without one global lock it cannot prevent this
  // lost-update class across repository/mirror/ledger files.
  const writerA = JSON.parse(readFileSync(file, "utf8"));
  const writerB = JSON.parse(readFileSync(file, "utf8"));
  writerA.candidates["CAND-001"] = "promoted";
  writerA.revision += 1;
  writerB.candidates["CAND-002"] = "rejected";
  writerB.revision += 1;
  writeFileSync(file, JSON.stringify(writerA));
  writeFileSync(file, JSON.stringify(writerB));

  const final = JSON.parse(readFileSync(file, "utf8"));
  const lostPromotion = final.candidates["CAND-001"] === "candidate";
  if (!lostPromotion || final.candidates["CAND-002"] !== "rejected") process.exit(1);
  console.log(JSON.stringify({ lost_promotion: true, final_revision: final.revision }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
