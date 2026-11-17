import test from "node:test";
import assert from "node:assert/strict";
import { addForecast, assessForecast, forecastStats, mayAssess } from "./forecast-history.ts";

const sample = { date: "2026-11-17", birthDateAtCreation: "1968-01-01",
  persona: "mystic" as const, locale: "fi" as const, message: "Pieni yllätys",
  createdAt: "2026-11-17T08:00:00.000Z" };
test("forecast is frozen on first capture", () => {
  const original = addForecast({}, sample);
  assert.equal(addForecast(original, { ...sample, message: "Changed" }), original);
});
test("assessment opens at local 18:00 and stays available later", () => {
  assert.equal(mayAssess(sample.date, new Date(2026, 10, 17, 17, 59)), false);
  assert.equal(mayAssess(sample.date, new Date(2026, 10, 17, 18, 0)), true);
  assert.equal(mayAssess(sample.date, new Date(2026, 10, 18, 9, 0)), true);
});
test("assessment edits preserve original timestamp and prediction", () => {
  const history = addForecast({}, sample);
  assert.throws(() => assessForecast(history, sample.date, "yes", "", new Date(2026, 10, 17, 17)));
  const first = assessForecast(history, sample.date, "partial", "Perhaps", new Date(2026, 10, 17, 19));
  const second = assessForecast(first, sample.date, "yes", "Indeed", new Date(2026, 10, 18, 10));
  assert.equal(second[sample.date].message, sample.message);
  assert.equal(second[sample.date].assessment?.firstRatedAt, first[sample.date].assessment?.firstRatedAt);
  assert.equal(forecastStats(second).yes, 1);
  assert.equal(history[sample.date].assessment, undefined);
});
test("forecast history is not keyed by current birth date", () => {
  const history = addForecast({}, sample);
  assert.equal(Object.keys(history)[0], sample.date);
  assert.equal(history[sample.date].birthDateAtCreation, "1968-01-01");
});
