import test from "node:test";
import assert from "node:assert/strict";
import { nextCronRun as n } from "./solution.mjs";
const D = (s) => new Date(s);
test("every 15 minutes", () => { assert.equal(n("*/15 * * * *", D("2026-01-01T10:07:30Z")).toISOString(), "2026-01-01T10:15:00.000Z"); });
test("strictly after", () => { assert.equal(n("0 12 * * *", D("2026-01-01T12:00:00Z")).toISOString(), "2026-01-02T12:00:00.000Z"); });
test("invalid", () => { assert.throws(() => n("60 * * * *", D("2026-01-01T00:00:00Z")), RangeError); });
