// branch-switch의 순수 로직: ref 파싱, 목록 필터링, 선택 결정, 인자 조립. herdr·gpui 의존 없음.

export const ROW = 30;
export const MAX_ERROR_LINES = 6;

export const PLACEHOLDER = {
  pick: "Select a branch or tag to checkout",
  from: "Select a ref to create the branch from",
  detach: "Select a branch or tag to checkout (detached)",
  name: "Branch name",
};

export const ACTIONS = [["new", "+ Create new branch..."], ["from", "+ Create new branch from..."], ["detach", "Checkout detached..."]];

// `git for-each-ref` 출력(readRefs의 포맷)을 { local, remote, tags }로 파싱한다.
// 로컬은 현재 브랜치를 맨 앞으로(나머지는 입력 순서 유지), 원격은 HEAD·remote 이름만 있는 ref 제외.
export function parseRefs(out) {
  const local = [], remote = [], tags = [];
  for (const line of out.split("\n")) {
    if (!line) continue;
    const [ref, hash, head, ...rest] = line.split("\t");
    const subject = rest.join("\t");
    if (ref.startsWith("refs/heads/")) local.push({ type: "local", name: ref.slice(11), hash, subject, current: head === "*" });
    else if (ref.startsWith("refs/remotes/")) {
      const name = ref.slice(13);
      if (name.endsWith("/HEAD") || !name.includes("/")) continue;
      remote.push({ type: "remote", name, hash, subject });
    } else if (ref.startsWith("refs/tags/")) tags.push({ type: "tag", name: ref.slice(10), hash, subject });
  }
  local.sort((a, b) => Number(b.current) - Number(a.current)); // stable: current first, rest by date
  return { local, remote, tags };
}

// 현재 모드와 필터에 맞는 행: 액션, 구분선, ref.
export function buildRows(refs, mode, filter) {
  if (!refs) return [];
  if (mode === "name") return [];
  const f = filter.trim().toLowerCase();
  const hit = (s) => !f || s.toLowerCase().includes(f);
  const out = [];
  if (mode === "pick") {
    for (const [id, label] of ACTIONS) {
      if (hit(label)) out.push({ kind: "action", id, label });
    }
  }
  const group = (title, list) => {
    const items = list.filter((r) => hit(r.name));
    if (items.length) out.push({ kind: "sep", label: title }, ...items.map((r) => ({ kind: "ref", ...r })));
  };
  group("branches", refs.local);
  group("remote branches", refs.remote);
  group("tags", refs.tags);
  return out;
}

export const pickableRows = (rows) => rows.filter((r) => r.kind !== "sep");

// 새 브랜치 이름: 앞뒤 공백 제거, 내부 공백은 "-".
export const sanitizeBranchName = (raw) => raw.trim().replace(/\s/g, "-");

// 행을 골랐을 때 할 일.
//  { do: "enter", mode, resetBase }: 다음 모드로 / { do: "base" }: 기준 ref로 저장 후 name 모드
//  { do: "close" }: 이미 현재 브랜치 / { do: "run", args, label }: git 실행
export function resolveChoice(r, mode, refs) {
  if (r.kind === "action") return { do: "enter", mode: r.id === "new" ? "name" : r.id, resetBase: true };
  if (mode === "from") return { do: "base" };
  if (mode === "detach") return { do: "run", args: ["switch", "--detach", r.name], label: r.name };
  if (r.type === "local") {
    if (r.current) return { do: "close" };
    return { do: "run", args: ["switch", r.name], label: r.name };
  }
  if (r.type === "remote") {
    const local = r.name.slice(r.name.indexOf("/") + 1);
    const existing = refs.local.find((l) => l.name === local);
    if (existing) {
      if (existing.current) return { do: "close" };
      return { do: "run", args: ["switch", local], label: local };
    }
    return { do: "run", args: ["switch", "--track", r.name], label: local };
  }
  return { do: "run", args: ["switch", "--detach", r.name], label: r.name };
}

// 새 브랜치 생성 인자. 이름이 비면 null. base: 선택한 기준 ref 또는 null.
export function createArgs(rawName, base) {
  const name = sanitizeBranchName(rawName);
  if (!name) return null;
  return { args: ["switch", "-c", name, ...(base ? [base.name] : [])], label: name };
}

// git 오류 문구: 앞 MAX_ERROR_LINES줄만, 비면 기본 문구.
export const errorText = (err) => err.split("\n").slice(0, MAX_ERROR_LINES).join("\n") || "git switch failed.";

// ↑↓ 이동: 순환.
export const wrapIndex = (at, delta, count) => (at + delta + count) % count;

// 선택을 화면 안에 두려면 스크롤할 항목 인덱스(필요 없으면 null).
// idx: rows에서 선택 행의 인덱스, range: 리스트가 그린 { start, end }.
export function scrollTarget(at, idx, range) {
  const visible = Math.max(1, range.end - range.start - 1);
  if (idx <= range.start) return at === 0 ? 0 : Math.max(0, idx - 1);
  if (idx >= range.end - 1) return Math.max(0, idx - visible + 1);
  return null;
}

// 작업 폴더: props.folder > 포커스 cwd > space 첫 cwd가 있는 pane > space.folder.
export function pickFolder(propsFolder, f, space, ps) {
  return propsFolder || f?.cwd || ps.find((p) => (space?.tabs ?? []).some((t) => t.id === p.tab) && p.cwd)?.cwd || space?.folder || null;
}

export const clampIndex = (at, count) => Math.max(0, Math.min(at, count - 1));
