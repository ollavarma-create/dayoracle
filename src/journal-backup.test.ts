import test from "node:test";
import assert from "node:assert/strict";
import { makeBackup,parseBackup,filterJournal,backupMarkdown } from "./journal-backup.ts";
const sample=makeBackup("2000-01-01",{"2026-11-17":"kind"},{"2000-01-01|2026-11-17":{status:"partly",note:"Tea and a talk"}});
test("JSON backup roundtrip",()=>assert.deepEqual(parseBackup(JSON.stringify(sample)),sample));
test("export preserves historical reflections across birth date changes",()=>assert.deepEqual(makeBackup("2000-01-01",{},{"1990-01-01|2026-11-17":{status:"done",note:"secret"}}).reflections,{"1990-01-01|2026-11-17":{status:"done",note:"secret"}}));
test("rejects corrupt, wrong version, bad dates and invalid entries",()=>{
  assert.throws(()=>parseBackup("{"));
  assert.throws(()=>parseBackup(JSON.stringify({...sample,version:2})));
  assert.throws(()=>parseBackup(JSON.stringify({...sample,birthDate:"2000-02-30"})));
  assert.throws(()=>parseBackup(JSON.stringify({...sample,intentions:{"2026-11-17":"invalid"}})));
  assert.throws(()=>parseBackup(JSON.stringify({...sample,reflections:{"2000-01-01|2026-11-17":{status:"done",note:"x".repeat(501)}}})));
});
test("journal search matches date, intention and note",()=>{
  const rows=[{date:"2026-11-17",intention:"kind",status:"partly" as const,note:"Tea and a talk"}];
  for(const q of ["tea","kind","2026-11"]) assert.equal(filterJournal(rows,q).length,1);
  assert.equal(filterJournal(rows,"unknown").length,0);
});
test("Markdown export contains dates and notes",()=>assert.match(backupMarkdown(sample,{title:"Journal",intention:"Intention",status:"Status",note:"Note"}),/Tea and a talk/));

test("encrypted journal serialization roundtrips after birth date change", () => {
  const state = makeBackup("2020-01-01", { "2019-12-31": "kind" }, {
    "2000-01-01|2026-11-17": { status: "partly", note: "Original reflection" },
  });
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
  assert.equal(Object.keys(state.reflections).length, 1);
  assert.equal(Object.keys(state.intentions).length, 1);
});
test("forgetting birth date does not erase journal in serialization", () => {
  const state = makeBackup("", { "2026-11-17": "kind" }, {
    "2000-01-01|2026-11-17": { status: "done", note: "Kept" },
  });
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
});
