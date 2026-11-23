// Modified from Herdr's bundled `spaces` mod (Apache License 2.0); see NOTICE.
// my-spaces의 순수 로직: 위치 키, worktree 중첩 정렬, 이동 계획, 색 배정, git 정보 파싱.
// herdr·gpui 의존 없음. herdr API 결과(spaces(), panes(), machines(), layout())를 인자로 받는다.

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
export const sidebarNarrow = (root) => (find(root, "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
export function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
export const rowHeight = ({ tree }) => (tree ? 28 : 30);
export const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
export const base = (path) => path.replace(/\/+$/, "").split("/").pop();

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
export const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
export const PALETTE = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

// 저장된 색 이름 -> 아바타 색. "#..."은 그대로, 이름이면 MARK, 없으면 테마 색.
export function avatarFill(color, t) {
  return color.startsWith("#") ? color : (MARK[color] ?? t[color]);
}

export const avatarInitial = (name) => [...name][0]?.toUpperCase() ?? "?";

// 공간별 색 배정. colors: shared("space.colors"). 사라진 space의 색은 버리고,
// 새 space("~" 제외)에는 가장 덜 쓰인 팔레트 색을 준다. 반환: { kept, changed }.
export function assignColors(sp, colors, palette = PALETTE) {
  const ids = new Set(sp.map((p) => p.id));
  const kept = Object.fromEntries(Object.entries(colors ?? {}).filter(([id]) => ids.has(id)));
  let changed = Object.keys(kept).length !== Object.keys(colors ?? {}).length;
  for (const p of sp) {
    if (kept[p.id] || p.name === "~") continue;
    const uses = (c) => Object.values(kept).filter((v) => v === c).length;
    kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
    changed = true;
  }
  return { kept, changed };
}

// Spaces in order, each worktree space moved under its main checkout's.
// list: [{ w, i, g }] (g: git info or null). 반환: [{ w, i, g, tree }].
export function nestWorktrees(list) {
  const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
  const nested = (r) => r.g?.linked && mains.has(r.g.repo);
  const out = [];
  const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
  for (const r of list) {
    if (nested(r)) continue;
    out.push({ ...r, tree: null });
    if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
    placed.add(r.g.repo);
    const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
    kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
  }
  return out;
}

// Simulate the batch so later indexes include earlier moves.
// order: 현재 space id 순서, out: nestWorktrees 결과. 반환: [{ id, index(1부터), machine }] (실행 순서대로).
export function planMoves(order, out) {
  const cur = [...order];
  const moves = [];
  for (let i = 0; i < out.length; i++) {
    const from = cur.indexOf(out[i].w.id);
    if (from === i) continue;
    moves.push({ id: out[i].w.id, index: i + 1, machine: out[i].w.machine ?? null });
    cur.splice(i, 0, cur.splice(from, 1)[0]);
  }
  return moves;
}

// 머신 그룹 이름: 로컬이 아닌 머신들(정렬, 중복 제거).
export const remoteNames = (rows, machineList, reconnecting) =>
  [...new Set([...rows.map((r) => r.w.machine).filter(Boolean), ...machineList.map((m) => m.name), ...Object.keys(reconnecting)])].sort();

export function rebuilt(machine) {
  return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
}

// git 저장소 이름: repo는 공통 .git 경로.
export function repoName(repo) {
  return repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
}

// `git rev-list --left-right --count HEAD...@{upstream}` 결과(성공 시 stdout)에서 [ahead, behind].
export const parseCounts = (ok, stdout) => (ok ? stdout.trim().split(/\s+/).map(Number) : [0, 0]);

// 한 장소의 git 정보. top/repo: rev-parse 출력(개행 포함 가능), branch: symbolic-ref 결과.
export function gitInfo({ on, top, repo, branchOk, branchOut, countsOk, countsOut }) {
  top = top.replace(/\n$/, "");
  repo = repo.replace(/\n$/, "");
  const [ahead, behind] = parseCounts(countsOk, countsOut);
  return {
    name: repoName(repo),
    branch: branchOk ? branchOut.trim().replace(/^refs\/heads\//, "") : "(detached)",
    ahead,
    behind,
    repo: JSON.stringify([on, repo]),
    linked: repo !== `${top}/.git`,
  };
}

// 이름 뒤에 붙는 꼬리 정보: 저장소/브랜치(이름이 이미 말하면 생략, master/main 생략)와 ahead/behind.
export function gitTailParts(g, tree, name) {
  const raw = g.branch ?? "detached";
  const same = (a) => a.toLowerCase() === name.toLowerCase();
  const branch = same(raw) || raw === "master" || raw === "main" ? "" : raw;
  const repo = tree || same(g.name) ? "" : g.name;
  return { where: [repo, branch].filter(Boolean).join(" · "), ahead: g.ahead, behind: g.behind };
}
