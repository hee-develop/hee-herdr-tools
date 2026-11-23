import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRefs, buildRows, pickableRows, sanitizeBranchName, resolveChoice, createArgs, errorText,
  wrapIndex, scrollTarget, pickFolder, clampIndex, MAX_ERROR_LINES,
} from "../mods/branch-switch/logic.js";

const line = (ref, hash, head, subject) => [ref, hash, head, subject].join("\t");
const OUT = [
  line("refs/heads/feature/a", "aaaaaaa", " ", "add a"),
  line("refs/heads/main", "bbbbbbb", "*", "main subject\twith tab"),
  line("refs/heads/fix-b", "ccccccc", " ", "fix b"),
  line("refs/remotes/origin/HEAD", "bbbbbbb", " ", "x"),
  line("refs/remotes/origin", "bbbbbbb", " ", "bare remote"),
  line("refs/remotes/origin/main", "bbbbbbb", " ", "main subject"),
  line("refs/remotes/origin/new-one", "ddddddd", " ", "new one"),
  line("refs/tags/v1.0", "eeeeeee", " ", "release"),
  "",
].join("\n");

test("parseRefs: 현재 브랜치 우선, 원격 HEAD·이름뿐인 remote 제외, subject의 탭 보존", () => {
  const r = parseRefs(OUT);
  assert.deepEqual(r.local.map((x) => x.name), ["main", "feature/a", "fix-b"]);
  assert.equal(r.local[0].current, true);
  assert.equal(r.local[0].subject, "main subject\twith tab");
  assert.deepEqual(r.remote.map((x) => x.name), ["origin/main", "origin/new-one"]);
  assert.deepEqual(r.tags, [{ type: "tag", name: "v1.0", hash: "eeeeeee", subject: "release" }]);
});

test("parseRefs: 빈 출력", () => {
  assert.deepEqual(parseRefs(""), { local: [], remote: [], tags: [] });
  assert.deepEqual(parseRefs("\n\n"), { local: [], remote: [], tags: [] });
});

test("buildRows: pick 모드는 액션 3개 + 그룹 구분선", () => {
  const refs = parseRefs(OUT);
  const rows = buildRows(refs, "pick", "");
  assert.deepEqual(rows.slice(0, 3).map((r) => r.id), ["new", "from", "detach"]);
  assert.deepEqual(rows.filter((r) => r.kind === "sep").map((r) => r.label), ["branches", "remote branches", "tags"]);
  assert.equal(pickableRows(rows).length, 3 + 3 + 2 + 1);
});

test("buildRows: from/detach 모드는 액션 없음, name 모드·refs 없음은 빈 목록", () => {
  const refs = parseRefs(OUT);
  assert.equal(buildRows(refs, "from", "").some((r) => r.kind === "action"), false);
  assert.equal(buildRows(refs, "detach", "").some((r) => r.kind === "action"), false);
  assert.deepEqual(buildRows(refs, "name", ""), []);
  assert.deepEqual(buildRows(null, "pick", ""), []);
  assert.deepEqual(buildRows(undefined, "pick", ""), []);
});

test("buildRows: 필터는 대소문자 무시·앞뒤 공백 무시, 빈 그룹은 구분선도 생략", () => {
  const refs = parseRefs(OUT);
  const rows = buildRows(refs, "pick", "  MAIN ");
  assert.deepEqual(rows.map((r) => (r.kind === "sep" ? `--${r.label}` : r.name)), ["--branches", "main", "--remote branches", "origin/main"]);
  assert.equal(buildRows(refs, "pick", "zzz").length, 0);
  // 액션 라벨도 필터 대상
  assert.deepEqual(buildRows(refs, "pick", "detached").map((r) => r.id ?? r.kind), ["detach"]);
  // 모든 ref가 비어도 pick에선 액션이 남는다
  assert.equal(buildRows({ local: [], remote: [], tags: [] }, "pick", "").length, 3);
  assert.equal(buildRows({ local: [], remote: [], tags: [] }, "from", "").length, 0);
});

test("sanitizeBranchName / createArgs", () => {
  assert.equal(sanitizeBranchName("  my new  branch "), "my-new--branch");
  assert.equal(createArgs("   ", null), null);
  assert.deepEqual(createArgs(" feat x ", null), { args: ["switch", "-c", "feat-x"], label: "feat-x" });
  assert.deepEqual(createArgs("feat", { name: "origin/main" }), { args: ["switch", "-c", "feat", "origin/main"], label: "feat" });
});

test("resolveChoice: 액션", () => {
  const refs = parseRefs(OUT);
  assert.deepEqual(resolveChoice({ kind: "action", id: "new" }, "pick", refs), { do: "enter", mode: "name", resetBase: true });
  assert.deepEqual(resolveChoice({ kind: "action", id: "from" }, "pick", refs), { do: "enter", mode: "from", resetBase: true });
  assert.deepEqual(resolveChoice({ kind: "action", id: "detach" }, "pick", refs), { do: "enter", mode: "detach", resetBase: true });
});

test("resolveChoice: 모드별 ref 선택", () => {
  const refs = parseRefs(OUT);
  const [main, feature] = refs.local;
  assert.deepEqual(resolveChoice({ kind: "ref", ...feature }, "from", refs), { do: "base" });
  assert.deepEqual(resolveChoice({ kind: "ref", ...feature }, "detach", refs), { do: "run", args: ["switch", "--detach", "feature/a"], label: "feature/a" });
  assert.deepEqual(resolveChoice({ kind: "ref", ...feature }, "pick", refs), { do: "run", args: ["switch", "feature/a"], label: "feature/a" });
  assert.deepEqual(resolveChoice({ kind: "ref", ...main }, "pick", refs), { do: "close" }); // 이미 현재 브랜치
  const tag = { kind: "ref", ...refs.tags[0] };
  assert.deepEqual(resolveChoice(tag, "pick", refs), { do: "run", args: ["switch", "--detach", "v1.0"], label: "v1.0" });
});

test("resolveChoice: 원격 브랜치 — 같은 이름 로컬이 있으면 그것으로, 현재면 닫기, 없으면 --track", () => {
  const refs = parseRefs(OUT);
  const rm = (name) => ({ kind: "ref", type: "remote", name });
  assert.deepEqual(resolveChoice(rm("origin/main"), "pick", refs), { do: "close" });
  assert.deepEqual(resolveChoice(rm("origin/fix-b"), "pick", refs), { do: "run", args: ["switch", "fix-b"], label: "fix-b" });
  assert.deepEqual(resolveChoice(rm("origin/new-one"), "pick", refs), { do: "run", args: ["switch", "--track", "origin/new-one"], label: "new-one" });
  // 슬래시가 여럿이면 첫 슬래시 뒤 전체가 로컬 이름
  assert.deepEqual(resolveChoice(rm("origin/feature/a"), "pick", refs), { do: "run", args: ["switch", "feature/a"], label: "feature/a" });
  assert.deepEqual(resolveChoice(rm("origin/feature/zzz"), "pick", refs), { do: "run", args: ["switch", "--track", "origin/feature/zzz"], label: "feature/zzz" });
});

test("errorText: 줄 수 제한과 기본 문구", () => {
  assert.equal(errorText(""), "git switch failed.");
  assert.equal(errorText("a\nb"), "a\nb");
  const many = Array.from({ length: 10 }, (_, i) => `l${i}`).join("\n");
  assert.equal(errorText(many).split("\n").length, MAX_ERROR_LINES);
  assert.equal(errorText(many).split("\n").at(-1), "l5");
});

test("wrapIndex / clampIndex", () => {
  assert.equal(wrapIndex(0, -1, 5), 4);
  assert.equal(wrapIndex(4, 1, 5), 0);
  assert.equal(wrapIndex(2, 1, 5), 3);
  assert.equal(clampIndex(5, 3), 2);
  assert.equal(clampIndex(-1, 3), 0);
  assert.equal(clampIndex(0, 0), 0); // 빈 목록
});

test("scrollTarget: 화면 안이면 null, 위/아래 밖이면 항목 인덱스", () => {
  const range = { start: 5, end: 15 };
  assert.equal(scrollTarget(3, 10, range), null);
  assert.equal(scrollTarget(3, 5, range), 4); // 위쪽 경계
  assert.equal(scrollTarget(0, 5, range), 0); // 선택이 첫 항목이면 맨 위
  assert.equal(scrollTarget(3, 2, range), 1);
  assert.equal(scrollTarget(3, 1, range), 0);
  assert.equal(scrollTarget(3, 14, range), 14 - 9 + 1); // 아래쪽 경계: visible = 9
  assert.equal(scrollTarget(3, 30, range), 22);
  assert.equal(scrollTarget(0, 0, { start: 0, end: 0 }), 0); // visible 최소 1
});

test("pickFolder: 우선순위 props > 포커스 cwd > space pane cwd > space.folder > null", () => {
  const space = { tabs: [{ id: "tb1" }], folder: "/space" };
  const ps = [{ tab: "other", cwd: "/o" }, { tab: "tb1", cwd: null }, { tab: "tb1", cwd: "/pane" }];
  assert.equal(pickFolder("/p", { cwd: "/f" }, space, ps), "/p");
  assert.equal(pickFolder(undefined, { cwd: "/f" }, space, ps), "/f");
  assert.equal(pickFolder(undefined, { cwd: null }, space, ps), "/pane");
  assert.equal(pickFolder("", null, space, []), "/space");
  assert.equal(pickFolder(undefined, null, undefined, []), null);
  assert.equal(pickFolder(undefined, null, { tabs: undefined, folder: "" }, ps), null);
});
