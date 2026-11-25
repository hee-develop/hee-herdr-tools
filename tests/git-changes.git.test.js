// Runs the discard args git-changes decides (logic.js) against real throwaway repos, with
// `git --literal-pathspecs` as main.js does, and checks only the intended file changes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseChanges, discardArgs } from "../mods/git-changes/logic.js";

const env = { ...process.env, GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const git = (cwd, args) => { const r = spawnSync("git", args, { cwd, env, encoding: "utf8" }); return { code: r.status, stdout: r.stdout, stderr: r.stderr }; };
const sh = (cwd, ...args) => { const r = git(cwd, args); assert.equal(r.code, 0, `git ${args.join(" ")}: ${r.stderr}`); return r.stdout; };

const dirs = [];
async function repo({ commit = true } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "git-changes-git-"));
  dirs.push(dir);
  sh(dir, "init", "-q", "-b", "main");
  if (commit) {
    await fs.writeFile(path.join(dir, "keep.txt"), "keep\n");
    await fs.writeFile(path.join(dir, "tracked.txt"), "v1\n");
    sh(dir, "add", "."); sh(dir, "commit", "-qm", "init");
  }
  return dir;
}
test.after(async () => { for (const d of dirs) await fs.rm(d, { recursive: true, force: true }); });

// What main.js does for one file: look the state up, then run the args discardArgs decides.
function status(dir) { return parseChanges(sh(dir, "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all")).files; }
function discard(dir, p) {
  const file = status(dir).find((f) => f.path === p);
  assert.ok(file, `${p} has changes`);
  const hasHead = git(dir, ["rev-parse", "--verify", "HEAD"]).code === 0;
  const lit = (args) => git(dir, ["--literal-pathspecs", ...args]);
  const inHead = file.fresh || !hasHead ? false : lit(["cat-file", "-e", `HEAD:${p}`]).code === 0;
  const args = discardArgs(file, hasHead, inHead);
  const r = lit(args);
  assert.equal(r.code, 0, r.stderr);
  return args;
}
const exists = (dir, p) => fs.access(path.join(dir, p)).then(() => true, () => false);
const read = (dir, p) => fs.readFile(path.join(dir, p), "utf8");

test("modified file is restored, others are left alone", async () => {
  const d = await repo();
  await fs.writeFile(path.join(d, "tracked.txt"), "v2\n");
  await fs.writeFile(path.join(d, "keep.txt"), "edited\n");
  discard(d, "tracked.txt");
  assert.equal(await read(d, "tracked.txt"), "v1\n");
  assert.equal(await read(d, "keep.txt"), "edited\n");
  assert.deepEqual(status(d).map((f) => f.path), ["keep.txt"]);
});

test("staged modification is unstaged and restored", async () => {
  const d = await repo();
  await fs.writeFile(path.join(d, "tracked.txt"), "v2\n"); sh(d, "add", "tracked.txt");
  await fs.writeFile(path.join(d, "tracked.txt"), "v3\n");
  discard(d, "tracked.txt");
  assert.equal(await read(d, "tracked.txt"), "v1\n");
  assert.deepEqual(status(d), []);
});

test("deleted file (unstaged and staged) comes back", async () => {
  const d = await repo();
  await fs.rm(path.join(d, "tracked.txt"));
  discard(d, "tracked.txt");
  assert.equal(await read(d, "tracked.txt"), "v1\n");
  sh(d, "rm", "-q", "keep.txt");
  assert.equal(status(d)[0].status, "D");
  discard(d, "keep.txt");
  assert.equal(await read(d, "keep.txt"), "keep\n");
  assert.deepEqual(status(d), []);
});

test("staged add (not in HEAD) is removed from index and disk; modified one stays", async () => {
  const d = await repo();
  await fs.writeFile(path.join(d, "new.txt"), "n\n"); sh(d, "add", "new.txt");
  await fs.writeFile(path.join(d, "tracked.txt"), "v2\n");
  const args = discard(d, "new.txt");
  assert.deepEqual(args.slice(0, 2), ["rm", "-f"]);
  assert.equal(await exists(d, "new.txt"), false);
  assert.deepEqual(status(d).map((f) => f.path), ["tracked.txt"]);
});

test("untracked file is cleaned, other untracked files stay", async () => {
  const d = await repo();
  await fs.writeFile(path.join(d, "u1.txt"), "1");
  await fs.writeFile(path.join(d, "u2.txt"), "2");
  const args = discard(d, "u1.txt");
  assert.deepEqual(args, ["clean", "-f", "--", "u1.txt"]);
  assert.equal(await exists(d, "u1.txt"), false);
  assert.equal(await exists(d, "u2.txt"), true);
});

test("no HEAD: staged add is removed, untracked is cleaned, other staged files stay", async () => {
  const d = await repo({ commit: false });
  await fs.writeFile(path.join(d, "a.txt"), "a"); await fs.writeFile(path.join(d, "b.txt"), "b"); await fs.writeFile(path.join(d, "u.txt"), "u");
  sh(d, "add", "a.txt", "b.txt");
  assert.deepEqual(discard(d, "a.txt").slice(0, 2), ["rm", "-f"]);
  assert.equal(await exists(d, "a.txt"), false);
  assert.equal(await exists(d, "b.txt"), true);
  assert.deepEqual(discard(d, "u.txt").slice(0, 2), ["clean", "-f"]);
  assert.equal(await exists(d, "u.txt"), false);
  assert.deepEqual(status(d).map((f) => f.path), ["b.txt"]);
});

test("no HEAD: a status that cannot be restored throws instead of running git", () => {
  assert.throws(() => discardArgs({ path: "x", status: "M", fresh: false }, false, false), /no HEAD/);
});

test("wildcard names are literal: g*.txt does not touch gx.txt", async () => {
  const d = await repo();
  await fs.writeFile(path.join(d, "g*.txt"), "star-v1\n");
  await fs.writeFile(path.join(d, "gx.txt"), "x-v1\n");
  sh(d, "add", "."); sh(d, "commit", "-qm", "globs");
  await fs.writeFile(path.join(d, "g*.txt"), "star-v2\n");
  await fs.writeFile(path.join(d, "gx.txt"), "x-v2\n");
  discard(d, "g*.txt");
  assert.equal(await read(d, "g*.txt"), "star-v1\n");
  assert.equal(await read(d, "gx.txt"), "x-v2\n", "gx.txt keeps its edit");
});

test("wildcard names are literal for untracked and staged-add files too", async () => {
  const d = await repo();
  await fs.writeFile(path.join(d, "gx.txt"), "x"); await fs.writeFile(path.join(d, "gy.txt"), "y");
  await fs.writeFile(path.join(d, "g*.txt"), "star");
  discard(d, "g*.txt");
  assert.equal(await exists(d, "g*.txt"), false);
  assert.equal(await exists(d, "gx.txt"), true); assert.equal(await exists(d, "gy.txt"), true);
  await fs.writeFile(path.join(d, "g*.txt"), "star"); sh(d, "add", "--", "g*.txt");
  discard(d, "g*.txt");
  assert.equal(await exists(d, "g*.txt"), false);
  assert.equal(await exists(d, "gx.txt"), true);
});

test("names with spaces, tabs, Korean, and a leading dash are handled", async () => {
  const d = await repo();
  const names = ["공백 있는 파일.txt", "tab\tname.txt", "-dash.txt", "한글.txt"];
  for (const n of names) await fs.writeFile(path.join(d, n), "v1\n");
  sh(d, "add", "--", ...names); sh(d, "commit", "-qm", "names");
  for (const n of names) await fs.writeFile(path.join(d, n), "v2\n");
  await fs.writeFile(path.join(d, "tracked.txt"), "v2\n");
  for (const n of names) discard(d, n);
  for (const n of names) assert.equal(await read(d, n), "v1\n", JSON.stringify(n));
  assert.equal(await read(d, "tracked.txt"), "v2\n");
});

test("a file in a subfolder and a sibling with the same prefix", async () => {
  const d = await repo();
  await fs.mkdir(path.join(d, "sub"));
  await fs.writeFile(path.join(d, "sub", "a.txt"), "1\n"); await fs.writeFile(path.join(d, "sub", "ab.txt"), "1\n");
  sh(d, "add", "."); sh(d, "commit", "-qm", "sub");
  await fs.writeFile(path.join(d, "sub", "a.txt"), "2\n"); await fs.writeFile(path.join(d, "sub", "ab.txt"), "2\n");
  discard(d, "sub/a.txt");
  assert.equal(await read(d, "sub/a.txt"), "1\n"); assert.equal(await read(d, "sub/ab.txt"), "2\n");
});
