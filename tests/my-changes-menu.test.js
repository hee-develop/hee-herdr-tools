import test from "node:test";
import assert from "node:assert/strict";
import { MAX_LISTED, itemsOf, isNewFile, confirmHeight, dialogWidth, confirmModel, menuLabel } from "../mods/my-changes-menu/logic.js";

const item = (i, status = "M", fresh = false) => ({ path: `f${i}.txt`, status, fresh });
const list = (n, status = "M") => Array.from({ length: n }, (_, i) => item(i, status));

test("itemsOf: items[], old single props, nothing", () => {
  const items = [item(1)];
  assert.equal(itemsOf({ items }), items);
  assert.deepEqual(itemsOf({ path: "a", status: "A", fresh: true, overlay: 3 }), [{ path: "a", status: "A", fresh: true }]);
  assert.deepEqual(itemsOf({}), []);
  assert.deepEqual(itemsOf(undefined), []);
  assert.deepEqual(itemsOf(null), []);
});

test("isNewFile: fresh or staged-add", () => {
  assert.equal(isNewFile({ fresh: true, status: "A" }), true);
  assert.equal(isNewFile({ fresh: false, status: "A" }), true);
  assert.equal(Boolean(isNewFile({ fresh: false, status: "M" })), false);
  assert.equal(Boolean(isNewFile({ status: "D" })), false);
});

test("confirmHeight: 0/1 item and all-conflict use the fixed height", () => {
  assert.equal(confirmHeight([]), 190);
  assert.equal(confirmHeight([item(1)]), 190);
  assert.equal(confirmHeight(list(3, "U")), 190);
});

test("confirmHeight: 2, 8, 9, many files", () => {
  // 114 + 22*notes + 4 + 18*listed + 16
  assert.equal(confirmHeight(list(2)), 114 + 22 + 4 + 36 + 16);
  assert.equal(confirmHeight(list(8)), 114 + 22 + 4 + 18 * 8 + 16);
  assert.equal(confirmHeight(list(9)), 114 + 22 + 4 + 18 * 9 + 16, "8 listed + the 외 N개 line");
  assert.equal(confirmHeight(list(50)), confirmHeight(list(9)), "height stops growing past the list cap");
});

test("confirmHeight: notes for new files and skipped conflicts", () => {
  const base = confirmHeight(list(3));
  assert.equal(confirmHeight([item(1), item(2), item(3, "A")]), base + 22);
  assert.equal(confirmHeight([item(1), item(2, "M", true), item(3)]), base + 22);
  assert.equal(confirmHeight([item(1), item(2), item(3, "U")]), 114 + 22 * 2 + 4 + 18 * 3 + 16);
  assert.equal(confirmHeight([item(1, "A"), item(2, "U"), item(3)]), 114 + 22 * 3 + 4 + 18 * 3 + 16);
  assert.equal(confirmHeight([item(1, "U"), item(2)]), 114 + 22 * 2 + 4 + 36 + 16, "one usable + one conflict is still a list");
});

test("dialogWidth", () => {
  assert.equal(dialogWidth([]), 420);
  assert.equal(dialogWidth([item(1)]), 420);
  assert.equal(dialogWidth(list(2)), 480);
});

test("menuLabel", () => {
  assert.equal(menuLabel([]), "Discard");
  assert.equal(menuLabel([item(1)]), "Discard");
  assert.equal(menuLabel(list(2)), "Discard 2 files");
  assert.equal(menuLabel(list(12)), "Discard 12 files");
});

test("confirmModel: single modified, single new, single conflict", () => {
  const mod = confirmModel([item(1)]);
  assert.equal(mod.title, "Discard changes?"); assert.equal(mod.detail, "f1.txt 의 변경을 되돌립니다. 되돌릴 수 없습니다."); assert.equal(mod.conflict, false);
  const fresh = confirmModel([item(1, "A", true)]);
  assert.equal(fresh.title, "Delete file?"); assert.equal(fresh.detail, "f1.txt 파일을 삭제합니다. 되돌릴 수 없습니다.");
  const staged = confirmModel([item(1, "A")]);
  assert.equal(staged.title, "Delete file?");
  const del = confirmModel([item(1, "D")]);
  assert.equal(del.title, "Discard changes?");
  const conflict = confirmModel([item(1, "U")]);
  assert.equal(conflict.conflict, true); assert.equal(conflict.title, "Discard changes?");
  assert.equal(conflict.detail, "충돌 상태의 파일은 Discard 할 수 없습니다. 먼저 충돌을 해결하세요.");
});

test("confirmModel: empty list is treated as a conflict-only dialog", () => {
  const m = confirmModel([]);
  assert.equal(m.conflict, true); assert.match(m.detail, /충돌/);
});

test("confirmModel: two files, plain", () => {
  const m = confirmModel(list(2));
  assert.equal(m.title, "Discard 2 files?");
  assert.equal(m.summary, "2개 파일의 변경을 되돌립니다. 되돌릴 수 없습니다.");
  assert.equal(m.newNote, null); assert.equal(m.conflictNote, null); assert.equal(m.more, null);
  assert.equal(m.listed.length, 2); assert.equal(m.detail, undefined);
});

test("confirmModel: notes for new files and skipped conflicts", () => {
  const m = confirmModel([item(1, "A"), item(2, "M", true), item(3, "U"), item(4)]);
  assert.equal(m.summary, "3개 파일의 변경을 되돌립니다. 되돌릴 수 없습니다.");
  assert.equal(m.newNote, "신규 파일 2개는 삭제되며 되돌릴 수 없습니다.");
  assert.equal(m.conflictNote, "충돌 상태 1개는 건너뜁니다.");
  assert.equal(m.listed.length, 4, "conflicting files are still listed");
});

test("confirmModel: a single usable file next to a conflict stays a multi dialog", () => {
  const m = confirmModel([item(1, "A", true), item(2, "U")]);
  assert.equal(m.title, "Discard 2 files?"); assert.equal(m.newNote, "신규 파일 1개는 삭제되며 되돌릴 수 없습니다.");
});

test("confirmModel: all conflicts, several files", () => {
  const m = confirmModel(list(3, "U"));
  assert.equal(m.conflict, true); assert.equal(m.title, "Discard changes?"); assert.equal(m.listed, undefined);
});

test("confirmModel: list is capped at 8 with 외 N개", () => {
  assert.equal(MAX_LISTED, 8);
  assert.equal(confirmModel(list(8)).more, null);
  assert.equal(confirmModel(list(8)).listed.length, 8);
  const nine = confirmModel(list(9));
  assert.equal(nine.listed.length, 8); assert.equal(nine.more, "외 1개");
  const many = confirmModel(list(25));
  assert.equal(many.more, "외 17개"); assert.equal(many.listed.at(-1).path, "f7.txt");
});

test("confirmModel: file names with spaces, tabs and Korean pass through unchanged", () => {
  const items = [{ path: "공백 있는 파일.txt", status: "M" }, { path: "a\tb.txt", status: "A", fresh: true }];
  const m = confirmModel(items);
  assert.deepEqual(m.listed.map((i) => i.path), ["공백 있는 파일.txt", "a\tb.txt"]);
  assert.match(confirmModel([items[0]]).detail, /^공백 있는 파일\.txt 의/);
});
