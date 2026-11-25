import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "extensions", "statusline-patch", "patch-statusline.sh");
const hasJq = spawnSync("jq", ["--version"]).status === 0;

// 패치 전 상태줄 스크립트의 캐시 기록 블록만 담은 최소 픽스처.
const ORIGINAL = String.raw`#!/bin/bash
input=$(cat)
rate_cache="$HOME/.claude/state/rate-limits.json"
if echo "$input" | jq -e '.rate_limits | type == "object"' >/dev/null 2>&1; then
  mkdir -p "$(dirname "$rate_cache")"
  echo "$input" | jq -c --argjson now "$(date +%s)" '.rate_limits + {updated_at: $now}' \
    > "$rate_cache.tmp.$$" 2>/dev/null && mv -f "$rate_cache.tmp.$$" "$rate_cache"
fi
echo "status line"
`;

// 이메일 정규식(scan-private.sh)에 걸리지 않도록 결합해서 만든다.
const EMAIL_MAIN = ["fake-main", "example.test"].join("@");
const EMAIL_SECOND = ["fake-second", "example.test"].join("@");

function fixture(content = ORIGINAL) {
  const home = mkdtempSync(join(tmpdir(), "patch-statusline-"));
  mkdirSync(join(home, ".claude"), { recursive: true });
  const target = join(home, ".claude", "statusline-command.sh");
  writeFileSync(target, content);
  return { home, target, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

function run(home, ...args) {
  return spawnSync("sh", [SCRIPT, ...args], { env: { ...process.env, HERDR_TOOLS_HOME: home }, encoding: "utf8" });
}

function backups(home) {
  const root = join(home, ".local", "state", "herdr-tools", "backup");
  try {
    return readdirSync(root).map((d) => join(root, d, "statusline-command.sh"));
  } catch {
    return [];
  }
}

test("--dry-run: diff만 출력하고 파일은 바꾸지 않는다", () => {
  const f = fixture();
  try {
    const r = run(f.home, "--dry-run");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\+\s+account=\$\(jq/);
    assert.equal(readFileSync(f.target, "utf8"), ORIGINAL);
    assert.deepEqual(backups(f.home), []);
  } finally { f.cleanup(); }
});

test("적용: 패치된 블록이 들어가고 원래 줄은 사라진다", () => {
  const f = fixture();
  try {
    const r = run(f.home);
    assert.equal(r.status, 0);
    const out = readFileSync(f.target, "utf8");
    assert.match(out, /--arg account "\$account"/);
    assert.match(out, /account: \(if \$account == "" then null else \$account end\)/);
    assert.ok(!out.includes(`'.rate_limits + {updated_at: $now}'`));
    // 블록 밖은 그대로
    assert.ok(out.startsWith(ORIGINAL.split("\n").slice(0, 5).join("\n")));
    assert.ok(out.endsWith('fi\necho "status line"\n'));
  } finally { f.cleanup(); }
});

test("두 번째 실행은 멱등: 이미 적용됨, 파일 불변, 백업 추가 없음", () => {
  const f = fixture();
  try {
    assert.equal(run(f.home).status, 0);
    const once = readFileSync(f.target, "utf8");
    const nBackups = backups(f.home).length;
    const r = run(f.home);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /이미 적용됨/);
    assert.equal(readFileSync(f.target, "utf8"), once);
    assert.equal(backups(f.home).length, nBackups);
  } finally { f.cleanup(); }
});

test("적용 전 원본이 백업 디렉터리에 만들어진다", () => {
  const f = fixture();
  try {
    run(f.home);
    const list = backups(f.home);
    assert.equal(list.length, 1);
    assert.equal(readFileSync(list[0], "utf8"), ORIGINAL);
  } finally { f.cleanup(); }
});

test("알 수 없는 내용이면 종료코드 2, 파일 불변(적용·dry-run·check 모두)", () => {
  for (const content of ["echo hi\n", ORIGINAL.replace("updated_at: $now", "updated_at: $now, x: 1")]) {
    const f = fixture(content);
    try {
      for (const args of [[], ["--dry-run"], ["--check"]]) {
        const r = run(f.home, ...args);
        assert.equal(r.status, 2, args.join(" "));
        assert.equal(readFileSync(f.target, "utf8"), content);
      }
      assert.deepEqual(backups(f.home), []);
    } finally { f.cleanup(); }
  }
});

test("대상 파일이 없으면 종료코드 2", () => {
  const home = mkdtempSync(join(tmpdir(), "patch-statusline-"));
  try {
    assert.equal(run(home).status, 2);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("--check: 패치 필요 1, 적용됨 0", () => {
  const f = fixture();
  try {
    assert.equal(run(f.home, "--check").status, 1);
    assert.equal(readFileSync(f.target, "utf8"), ORIGINAL);
    run(f.home);
    assert.equal(run(f.home, "--check").status, 0);
  } finally { f.cleanup(); }
});

test("알 수 없는 옵션은 종료코드 2", () => {
  const f = fixture();
  try {
    assert.equal(run(f.home, "--nope").status, 2);
  } finally { f.cleanup(); }
});

test("패치된 스크립트 실행: 캐시에 account 기록(CLAUDE_CONFIG_DIR 우선, 없으면 HOME, 못 구하면 null)", { skip: !hasJq && "jq 없음" }, () => {
  const f = fixture();
  try {
    assert.equal(run(f.home).status, 0);
    const input = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 40, resets_at: 2000 }, seven_day: { used_percentage: 21, resets_at: 3000 } } });
    const account = (email) => JSON.stringify({ oauthAccount: { emailAddress: email } });
    const exec = (fakeHome, extraEnv = {}) => {
      const env = { ...process.env, HOME: fakeHome, ...extraEnv };
      if (!("CLAUDE_CONFIG_DIR" in extraEnv)) delete env.CLAUDE_CONFIG_DIR;
      const r = spawnSync("bash", [f.target], { input, env, encoding: "utf8" });
      assert.equal(r.status, 0);
      return JSON.parse(readFileSync(join(fakeHome, ".claude", "state", "rate-limits.json"), "utf8"));
    };

    // 메인: $HOME/.claude.json
    const h1 = mkdtempSync(join(tmpdir(), "patch-statusline-h-"));
    writeFileSync(join(h1, ".claude.json"), account(EMAIL_MAIN));
    const c1 = exec(h1);
    assert.equal(c1.account, EMAIL_MAIN);
    assert.deepEqual(c1.five_hour, { used_percentage: 40, resets_at: 2000 });
    assert.deepEqual(c1.seven_day, { used_percentage: 21, resets_at: 3000 });
    assert.equal(typeof c1.updated_at, "number");

    // 두 번째 계정: CLAUDE_CONFIG_DIR의 .claude.json
    const second = join(h1, "second");
    mkdirSync(second);
    writeFileSync(join(second, ".claude.json"), account(EMAIL_SECOND));
    assert.equal(exec(h1, { CLAUDE_CONFIG_DIR: second }).account, EMAIL_SECOND);

    // .claude.json이 없으면 account는 null이고 나머지는 보존
    const h2 = mkdtempSync(join(tmpdir(), "patch-statusline-h-"));
    const c2 = exec(h2);
    assert.equal(c2.account, null);
    assert.deepEqual(c2.five_hour, { used_percentage: 40, resets_at: 2000 });
    assert.deepEqual(c2.seven_day, { used_percentage: 21, resets_at: 3000 });

    // 깨진 .claude.json도 캐시 쓰기를 막지 않는다
    writeFileSync(join(h2, ".claude.json"), "not json");
    assert.equal(exec(h2).account, null);
    for (const d of [h1, h2]) rmSync(d, { recursive: true, force: true });
  } finally { f.cleanup(); }
});
