import test from "node:test";
import assert from "node:assert/strict";
import {
  sidebarNarrow, place, rowHeight, where, base, glyph, tone, avatarFill, avatarInitial, assignColors, nestWorktrees,
  planMoves, remoteNames, rebuilt, repoName, parseCounts, gitInfo, gitTailParts, MARK, PALETTE,
} from "../mods/hee-space-list/logic.js";

const sp = (o = {}) => ({ id: "s1", index: 0, name: "herdr", named: false, folder: "/home/x", machine: null, branch: null, active: false, status: null, tabs: [{ id: "tb1" }], ...o });

test("sidebarNarrow: 160px 경계", () => {
  assert.equal(sidebarNarrow({ id: "sidebar", size: { px: 159 } }), true);
  assert.equal(sidebarNarrow({ id: "sidebar", size: { px: 160 } }), false);
  assert.equal(sidebarNarrow({ id: "r", children: [{ id: "sidebar" }] }), false);
  assert.equal(sidebarNarrow(null), false);
});

test("place / where: 첫 터미널 cwd, 없으면 space.folder", () => {
  const ps = [{ tab: "x", cwd: "/other" }, { tab: "tb1", cwd: null }, { tab: "tb1", cwd: "/proj" }];
  assert.equal(place(sp(), ps), "/proj");
  assert.equal(place(sp(), []), "/home/x");
  assert.equal(place(sp({ tabs: undefined }), ps), "/home/x");
  assert.equal(where(sp({ machine: "vps" }), ps), JSON.stringify(["vps", "/proj"]));
  assert.equal(where(sp(), []), JSON.stringify([null, "/home/x"]));
});

test("rowHeight / base", () => {
  assert.equal(rowHeight({ tree: "└─" }), 28);
  assert.equal(rowHeight({ tree: null }), 30);
  assert.equal(base("/a/b/repo///"), "repo");
  assert.equal(base("repo"), "repo");
});

test("glyph / tone", () => {
  assert.equal(glyph("blocked"), "●");
  assert.equal(glyph("done"), "●");
  assert.equal(glyph("working"), "·");
  assert.equal(glyph(null), "·");
  assert.equal(tone({ blocked: "#f00", unknown: "#999" }, "blocked"), "#f00");
  assert.equal(tone({ blocked: "#f00", unknown: "#999" }, "idle"), "#999");
});

test("avatarFill / avatarInitial", () => {
  const t = { ansi9: "#123456" };
  assert.equal(avatarFill("#abcdef", t), "#abcdef");
  assert.equal(avatarFill("ansi6", t), MARK.ansi6);
  assert.equal(avatarFill("ansi9", t), "#123456");
  assert.equal(avatarFill("nope", t), undefined);
  assert.equal(avatarInitial("herdr"), "H");
  assert.equal(avatarInitial("가나"), "가");
  assert.equal(avatarInitial(""), "?");
  assert.equal(avatarInitial("😀x"), "😀"); // 서로게이트 쌍도 한 글자
});

test("assignColors: 새 space에 가장 덜 쓰인 색, '~'는 건너뜀, 사라진 space 색 제거", () => {
  const a = assignColors([sp({ id: "a" }), sp({ id: "b" }), sp({ id: "h", name: "~" })], {});
  assert.deepEqual(a.kept, { a: "ansi6", b: "ansi3" });
  assert.equal(a.changed, true);
  // 변화 없음
  const same = assignColors([sp({ id: "a" })], { a: "ansi6" });
  assert.equal(same.changed, false);
  assert.deepEqual(same.kept, { a: "ansi6" });
  // 사라진 space
  const gone = assignColors([sp({ id: "a" })], { a: "ansi6", z: "ansi3" });
  assert.deepEqual(gone, { kept: { a: "ansi6" }, changed: true });
  // 모든 색이 한 번씩 쓰이면 첫 색부터 다시
  const full = Object.fromEntries(PALETTE.map((c, i) => [`s${i}`, c]));
  const more = assignColors([...PALETTE.map((_, i) => sp({ id: `s${i}` })), sp({ id: "new" })], full);
  assert.equal(more.kept.new, "ansi6");
  // 입력 colors가 undefined/빈 목록
  assert.deepEqual(assignColors([], undefined), { kept: {}, changed: false });
});

const g = (repo, linked, o = {}) => ({ name: "r", branch: "main", ahead: 0, behind: 0, repo, linked, ...o });

test("nestWorktrees: worktree는 메인 체크아웃 아래로 들어가고 마지막은 └─", () => {
  const list = [
    { w: sp({ id: "1" }), i: 0, g: g("R", false) },
    { w: sp({ id: "2" }), i: 1, g: null },
    { w: sp({ id: "3" }), i: 2, g: g("R", true) },
    { w: sp({ id: "4" }), i: 3, g: g("Q", true) }, // 메인이 없는 linked: 중첩 안 함
    { w: sp({ id: "5" }), i: 4, g: g("R", true) },
  ];
  const out = nestWorktrees(list);
  assert.deepEqual(out.map((r) => [r.w.id, r.tree]), [["1", null], ["3", "├─"], ["5", "└─"], ["2", null], ["4", null]]);
  assert.deepEqual(nestWorktrees([]), []);
});

test("nestWorktrees: 같은 repo의 메인이 둘이어도 worktree는 첫 메인 아래 한 번만", () => {
  const list = [
    { w: sp({ id: "1" }), i: 0, g: g("R", false) },
    { w: sp({ id: "2" }), i: 1, g: g("R", false) },
    { w: sp({ id: "3" }), i: 2, g: g("R", true) },
  ];
  assert.deepEqual(nestWorktrees(list).map((r) => [r.w.id, r.tree]), [["1", null], ["3", "└─"], ["2", null]]);
});

test("planMoves: 이미 순서가 맞으면 없음, 이동은 앞선 이동을 반영한 인덱스", () => {
  const out = (ids) => ids.map((id) => ({ w: sp({ id, machine: id === "c" ? "vps" : null }) }));
  assert.deepEqual(planMoves(["a", "b", "c"], out(["a", "b", "c"])), []);
  assert.deepEqual(planMoves(["a", "b", "c"], out(["c", "a", "b"])), [{ id: "c", index: 1, machine: "vps" }]);
  // c,b,a: c를 1번으로 -> [c,a,b], b를 2번으로 -> [c,b,a], a는 이미 3번
  assert.deepEqual(planMoves(["a", "b", "c"], out(["c", "b", "a"])), [
    { id: "c", index: 1, machine: "vps" },
    { id: "b", index: 2, machine: null },
  ]);
  const input = ["a", "b", "c"];
  planMoves(input, out(["c", "b", "a"]));
  assert.deepEqual(input, ["a", "b", "c"]); // 입력 불변
  assert.deepEqual(planMoves([], []), []);
});

test("remoteNames / rebuilt", () => {
  const rows = [{ w: { machine: "vps" } }, { w: { machine: null } }, { w: { machine: "vps" } }];
  assert.deepEqual(remoteNames(rows, [{ name: "mac2" }, { name: "vps" }], { alpha: {} }), ["alpha", "mac2", "vps"]);
  assert.deepEqual(remoteNames([], [], {}), []);
  assert.equal(rebuilt({ state: "unreachable", why: 'a different core answers there ("abc")' }), true);
  assert.equal(rebuilt({ state: "unreachable", why: "timeout" }), false);
  assert.equal(rebuilt({ state: "connected", why: 'a different core answers there ("abc")' }), false);
  assert.equal(rebuilt(undefined), false);
  assert.equal(rebuilt({ state: "unreachable" }), false);
});

test("repoName / parseCounts", () => {
  assert.equal(repoName("/Users/x/herdr/.git"), "herdr");
  assert.equal(repoName("/srv/git/herdr.git"), "herdr");
  assert.equal(repoName("/srv/git/herdr"), "herdr");
  assert.deepEqual(parseCounts(true, "2\t3\n"), [2, 3]);
  assert.deepEqual(parseCounts(false, ""), [0, 0]);
});

test("gitInfo: 일반 저장소 / linked worktree / detached / upstream 없음", () => {
  const main = gitInfo({ on: null, top: "/p/herdr\n", repo: "/p/herdr/.git\n", branchOk: true, branchOut: "refs/heads/feature/x\n", countsOk: true, countsOut: "1 4\n" });
  assert.deepEqual(main, { name: "herdr", branch: "feature/x", ahead: 1, behind: 4, repo: JSON.stringify([null, "/p/herdr/.git"]), linked: false });
  const wt = gitInfo({ on: "vps", top: "/p/herdr-wt", repo: "/p/herdr/.git", branchOk: false, branchOut: "", countsOk: false, countsOut: "" });
  assert.equal(wt.linked, true);
  assert.equal(wt.branch, "(detached)");
  assert.deepEqual([wt.ahead, wt.behind], [0, 0]);
  assert.equal(wt.repo, JSON.stringify(["vps", "/p/herdr/.git"]));
});

test("gitTailParts: 이름이 말해 주면 생략, master/main 생략, worktree는 repo 생략", () => {
  assert.deepEqual(gitTailParts(g("R", false, { name: "herdr", branch: "spike", ahead: 2, behind: 1 }), null, "other"), { where: "herdr · spike", ahead: 2, behind: 1 });
  assert.equal(gitTailParts(g("R", false, { name: "herdr", branch: "main" }), null, "other").where, "herdr");
  assert.equal(gitTailParts(g("R", false, { name: "herdr", branch: "master" }), null, "other").where, "herdr");
  assert.equal(gitTailParts(g("R", false, { name: "herdr", branch: "spike" }), null, "HERDR").where, "spike"); // 대소문자 무시
  assert.equal(gitTailParts(g("R", true, { name: "herdr", branch: "spike" }), "└─", "x").where, "spike");
  assert.equal(gitTailParts(g("R", false, { name: "herdr", branch: "Spike" }), null, "spike").where, "herdr");
  assert.equal(gitTailParts(g("R", false, { name: "herdr", branch: "main" }), null, "herdr").where, "");
  assert.equal(gitTailParts({ name: "r", branch: undefined, ahead: 0, behind: 0 }, null, "x").where, "r · detached");
});
