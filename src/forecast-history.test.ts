import test from "node:test";
import assert from "node:assert/strict";
import { addForecast, assessForecast, forecastStats, mayAssess, validAssessmentTime } from "./forecast-history.ts";

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

test("configurable assessment time permits 15:00, 21:00 and anytime", () => {
  const at = (hour: number, minute = 0) => new Date(2026, 10, 17, hour, minute);
  assert.equal(mayAssess(sample.date, at(14, 59), "15:00"), false);
  assert.equal(mayAssess(sample.date, at(15), "15:00"), true);
  assert.equal(mayAssess(sample.date, at(20, 59), "21:00"), false);
  assert.equal(mayAssess(sample.date, at(21), "21:00"), true);
  assert.equal(mayAssess(sample.date, at(8), "any"), true);
  assert.equal(mayAssess("2026-11-16", at(8), "21:00"), true);
  assert.equal(mayAssess("2026-11-18", at(23), "any"), false);
});
test("assessment saving obeys chosen time and keeps timestamps", () => {
  const history = addForecast({}, sample);
  const now = new Date(2026, 10, 17, 15);
  assert.throws(() => assessForecast(history, sample.date, "yes", "", now, "21:00"));
  const rated = assessForecast(history, sample.date, "yes", "", now, "15:00");
  assert.equal(rated[sample.date].assessment?.firstRatedAt, now.toISOString());
  assert.equal(rated[sample.date].message, sample.message);
});
test("invalid assessment settings cannot unlock assessment", () => {
  for (const value of ["24:00", "15:60", "hello", "3:00", ""]) {
    assert.equal(validAssessmentTime(value), false);
    assert.equal(mayAssess(sample.date, new Date(2026, 10, 17, 23), value as "18:00"), false);
  }
  assert.equal(validAssessmentTime("00:00"), true);
  assert.equal(validAssessmentTime("any"), true);
});
