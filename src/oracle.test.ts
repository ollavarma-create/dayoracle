import test from "node:test";
import assert from "node:assert/strict";
import { oracleMessage, stableHash } from "./oracle.ts";

const cycles = { physical: 0, emotional: 97, intellectual: -97 };

test("same input produces the same interpretation", () => {
  const first = oracleMessage(cycles, "mystic", "en", "2026-11-17", "1968-06-10");
  assert.equal(first, oracleMessage(cycles, "mystic", "en", "2026-11-17", "1968-06-10"));
});

test("hash is deterministic and unsigned", () => {
  assert.equal(stableHash("oracle"), stableHash("oracle"));
  assert.ok(stableHash("oracle") >= 0);
});

test("all personas and languages return nonempty interpretations", () => {
  for (const lang of ["fi", "en"] as const) {
    for (const persona of ["mystic", "skeptic"] as const) {
      assert.ok(oracleMessage(cycles, persona, lang, "2026-11-17", "1968-06-10").length > 20);
    }
  }
});

test("different days provide a range of messages", () => {
  const observed = new Set<string>();
  for (let day = 1; day <= 20; day++) {
    observed.add(oracleMessage(cycles, "mystic", "en", `2026-11-${String(day).padStart(2, "0")}`, "1968-06-10"));
  }
  assert.ok(observed.size >= 4);
});
