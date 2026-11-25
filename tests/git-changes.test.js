import test from "node:test";
import assert from "node:assert/strict";
import {
  countLines, untab, diffRows, parseNumstat, parseChanges, pruneSelection, selectionAfterClick,
  menuTarget, requestItems, discardArgs, discardNote,
} from "../mods/git-changes/logic.js";

const mk = (...paths) => paths.map((path) => ({ path, status: "M", fresh: false }));
const files = mk("a", "b", "c", "d", "e");
const paths = (set) => [...set];

test("countLines", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("a"), 1);
  assert.equal(countLines("a\n"), 1);
  assert.equal(countLines("a\nb"), 2);
  assert.equal(countLines("a\n\n"), 2);
  assert.equal(countLines("\n"), 1);
});

test("untab pads to 4-column stops", () => {
  assert.equal(untab("a\tb"), "a   b");
  assert.equal(untab("\tx"), "    x");
  assert.equal(untab("abcd\tx"), "abcd    x");
  assert.equal(untab("a\t\tb"), "a       b");
  assert.equal(untab("no tabs"), "no tabs");
  assert.equal(untab("한\tb"), "한   b");
});

test("diffRows numbers old/new lines per hunk", () => {
  const rows = diffRows(["@@ -3,2 +10,3 @@ fn", " ctx", "-gone", "+add1", "+add2", "\\ No newline at end of file"]);
  assert.deepEqual(rows, [
    { kind: "@", text: "@@ -3,2 +10,3 @@ fn" },
    { kind: " ", number: 10, text: "ctx" },
    { kind: "-", number: 4, text: "gone" },
    { kind: "+", number: 11, text: "add1" },
    { kind: "+", number: 12, text: "add2" },
    { kind: "", text: "\\ No newline at end of file" },
  ]);
});

test("diffRows: hunk without counts, second hunk resets, empty line and tabs", () => {
  const rows = diffRows(["@@ -1 +1 @@", "-\t", "+", "@@ -20,1 +30,1 @@", "+\tx"]);
  assert.deepEqual(rows[1], { kind: "-", number: 1, text: "    " });
  assert.deepEqual(rows[2], { kind: "+", number: 1, text: " " });
  assert.deepEqual(rows[4], { kind: "+", number: 30, text: "    x" });
  assert.deepEqual(diffRows([]), []);
});

test("parseNumstat sums per path, flags binary, keeps tabs in names", () => {
  const out1 = ["1\t2\ta.txt", "-\t-\timg.png", "3\t0\twith space.txt", "4\t5\ttab\tname.txt", ""].join("\0");
  const out2 = ["10\t1\ta.txt", ""].join("\0");
  const stats = parseNumstat([out1, out2]);
  assert.deepEqual(stats["a.txt"], { add: 11, del: 3, binary: false });
  assert.deepEqual(stats["img.png"], { add: 0, del: 0, binary: true });
  assert.deepEqual(stats["with space.txt"], { add: 3, del: 0, binary: false });
  assert.deepEqual(stats["tab\tname.txt"], { add: 4, del: 5, binary: false });
  assert.deepEqual(parseNumstat([]), {});
  assert.deepEqual(parseNumstat([""]), {});
});

test("parseChanges: statuses from porcelain v1 -z", () => {
  const status = [" M m.txt", "M  staged.txt", "A  new.txt", " D gone.txt", "D  gone2.txt", "?? untracked.txt", "UU both.txt", "AA aa.txt", "DD dd.txt", "AU au.txt", "MD md.txt", ""].join("\0");
  const { files, limited } = parseChanges(status, { "m.txt": { add: 2, del: 1 } });
  assert.equal(limited, false);
  const by = Object.fromEntries(files.map((f) => [f.path, f]));
  assert.equal(by["m.txt"].status, "M"); assert.equal(by["m.txt"].add, 2); assert.equal(by["m.txt"].del, 1);
  assert.equal(by["staged.txt"].status, "M");
  assert.equal(by["new.txt"].status, "A");
  assert.equal(by["gone.txt"].status, "D");
  assert.equal(by["gone2.txt"].status, "D");
  assert.deepEqual([by["untracked.txt"].status, by["untracked.txt"].fresh], ["A", true]);
  for (const p of ["both.txt", "aa.txt", "dd.txt", "au.txt"]) assert.equal(by[p].status, "U", p);
  assert.equal(by["md.txt"].status, "D", "D in either column wins over M");
  assert.deepEqual([by["staged.txt"].add, by["staged.txt"].del], [0, 0], "no stat -> zeros");
});

test("parseChanges: empty status, odd file names, limit", () => {
  assert.deepEqual(parseChanges(""), { files: [], limited: false });
  const { files } = parseChanges([" M 공백 있는 파일.txt", "?? a\tb.txt", ""].join("\0"));
  assert.deepEqual(files.map((f) => f.path), ["공백 있는 파일.txt", "a\tb.txt"]);
  const many = Array.from({ length: 1005 }, (_, i) => `?? f${i}`).join("\0");
  const r = parseChanges(many);
  assert.equal(r.files.length, 1000); assert.equal(r.limited, true);
  const exact = parseChanges(Array.from({ length: 1000 }, (_, i) => `?? f${i}`).join("\0"));
  assert.equal(exact.limited, false);
  assert.equal(parseChanges(many, {}, 3).files.length, 3);
});

test("pruneSelection drops vanished paths and anchor", () => {
  const r = pruneSelection(files, new Set(["a", "zz", "c"]), "zz");
  assert.deepEqual(paths(r.selected), ["a", "c"]); assert.equal(r.anchor, null);
  const keep = pruneSelection(files, new Set(["a"]), "a");
  assert.deepEqual(paths(keep.selected), ["a"]); assert.equal(keep.anchor, "a");
  assert.equal(pruneSelection(files, new Set(), null).anchor, null);
  assert.equal(pruneSelection([], new Set(["a"]), "a").selected.size, 0);
});

test("plain click selects only this row and asks to open its diff", () => {
  const r = selectionAfterClick(files, new Set(["a", "b"]), "a", "c", {});
  assert.deepEqual(paths(r.selected), ["c"]); assert.equal(r.anchor, "c"); assert.equal(r.pick, true);
});

test("cmd click toggles and moves anchor, without opening the diff", () => {
  const on = selectionAfterClick(files, new Set(["a"]), "a", "c", { platform: true });
  assert.deepEqual(paths(on.selected), ["a", "c"]); assert.equal(on.anchor, "c"); assert.equal(on.pick, false);
  const off = selectionAfterClick(files, on.selected, on.anchor, "a", { platform: true });
  assert.deepEqual(paths(off.selected), ["c"]); assert.equal(off.anchor, "a");
  const input = new Set(["a"]);
  selectionAfterClick(files, input, "a", "b", { platform: true });
  assert.deepEqual(paths(input), ["a"], "input set is not mutated");
});

test("shift click: range, reverse range, no anchor, anchor vanished", () => {
  assert.deepEqual(paths(selectionAfterClick(files, new Set(["b"]), "b", "d", { shift: true }).selected), ["b", "c", "d"]);
  const rev = selectionAfterClick(files, new Set(["d"]), "d", "b", { shift: true });
  assert.deepEqual(paths(rev.selected).sort(), ["b", "c", "d"]); assert.equal(rev.anchor, "d", "anchor stays"); assert.equal(rev.pick, false);
  const none = selectionAfterClick(files, new Set(), null, "c", { shift: true });
  assert.deepEqual(paths(none.selected), ["c"]); assert.equal(none.anchor, "c");
  const gone = selectionAfterClick(files, new Set(["x"]), "x", "c", { shift: true });
  assert.deepEqual(paths(gone.selected), ["c"]); assert.equal(gone.anchor, "c");
  const same = selectionAfterClick(files, new Set(["b"]), "b", "b", { shift: true });
  assert.deepEqual(paths(same.selected), ["b"]);
});

test("cmd+shift click adds the range to the selection; plain shift replaces it", () => {
  const add = selectionAfterClick(files, new Set(["a"]), "c", "e", { shift: true, platform: true });
  assert.deepEqual(paths(add.selected).sort(), ["a", "c", "d", "e"]);
  const replace = selectionAfterClick(files, new Set(["a"]), "c", "e", { shift: true });
  assert.deepEqual(paths(replace.selected).sort(), ["c", "d", "e"]);
});

test("menuTarget: row inside the selection acts on the whole selection (file order)", () => {
  const sel = new Set(["d", "b"]);
  const r = menuTarget(files, sel, "b", files[3]);
  assert.equal(r.changed, false); assert.equal(r.selected, sel); assert.equal(r.anchor, "b");
  assert.deepEqual(r.items.map((i) => i.path), ["b", "d"]);
  assert.deepEqual(Object.keys(r.items[0]).sort(), ["fresh", "path", "status"]);
});

test("menuTarget: row outside the selection becomes the selection", () => {
  const r = menuTarget(files, new Set(["a", "b"]), "a", files[4]);
  assert.equal(r.changed, true); assert.deepEqual(paths(r.selected), ["e"]); assert.equal(r.anchor, "e");
  assert.deepEqual(r.items.map((i) => i.path), ["e"]);
  const empty = menuTarget(files, new Set(), null, files[0]);
  assert.deepEqual(empty.items.map((i) => i.path), ["a"]);
});

test("requestItems accepts items[] or the old single form", () => {
  assert.deepEqual(requestItems({ items: [{ path: "a" }] }), [{ path: "a" }]);
  const old = { path: "a", status: "M" };
  assert.deepEqual(requestItems(old), [old]);
  assert.deepEqual(requestItems({}), []);
  assert.deepEqual(requestItems(null), []);
  assert.deepEqual(requestItems({ items: [] , path: "x"}), []);
});

test("discardArgs decides git args", () => {
  assert.deepEqual(discardArgs({ path: "u", fresh: true, status: "A" }, true, false), ["clean", "-f", "--", "u"]);
  assert.deepEqual(discardArgs({ path: "u", fresh: true, status: "A" }, false, false), ["clean", "-f", "--", "u"]);
  assert.deepEqual(discardArgs({ path: "m", status: "M" }, true, true), ["restore", "--source=HEAD", "--staged", "--worktree", "--", "m"]);
  assert.deepEqual(discardArgs({ path: "n", status: "A" }, true, false), ["rm", "-f", "--", "n"]);
  assert.deepEqual(discardArgs({ path: "n", status: "A" }, false, false), ["rm", "-f", "--", "n"]);
  assert.deepEqual(discardArgs({ path: "d", status: "D" }, false, false), ["rm", "-f", "--", "d"]);
  assert.throws(() => discardArgs({ path: "m", status: "M" }, false, false), /no HEAD to restore from/);
  assert.deepEqual(discardArgs({ path: "-rf", status: "M" }, true, true).slice(-2), ["--", "-rf"], "paths come after --");
});

test("discardNote", () => {
  assert.equal(discardNote([], 3), null);
  assert.equal(discardNote([{ path: "a", reason: "boom" }], 1), "Discard failed: boom");
  assert.equal(discardNote([{ path: "a", reason: "boom" }], 2), "1개 실패: a (boom)");
  const four = ["a", "b", "c", "d"].map((path) => ({ path, reason: "r" }));
  assert.equal(discardNote(four, 4), "4개 실패: a (r), b (r), c (r) 외 1개");
  assert.equal(discardNote(four.slice(0, 3), 5), "3개 실패: a (r), b (r), c (r)");
  const long = "x".repeat(61);
  assert.equal(discardNote([{ path: "a", reason: long }], 2), `1개 실패: a (${"x".repeat(60)}…)`);
  assert.equal(discardNote([{ path: "a", reason: "x".repeat(60) }], 2), `1개 실패: a (${"x".repeat(60)})`);
});
