// Tests for what git-graph-branch adds over rabeeh-ta/herdr-git-graph: picked branches ("Branches" mode)
// and the "Show only this branch" menu item. Pure functions from mods/git-graph-branch/git.js.
import test from "node:test";
import assert from "node:assert/strict";
import { pickedRefs, logArgs, menuFor } from "../mods/git-graph-branch/git.js";

test("pickedRefs keeps only valid refs/heads and refs/remotes names", () => {
  assert.deepEqual(pickedRefs(["refs/heads/main", "refs/remotes/origin/fix", "refs/tags/v1", "main"]), ["refs/heads/main", "refs/remotes/origin/fix"]);
  assert.deepEqual(pickedRefs(["refs/heads/--evil", "refs/heads/a..b", "refs/heads/", "refs/heads/x.lock", "refs/heads/a b", "refs/heads/-x", "refs/heads//x"]), []);
  assert.deepEqual(pickedRefs(["refs/heads/feature/한글"]), ["refs/heads/feature/한글"]);
});

test("pickedRefs tolerates non-arrays and non-strings", () => {
  assert.deepEqual(pickedRefs(undefined), []);
  assert.deepEqual(pickedRefs(null), []);
  assert.deepEqual(pickedRefs("refs/heads/main"), []);
  assert.deepEqual(pickedRefs([1, null, {}, "refs/heads/ok"]), ["refs/heads/ok"]);
});

test("logArgs: branches mode walks only the picked refs", () => {
  const args = logArgs({ mode: "branches", refs: ["refs/heads/a", "refs/remotes/origin/b"], limit: 50 });
  assert.deepEqual(args.slice(0, 5), ["log", "-z", "--ignore-missing", "refs/heads/a", "refs/remotes/origin/b"]);
  assert.ok(args.includes("-n50"));
});

test("logArgs: branches mode with nothing valid falls back to HEAD", () => {
  assert.deepEqual(logArgs({ mode: "branches", refs: [], limit: 5 }).slice(0, 3), ["log", "-z", "HEAD"]);
  assert.deepEqual(logArgs({ mode: "branches", refs: ["refs/tags/v1"], limit: 5 }).slice(0, 3), ["log", "-z", "HEAD"]);
});

test("logArgs: all / current / legacy `all` flag, remotes toggle", () => {
  const all = logArgs({ mode: "all", remotes: true, limit: 1 });
  assert.ok(all.includes("--branches") && all.includes("--tags") && all.includes("--remotes") && !all.includes("--all"));
  assert.ok(!logArgs({ mode: "all", remotes: false, limit: 1 }).includes("--remotes"));
  assert.deepEqual(logArgs({ mode: "current", limit: 1 }).slice(0, 3), ["log", "-z", "HEAD"]);
  assert.deepEqual(logArgs({ all: false, limit: 1 }).slice(0, 3), ["log", "-z", "HEAD"]);
  assert.ok(logArgs({ all: true, remotes: false, limit: 1 }).includes("--branches"));
});

test("menuFor: branch labels offer Show only this branch with the full ref", () => {
  const hash = "a".repeat(40);
  const ctx = { current: "main", remotes: ["origin"], branches: ["main", "fix"], dirty: false };
  const local = menuFor({ kind: "branch", name: "fix", commit: { hash, parents: [] } }, ctx).find((i) => i.action?.type === "filterBranch");
  assert.equal(local.action.ref, "refs/heads/fix");
  const remote = menuFor({ kind: "remote", name: "origin/fix", commit: { hash, parents: [] } }, ctx).find((i) => i.action?.type === "filterBranch");
  assert.equal(remote.action.ref, "refs/remotes/origin/fix");
});
