import test from "node:test";
import assert from "node:assert/strict";
import { journalEntries } from "./journal.ts";

const birth = "2000-01-01";
test("combines intention and reflection on the same date", () => {
  const rows = journalEntries(birth, { "2026-11-17": "kind" }, {
    "2000-01-01|2026-11-17": { status: "partly", note: "Small kindness" },
  });
  assert.deepEqual(rows, [{ date: "2026-11-17", intention: "kind", status: "partly", note: "Small kindness" }]);
});
test("shows reflection-only days and sorts newest first", () => {
  const rows = journalEntries(birth, { "2026-11-16": "pause" }, {
    "2000-01-01|2026-11-18": { status: "done", note: "" },
  });
  assert.deepEqual(rows.map(row => row.date), ["2026-11-18", "2026-11-16"]);
});
test("does not expose other birth dates' reflections", () => {
  const rows = journalEntries(birth, {}, {
    "1999-01-01|2026-11-17": { status: "done", note: "Private" },
  });
  assert.deepEqual(rows, []);
});
test("ignores empty, invalid, and pre-birth entries", () => {
  const rows = journalEntries(birth, { "1999-01-01": "kind", invalid: "pause" }, {
    "2000-01-01|2026-11-17": { status: "", note: "  " },
  });
  assert.deepEqual(rows, []);
});
