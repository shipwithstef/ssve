import test from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "./src/ledger.mjs";
const D = (s) => new Date(s);
test("a hold reduces available", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 1000, at: D("2026-01-01T00:00:00Z") });
  l.hold({ account: "a", amount_cents: 400, at: D("2026-01-02T00:00:00Z"), until: D("2026-01-09T00:00:00Z") });
  assert.equal(l.available("a", D("2026-01-03T00:00:00Z")), 600);
  assert.equal(l.available("a", D("2026-01-09T00:00:00Z")), 1000);
});
