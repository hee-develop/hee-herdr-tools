// Pure logic for the Discard menu and its confirmation dialog: no herdr / gpui imports, so node can test it.

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
