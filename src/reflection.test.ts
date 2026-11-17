import test from "node:test";
import assert from "node:assert/strict";
import { dailyQuestion } from "./reflection.ts";

test("daily question is deterministic", () => {
  const args = ["fi", "mystic", "2026-11-17", "1980-01-01"] as const;
  assert.equal(dailyQuestion(...args), dailyQuestion(...args));
});

test("every persona and language has a question", () => {
  for (const lang of ["fi", "en"] as const) {
    for (const persona of ["mystic", "skeptic"] as const) {
      assert.ok(dailyQuestion(lang, persona, "2026-11-17", "1980-01-01").length > 20);
    }
  }
});

test("questions vary over multiple days", () => {
  const observed = new Set<string>();
  for (let n = 1; n <= 20; n++) {
    observed.add(dailyQuestion("en", "skeptic", `2026-11-${String(n).padStart(2, "0")}`, "1980-01-01"));
  }
  assert.ok(observed.size >= 5);
});
