// Modified from Herdr's bundled `changes` mod (Apache License 2.0); see NOTICE.
// Pure logic for the Changes panel and its Discard menu/confirmation: no herdr / gpui imports, so node can test it.
// main.js and menu.js do the UI, exec and state; everything that only turns data into data lives here.

export const MAX_FILES = 1000;

export const countLines = (text) => text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;

// Text draws a tab as nothing: pad each to the next 4-column stop.
export const untab = (text) => text.replace(/[^\t]*\t/g, (s) => s.slice(0, -1).padEnd((s.length - 1) - (s.length - 1) % 4 + 4));

// Numbers each diff line once, so a frame only draws the rows on screen.
export function diffRows(lines) {
  let old = 0, next = 0;
  return lines.map((line) => {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (match) { old = +match[1]; next = +match[2]; return { kind: "@", text: line }; }
    const kind = line[0];
    if (kind === "-") return { kind, number: old++, text: untab(line.slice(1)) || " " };
    if (kind === "+") return { kind, number: next++, text: untab(line.slice(1)) || " " };
    if (kind === " ") { old++; return { kind, number: next++, text: untab(line.slice(1)) || " " }; }
    return { kind: "", text: line };
  });
}

// `git diff --numstat -z` outputs (one per call) summed per path into { [path]: { add, del, binary } }.
export function parseNumstat(outputs) {
  const stats = {};
  for (const stdout of outputs) {
    for (const entry of stdout.split("\0")) {
      const [a, d, ...parts] = entry.split("\t");
      if (!parts.length) continue;
      const path = parts.join("\t"), old = stats[path] ?? { add: 0, del: 0 };
      stats[path] = { add: old.add + (Number(a) || 0), del: old.del + (Number(d) || 0), binary: a === "-" };
    }
  }
  return stats;
}

// `git status --porcelain=v1 -z --no-renames` plus numstat stats as the file list.
// status: U conflict, D deleted, A added/untracked, M otherwise.
export function parseChanges(statusStdout, stats = {}, max = MAX_FILES) {
  const files = [];
  const entries = statusStdout.split("\0").filter(Boolean);
  for (const entry of entries.slice(0, max)) {
    const xy = entry.slice(0, 2), path = entry.slice(3), fresh = xy === "??";
    const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
    const s = conflict ? "U" : xy.includes("D") ? "D" : fresh || xy.includes("A") ? "A" : "M";
    const stat = stats[path] ?? { add: 0, del: 0 };
    files.push({ path, status: s, fresh, ...stat });
  }
  return { files, limited: entries.length > max };
}

// Drops selected paths that no longer have changes (and an anchor that vanished).
export function pruneSelection(files, selected, anchor) {
  const paths = new Set(files.map((f) => f.path));
  const kept = new Set([...selected].filter((p) => paths.has(p)));
  return { selected: kept, anchor: anchor && !paths.has(anchor) ? null : anchor };
}

// Selection after a click. m: { shift, platform } (platform = cmd).
// Plain click: select only this row and open its diff (pick: true).
// Cmd+click: toggle this row. Shift+click: range from the anchor (cmd+shift adds to the selection).
export function selectionAfterClick(files, selected, anchor, path, m) {
  if (m.shift) {
    const from = files.findIndex((f) => f.path === anchor), to = files.findIndex((f) => f.path === path);
    if (from < 0) return { selected: new Set([path]), anchor: path, pick: false };
    const range = files.slice(Math.min(from, to), Math.max(from, to) + 1).map((f) => f.path);
    return { selected: new Set([...(m.platform ? selected : []), ...range]), anchor, pick: false };
  }
  if (m.platform) {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path); else next.add(path);
    return { selected: next, anchor: path, pick: false };
  }
  return { selected: new Set([path]), anchor: path, pick: true };
}

// Right-click: a row inside the selection acts on the whole selection; any other row becomes the selection.
// items keep file order.
export function menuTarget(files, selected, anchor, file) {
  const changed = !selected.has(file.path);
  const sel = changed ? new Set([file.path]) : selected;
  const items = files.filter((f) => sel.has(f.path)).map((f) => ({ path: f.path, status: f.status, fresh: f.fresh }));
  return { selected: sel, anchor: changed ? file.path : anchor, changed, items };
}

// A request's items: { items: [...] } or the old single { path, ... }.
export const requestItems = (req) => (Array.isArray(req?.items) ? req.items : req?.path ? [req] : []);

// The git args that discard one file (run with --literal-pathspecs; `inHead` only matters when hasHead).
// Throws when there is nothing to restore from.
export function discardArgs(file, hasHead, inHead) {
  const path = file.path;
  if (file.fresh) return ["clean", "-f", "--", path];
  if (!hasHead) {
    if (file.status !== "A" && file.status !== "D") throw new Error("no HEAD to restore from");
    return ["rm", "-f", "--", path];
  }
  return inHead ? ["restore", "--source=HEAD", "--staged", "--worktree", "--", path] : ["rm", "-f", "--", path];
}

// The note after a discard: null when nothing failed. total: how many items were requested.
export function discardNote(failed, total) {
  if (!failed.length) return null;
  if (total === 1) return `Discard failed: ${failed[0].reason}`;
  const cut = (r) => (r.length > 60 ? r.slice(0, 60) + "…" : r);
  const shown = failed.slice(0, 3).map((x) => `${x.path} (${cut(x.reason)})`).join(", ");
  return `${failed.length}개 실패: ${shown}${failed.length > 3 ? ` 외 ${failed.length - 3}개` : ""}`;
}

// ---- Discard menu and confirmation dialog ----

export const MAX_LISTED = 8;

// Overlay props as an item list: { items } or the old single { path, status, fresh }.
export const itemsOf = (p) => (Array.isArray(p?.items) ? p.items : p?.path ? [{ path: p.path, status: p.status, fresh: p.fresh }] : []);
export const isNewFile = (i) => i.fresh || i.status === "A";

// Dialog height for a file list: the overlay's size is fixed when it opens, so it is worked out from the count.
export function confirmHeight(items) {
  if (items.length <= 1) return 190;
  const usable = items.filter((i) => i.status !== "U");
  if (!usable.length) return 190;
  const listed = Math.min(items.length, MAX_LISTED) + (items.length > MAX_LISTED ? 1 : 0);
  const notes = 1 + Number(usable.some(isNewFile)) + Number(usable.length < items.length);
  return 114 + 22 * notes + 4 + 18 * listed + 16;
}

export const dialogWidth = (items) => (items.length > 1 ? 480 : 420);

// Everything the confirmation dialog says, as data. The view only lays it out.
//   conflict: every item is in conflict (only a Close button)
//   title, detail (single / conflict: one string), or for several files: summary/newNote/conflictNote lines,
//   listed (first MAX_LISTED items) and more ("외 N개" or null).
export function confirmModel(items) {
  const multi = items.length > 1;
  const usable = items.filter((i) => i.status !== "U");
  const conflict = usable.length === 0;
  const newCount = usable.filter(isNewFile).length;
  const isNew = !multi && newCount === 1;
  const one = items[0] ?? {};
  const title = multi && !conflict ? `Discard ${items.length} files?` : isNew && !conflict ? "Delete file?" : "Discard changes?";
  const model = { multi, conflict, title, usableCount: usable.length, newCount };
  if (conflict) model.detail = "충돌 상태의 파일은 Discard 할 수 없습니다. 먼저 충돌을 해결하세요.";
  else if (!multi) model.detail = isNew ? `${one.path} 파일을 삭제합니다. 되돌릴 수 없습니다.` : `${one.path} 의 변경을 되돌립니다. 되돌릴 수 없습니다.`;
  else {
    model.summary = `${usable.length}개 파일의 변경을 되돌립니다. 되돌릴 수 없습니다.`;
    model.newNote = newCount > 0 ? `신규 파일 ${newCount}개는 삭제되며 되돌릴 수 없습니다.` : null;
    model.conflictNote = usable.length < items.length ? `충돌 상태 ${items.length - usable.length}개는 건너뜁니다.` : null;
    model.listed = items.slice(0, MAX_LISTED);
    model.more = items.length > MAX_LISTED ? `외 ${items.length - MAX_LISTED}개` : null;
  }
  return model;
}

export const menuLabel = (items) => (items.length > 1 ? `Discard ${items.length} files` : "Discard");
