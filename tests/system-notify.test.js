import test from "node:test";
import assert from "node:assert/strict";
import { MESSAGE, snapshot, detectTransitions, notifyArgs } from "../mods/system-notify/logic.js";

const ag = (o = {}) => ({
  address: "t1", pane: "p1", space: "s1", space_name: "herdr", tab: "tb1", tab_index: 0, tab_name: "main",
  status: "idle", app: "claude-code", program: { name: "Claude Code", key: "claude", agent: true }, title: "Fix bug", seq: 1, pinned: false, focused: false, ...o,
});

test("snapshot: address -> status", () => {
  assert.deepEqual([...snapshot([ag(), ag({ address: "t2", status: "working" })])], [["t1", "idle"], ["t2", "working"]]);
  assert.equal(snapshot([]).size, 0);
});

test("전이 없음: 같은 상태가 반복되면 알리지 않는다", () => {
  const prev = snapshot([ag({ status: "blocked" })]);
  const r = detectTransitions(prev, [ag({ status: "blocked" })], false);
  assert.deepEqual(r.toNotify, []);
  assert.deepEqual([...r.next], [["t1", "blocked"]]);
});

test("working -> blocked / done 전이는 알린다, idle·working으로의 전이는 알리지 않는다", () => {
  const prev = snapshot([ag({ status: "working" }), ag({ address: "t2", status: "working" }), ag({ address: "t3", status: "done" })]);
  const list = [ag({ status: "blocked" }), ag({ address: "t2", status: "done" }), ag({ address: "t3", status: "idle" })];
  const r = detectTransitions(prev, list, false);
  assert.deepEqual(r.toNotify.map((a) => a.address), ["t1", "t2"]);
  assert.equal(r.next.get("t3"), "idle");
});

test("창이 활성이면 알리지 않지만 스냅샷은 갱신된다(중복 방지)", () => {
  const prev = snapshot([ag({ status: "working" })]);
  const r = detectTransitions(prev, [ag({ status: "done" })], true);
  assert.deepEqual(r.toNotify, []);
  assert.equal(r.next.get("t1"), "done");
  // 이후 비활성으로 돌아와도 같은 done은 다시 알리지 않는다
  assert.deepEqual(detectTransitions(r.next, [ag({ status: "done" })], false).toNotify, []);
});

test("새로 나타난 에이전트가 이미 blocked/done이면 알린다; idle·working이면 알리지 않는다", () => {
  const r = detectTransitions(new Map(), [ag({ status: "blocked" }), ag({ address: "t2", status: "idle" }), ag({ address: "t3", status: "working" })], false);
  assert.deepEqual(r.toNotify.map((a) => a.address), ["t1"]);
});

test("사라진 에이전트는 next에서 빠지고, 빈 목록도 안전", () => {
  const prev = snapshot([ag(), ag({ address: "t2" })]);
  const r = detectTransitions(prev, [ag()], false);
  assert.deepEqual([...r.next.keys()], ["t1"]);
  const empty = detectTransitions(prev, [], false);
  assert.equal(empty.next.size, 0);
  assert.deepEqual(empty.toNotify, []);
});

test("blocked -> done도 전이다", () => {
  const r = detectTransitions(snapshot([ag({ status: "blocked" })]), [ag({ status: "done" })], false);
  assert.equal(r.toNotify.length, 1);
});

test("notifyArgs: 제목·부제·본문·id·thread 조립", () => {
  const args = notifyArgs(ag({ status: "blocked" }), "/h/herdr-app");
  assert.deepEqual(args, [
    "--title", `Claude Code · ${MESSAGE.blocked}`,
    "--subtitle", "herdr › main",
    "--body", "Fix bug",
    "--id", "herdr-t1",
    "--thread", "herdr-space-s1",
    "--terminal", "t1",
    "--herdr-app", "/h/herdr-app",
  ]);
});

test("notifyArgs: 이름·제목 폴백", () => {
  const a = notifyArgs(ag({ status: "done", program: { name: "" }, app: "pi", title: "" }), "x");
  assert.equal(a[1], `pi · ${MESSAGE.done}`);
  assert.equal(a[5], "t1"); // 제목이 비면 address
  const b = notifyArgs(ag({ status: "done", program: undefined, app: null }), "x");
  assert.equal(b[1], `agent · ${MESSAGE.done}`);
});
