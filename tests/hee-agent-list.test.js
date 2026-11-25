import test from "node:test";
import assert from "node:assert/strict";
import {
  find, sidebarNarrow, clean, leadPanes, title, kidStatus, duration, trackChanges, nextHeld, rankOf,
  buildTree, nestedAddresses, countByTab, urgencyMap, sortByPriority, topStatus, computeLabels,
  machineOf, rowName, groupAgents, pendingPinsAfter, RANK,
} from "../mods/hee-agent-list/logic.js";

const prog = (o = {}) => ({ key: "claude", name: "Claude Code", icon: null, tint: false, tile: null, color: null, shell: false, agent: true, ...o });
const agent = (o = {}) => ({ address: "t1", pane: "p1", space: "s1", space_name: "sp", tab: "tb1", tab_index: 0, tab_name: "1", status: "idle", app: null, program: prog(), title: "", seq: 1, pinned: false, focused: false, ...o });

test("find / sidebarNarrow", () => {
  const root = { id: "root", children: [{ id: "sidebar", size: { px: 100 } }] };
  assert.equal(find(root, "sidebar").size.px, 100);
  assert.equal(find(root, "nope"), null);
  assert.equal(find(null, "x"), null);
  assert.equal(sidebarNarrow(root), true);
  assert.equal(sidebarNarrow({ id: "sidebar", size: { px: 160 } }), false);
  assert.equal(sidebarNarrow({ id: "sidebar", size: { px: 159 } }), true);
  assert.equal(sidebarNarrow({ id: "root" }), false); // 사이드바 없음 -> Infinity
  assert.equal(sidebarNarrow(undefined), false);
});

test("clean: 앞쪽 기호 제거", () => {
  assert.equal(clean("✳ My session"), "My session");
  assert.equal(clean("  hi "), "hi");
  assert.equal(clean(undefined), "");
  assert.equal(clean("***"), "");
});

test("title: 이름 없는 탭은 실시간 제목, 이름 붙인 탭은 탭 이름", () => {
  const lead = { title: "✳ Fix bug", program: prog() };
  assert.equal(title({ name: "1", named: false }, lead), "Fix bug");
  assert.equal(title({ name: "work", named: true }, lead), "work");
  // named지만 탭 이름이 프로그램 이름이면 제목을 따른다
  assert.equal(title({ name: "Claude Code", named: true }, lead), "Fix bug");
});

test("title: 경로·user@host·프로그램명 제목은 건너뜀", () => {
  const tab = { name: "1", named: false };
  for (const t of ["C:\\Users\\x", "hee@mac: ~", "Claude Code", "claude", "", "***"]) {
    assert.equal(title(tab, { title: t, program: prog() }), "1", `제목 ${JSON.stringify(t)}`);
  }
  // 현재 동작 고정: clean()이 앞쪽 기호를 먼저 지우므로 "~/proj"·"/usr/x"는 경로 검사에 걸리지 않고
  // 선행 기호가 빠진 채("proj", "usr/x") 제목으로 쓰인다.
  assert.equal(title(tab, { title: "~/proj", program: prog() }), "proj");
  assert.equal(title(tab, { title: "/usr/x", program: prog() }), "usr/x");
  assert.equal(title(tab, undefined), "1");
});

test("leadPanes: 에이전트 > 포커스 터미널 > 첫 터미널, 모드 pane 제외", () => {
  const sh = prog({ key: "shell", name: "zsh", agent: false, shell: true });
  const panes = [
    { pane: "a", terminal: "t1", tab: "x", program: sh, focused: false },
    { pane: "b", terminal: "t2", tab: "x", program: sh, focused: true },
    { pane: "c", terminal: "t3", tab: "x", program: prog(), focused: false },
    { pane: "d", terminal: "t4", tab: "x", program: prog(), focused: true },
    { pane: "m", terminal: null, tab: "y", program: sh, focused: true },
    { pane: "e", terminal: "t5", tab: "z", program: sh, focused: false },
    { pane: "f", terminal: "t6", tab: "z", program: sh, focused: true },
    { pane: "g", terminal: "t7", tab: "w", program: sh, focused: false },
  ];
  const leads = leadPanes(panes);
  assert.equal(leads.get("x").pane, "c"); // 첫 에이전트
  assert.equal(leads.has("y"), false);
  assert.equal(leads.get("z").pane, "f"); // 포커스된 터미널
  assert.equal(leads.get("w").pane, "g");
  assert.equal(leadPanes([]).size, 0);
});

test("kidStatus: error는 blocked, done은 idle, 목록에 있으면 목록 값", () => {
  const listed = new Map([["a", "working"]]);
  assert.equal(kidStatus({ address: "a", status: "done" }, listed), "working");
  assert.equal(kidStatus({ address: "b", status: "error" }, listed), "blocked");
  assert.equal(kidStatus({ address: "b", status: "done" }, listed), "idle");
  assert.equal(kidStatus({ address: "b", status: "working" }, listed), "working");
  assert.equal(kidStatus({ address: "c", status: "x" }, new Map([["c", "error"]])), "blocked");
});

test("duration: 경계값", () => {
  const m = 60000;
  assert.equal(duration(0), "<1m");
  assert.equal(duration(59999), "<1m");
  assert.equal(duration(m), "1m");
  assert.equal(duration(59 * m + 59999), "59m");
  assert.equal(duration(60 * m), "1h");
  assert.equal(duration(23 * 60 * m + 59 * m), "23h");
  assert.equal(duration(24 * 60 * m), "1d");
  assert.equal(duration(49 * 60 * m), "2d");
});

test("trackChanges: 변화 없음 / 신규 / done=idle / 30일 지난 사라진 항목 정리", () => {
  const now = 100 * 86400000;
  const same = trackChanges({ t1: { s: "idle", at: 5 } }, [agent({ status: "done" })], now);
  assert.equal(same.dirty, false); // done은 idle과 같다
  assert.deepEqual(same.changed, { t1: { s: "idle", at: 5 } });

  const empty = trackChanges({}, [], now);
  assert.equal(empty.dirty, false);

  const added = trackChanges({}, [agent({ status: "working" })], now);
  assert.equal(added.dirty, true);
  assert.deepEqual(added.changed, { t1: { s: "working", at: now } });

  const changed = trackChanges({ t1: { s: "idle", at: 5 } }, [agent({ status: "blocked" })], now);
  assert.deepEqual(changed.changed.t1, { s: "blocked", at: now });

  const input = { gone_old: { s: "idle", at: now - 31 * 86400000 }, gone_new: { s: "idle", at: now - 29 * 86400000 } };
  const pruned = trackChanges(input, [agent({ address: "t9", status: "working" })], now);
  assert.equal("gone_old" in pruned.changed, false);
  assert.equal("gone_new" in pruned.changed, true);
  assert.equal("gone_old" in input, true); // 입력은 바뀌지 않는다
  // 정리는 변화가 있을 때만 일어난다
  const noPrune = trackChanges({ gone_old: { s: "idle", at: 0 }, t1: { s: "idle", at: 1 } }, [agent()], now);
  assert.equal("gone_old" in noPrune.changed, true);
});

test("nextHeld / rankOf: 본 done은 떠날 때까지 Done에 머문다", () => {
  let held = nextHeld(undefined, [agent({ status: "done", focused: true })]);
  assert.deepEqual(held, { address: "t1", rank: RANK.done });
  // 보는 순간 idle이 되어도 hold 유지
  const seen = [agent({ status: "idle", focused: true })];
  held = nextHeld(held, seen);
  assert.deepEqual(held, { address: "t1", rank: RANK.done });
  assert.equal(rankOf(seen[0], held), RANK.done);
  // 다른 상태로 바뀌면 즉시 갱신
  held = nextHeld(held, [agent({ status: "working", focused: true })]);
  assert.deepEqual(held, { address: "t1", rank: RANK.working });
  assert.equal(rankOf(agent({ status: "idle" }), held), RANK.idle);
  // 포커스 없음
  assert.equal(nextHeld(held, [agent()]), null);
  assert.equal(nextHeld(held, []), null);
  assert.equal(rankOf(agent({ status: "weird" }), null), 0);
});

const terms = [
  { address: "t1" },
  { address: "k1", parent: "t1", state: "live", status: "working" },
  { address: "k2", parent: "t1", state: "live", status: "error" },
  { address: "k3", parent: "k1", state: "live", status: "idle" },
  { address: "k4", parent: "t1", state: "dead", status: "working" },
];

test("buildTree: 깊이 우선, 선 모양, dead 제외", () => {
  const tree = buildTree(terms, "t1");
  assert.deepEqual(tree.map((n) => [n.t.address, n.lines]), [["k1", ["├"]], ["k3", ["│", "└"]], ["k2", ["└"]]]);
  assert.deepEqual(buildTree(terms, "none"), []);
  assert.deepEqual(buildTree([], "t1"), []);
});

test("nestedAddresses / countByTab", () => {
  const list = [agent(), agent({ address: "k1", tab: "tb2" })];
  assert.deepEqual([...nestedAddresses(list, terms)].sort(), ["k1", "k2", "k3"]);
  assert.deepEqual([...countByTab(list)], [["tb1", 1], ["tb2", 1]]);
  assert.equal(countByTab([]).size, 0);
});

test("urgencyMap: 하위 에이전트의 가장 급한 상태가 부모를 끌어올린다", () => {
  const list = [agent({ status: "idle" })];
  const u = urgencyMap(list, terms, new Map([["t1", "idle"]]), null);
  assert.equal(u.get("t1"), RANK.blocked); // k2 error -> blocked
  const u2 = urgencyMap([agent({ address: "z", status: "working" })], [], new Map(), null);
  assert.equal(u2.get("z"), RANK.working);
});

test("sortByPriority: 긴급도, 최근 변경, seq 순; 입력 불변", () => {
  const a = agent({ address: "a", seq: 1 }), b = agent({ address: "b", seq: 2 }), c = agent({ address: "c", seq: 3 }), d = agent({ address: "d", seq: 4 });
  const urgency = new Map([["a", 2], ["b", 2], ["c", 2], ["d", 4]]);
  const since = (x) => ({ a: 10, b: 10, c: 20, d: 0 })[x.address];
  const input = [a, b, c, d];
  assert.deepEqual(sortByPriority(input, urgency, since).map((x) => x.address), ["d", "c", "b", "a"]);
  assert.deepEqual(input.map((x) => x.address), ["a", "b", "c", "d"]);
  assert.deepEqual(sortByPriority([], urgency, since), []);
});

test("topStatus", () => {
  assert.equal(topStatus([]), null);
  assert.equal(topStatus(["idle", "working", "done"]), "done");
  assert.equal(topStatus(["idle", "blocked", "done"]), "blocked");
  assert.equal(topStatus(["weird"]), null); // 순위 없는 상태는 null(0)을 못 넘는다
});

test("computeLabels: 이름 없는 탭은 lead 제목, 번호만 있으면 detail null, 같은 space 충돌 시 복구", () => {
  const tabs = new Map([
    ["tb1", { id: "tb1", name: "1", named: false }],
    ["tb2", { id: "tb2", name: "2", named: false }],
    ["tb3", { id: "tb3", name: "docs", named: true }],
  ]);
  const leads = new Map([["tb1", { title: "Fix login", program: prog() }], ["tb2", { title: "hee@mac", program: prog() }]]);
  const list = [
    agent({ address: "a1", tab: "tb1" }),
    agent({ address: "a2", tab: "tb2" }),
    agent({ address: "a3", tab: "tb3" }),
    agent({ address: "a4", tab: "gone", title: "orphan", space_name: "other" }),
  ];
  const { labels, detail } = computeLabels(list, tabs, leads, countByTab(list));
  assert.equal(labels.get("a1"), "Fix login");
  assert.equal(labels.get("a2"), "2");
  assert.equal(labels.get("a3"), "docs");
  assert.equal(labels.get("a4"), "orphan");
  assert.equal(detail.get("a2"), null); // 번호만
  assert.equal(detail.get("a1"), "Fix login");
  assert.deepEqual(computeLabels([], tabs, leads, new Map()).labels.size, 0);
});

test("computeLabels: 한 탭에 에이전트가 여럿이면 각자의 제목, 번호만인 둘은 같은 space에서 되살림", () => {
  const tabs = new Map([["tb1", { id: "tb1", name: "1", named: true }], ["tb2", { id: "tb2", name: "2", named: false }], ["tb3", { id: "tb3", name: "3", named: false }]]);
  const list = [
    agent({ address: "a1", tab: "tb1", title: "alpha" }),
    agent({ address: "a2", tab: "tb1", title: "beta" }),
    agent({ address: "b1", tab: "tb2", space_name: "S" }),
    agent({ address: "b2", tab: "tb3", space_name: "S" }),
  ];
  const { labels, detail } = computeLabels(list, tabs, new Map(), countByTab(list));
  assert.equal(labels.get("a1"), "alpha");
  assert.equal(labels.get("a2"), "beta");
  assert.equal(detail.get("b1"), "2"); // 같은 space에서 둘 다 null -> 충돌이라 번호를 되살림
  assert.equal(detail.get("b2"), "3");
  // 하나뿐이면 null 유지
  const one = computeLabels([list[2]], tabs, new Map(), countByTab([list[2]]));
  assert.equal(one.detail.get("b1"), null);
});

test("machineOf", () => {
  assert.equal(machineOf("vps/t7"), "vps");
  assert.equal(machineOf("t7"), null);
});

test("rowName", () => {
  assert.equal(rowName({ full: true, more: "fix", spaceName: "sp", label: "fix", programName: "P" }), "fix");
  assert.equal(rowName({ full: true, more: null, spaceName: "sp", label: "3", programName: "P" }), "sp");
  assert.equal(rowName({ full: false, more: "fix", spaceName: "sp", label: "fix", programName: "P" }), "fix");
  assert.equal(rowName({ full: false, more: null, spaceName: "sp", label: "3", programName: "P" }), "P");
  assert.equal(rowName({ full: false, more: null, spaceName: "sp", label: "3", programName: undefined }), "3");
});

test("groupAgents: priority 섹션 / space 그룹 / pinned", () => {
  const a = agent({ address: "a", space: "s1", space_name: "One" });
  const b = agent({ address: "b", space: "s1", space_name: "One" });
  const c = agent({ address: "c", space: "s2", space_name: "Two" });
  const p = agent({ address: "p", pinned: true });
  const urgency = new Map([["a", 4], ["b", 4], ["c", 0], ["p", 2]]);
  const pri = groupAgents([p], [a, b, c], urgency, true);
  assert.deepEqual(pri.map((g) => [g.id, g.label, g.status, g.members.map((m) => m.address)]), [
    ["pinned", "Pinned", null, ["p"]],
    ["sec-4", "Needs you", "blocked", ["a", "b"]],
    ["sec-1", "Idle", undefined, ["c"]],
  ]);
  const grp = groupAgents([], [a, b, c], urgency, false);
  assert.deepEqual(grp.map((g) => [g.id, g.label, g.status, g.members.length]), [["sp-s1", "One", null, 2], ["sp-s2", "Two", null, 1]]);
  assert.deepEqual(groupAgents([], [], urgency, true), []);
});

test("pendingPinsAfter: 오프라인은 유지, 라벨 반영되면 제거, 새로 살아난 터미널은 핀 요청", () => {
  const all = [
    { address: "live1", state: "live", labels: { "herdr.pinned": "1" } },
    { address: "live2", state: "live", labels: {} },
    { address: "live3", state: "live" },
    { address: "dead", state: "dead", labels: {} },
  ];
  const r = pendingPinsAfter(["live1", "live2", "live3", "dead", "missing"], all, new Set(["live3"]));
  assert.deepEqual(r.pending, ["live2", "live3", "dead", "missing"]);
  assert.deepEqual(r.toPin, ["live2"]);
  assert.deepEqual(pendingPinsAfter([], all, new Set()), { pending: [], toPin: [] });
});
