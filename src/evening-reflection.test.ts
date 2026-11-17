import test from "node:test";
import assert from "node:assert/strict";
import {
  clearBirthReflections, EMPTY_REFLECTION, parseReflections, reflectionKey, updateReflection,
} from "./evening-reflection.ts";

const a = reflectionKey("2000-01-01", "2026-11-17");
const b = reflectionKey("2000-01-01", "2026-11-16");
const c = reflectionKey("1990-01-01", "2026-11-17");

test("separates dates and birth dates", () => {
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test("round trips reflection data and preserves another day", () => {
  let store = updateReflection({}, a, { status: "partly", note: "I noticed something." });
  store = updateReflection(store, b, { status: "done" });
  const restored = parseReflections(JSON.stringify(store));
  assert.deepEqual(restored[a], { status: "partly", note: "I noticed something." });
  assert.equal(restored[b].status, "done");
  assert.deepEqual(restored[c] ?? EMPTY_REFLECTION, EMPTY_REFLECTION);
});

test("limits notes to 500 characters", () => {
  assert.equal(updateReflection({}, a, { note: "x".repeat(700) })[a].note.length, 500);
});

test("rejects corrupt and unexpected local data", () => {
  assert.deepEqual(parseReflections("not json"), {});
  assert.deepEqual(parseReflections("[]"), {});
  assert.deepEqual(parseReflections(JSON.stringify({ [a]: { status: "invalid", note: "x" } })), {});
});

test("forgetting a birth date removes only that person's reflections", () => {
  const store = {
    [a]: { status: "done" as const, note: "" },
    [b]: { status: "partly" as const, note: "" },
    [c]: { status: "not-today" as const, note: "" },
  };
  assert.deepEqual(clearBirthReflections(store, "2000-01-01"), { [c]: store[c] });
});
