import assert from "node:assert/strict";
import test from "node:test";
import { VaultSaveQueue } from "./vault-save-queue.ts";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("flush waits for edits staged during an in-flight encrypted write", async () => {
  const first = deferred();
  const second = deferred();
  const written: string[] = [];
  let calls = 0;
  const queue = new VaultSaveQueue<string>(async value => {
    written.push(value);
    await (++calls === 1 ? first.promise : second.promise);
  });
  queue.stage("old");
  const closing = queue.flush();
  queue.stage("new");
  first.resolve();
  await Promise.resolve();
  assert.equal(queue.dirty, true);
  second.resolve();
  await closing;
  assert.deepEqual(written, ["old", "new"]);
  assert.equal(queue.dirty, false);
});

test("coalesces multiple pending edits to newest snapshot", async () => {
  const gate = deferred();
  const written: string[] = [];
  const queue = new VaultSaveQueue<string>(async value => {
    written.push(value);
    if (value === "first") await gate.promise;
  });
  queue.stage("first");
  const flush = queue.flush();
  queue.stage("intermediate");
  queue.stage("latest");
  gate.resolve();
  await flush;
  assert.deepEqual(written, ["first", "latest"]);
});

test("failed write remains staged and can be retried", async () => {
  let fail = true;
  const written: string[] = [];
  const queue = new VaultSaveQueue<string>(async value => {
    if (fail) throw new Error("disk full");
    written.push(value);
  });
  queue.stage("journal");
  await assert.rejects(queue.flush(), /disk full/);
  assert.equal(queue.dirty, true);
  fail = false;
  await queue.flush();
  assert.deepEqual(written, ["journal"]);
  assert.equal(queue.dirty, false);
});

test("newer edits survive an earlier failed write", async () => {
  const gate = deferred();
  const written: string[] = [];
  let attempts = 0;
  const queue = new VaultSaveQueue<string>(async value => {
    if (++attempts === 1) { await gate.promise; throw new Error("failed"); }
    written.push(value);
  });
  queue.stage("old");
  const first = queue.flush();
  queue.stage("latest");
  gate.resolve();
  await assert.rejects(first, /failed/);
  await queue.flush();
  assert.deepEqual(written, ["latest"]);
});
