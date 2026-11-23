import test from "node:test";
import assert from "node:assert/strict";
import { find, tabProgram, tabLabel, tabText, lightsPadding, panelIsOn } from "../mods/tabs-graph/logic.js";

const prog = (o = {}) => ({ key: "claude", name: "Claude Code", icon: "i.svg", tint: true, tile: null, color: null, shell: false, agent: true, ...o });
const shell = prog({ key: "shell", name: "zsh", agent: false, shell: true, icon: "sh.svg" });
const pane = (o = {}) => ({ pane: "p1", terminal: "t1", tab: "tb1", title: "", cwd: null, branch: null, status: null, app: null, program: shell, focused: false, zoomed: false, movable: false, ...o });
const tab = (o = {}) => ({ id: "tb1", name: "tb1", named: false, active: true, zoomed: false, status: null, ...o });

test("find", () => {
  const root = { id: "r", children: [{ id: "a", children: [{ id: "deep" }] }] };
  assert.equal(find(root, "deep").id, "deep");
  assert.equal(find(root, "x"), null);
  assert.equal(find(undefined, "x"), null);
});

test("tabProgram: 에이전트 pane 우선, 없으면 첫 pane, pane 없으면 undefined", () => {
  const ps = [pane({ pane: "a", program: shell }), pane({ pane: "b", program: prog() }), pane({ pane: "c", tab: "other", program: prog({ name: "X" }) })];
  assert.equal(tabProgram(tab(), ps).name, "Claude Code");
  assert.equal(tabProgram(tab(), [ps[0]]).name, "zsh");
  assert.equal(tabProgram(tab({ id: "none" }), ps), undefined);
  assert.equal(tabProgram(tab(), []), undefined);
});

test("tabLabel: 이름 없는 탭은 에이전트 제목(앞 기호 제거)", () => {
  const ps = [pane({ program: prog(), title: "✳ Fix login bug" })];
  assert.equal(tabLabel(tab({ name: "tb1" }), ps), "Fix login bug");
  assert.equal(tabLabel(tab({ name: "3" }), ps), "Fix login bug");
});

test("tabLabel: named 탭은 탭 이름 그대로", () => {
  const ps = [pane({ program: prog(), title: "Fix login bug" })];
  assert.equal(tabLabel(tab({ name: "docs", named: true }), ps), "docs");
  // named 이고 이름이 tb<번호> 모양이면 프로그램 이름으로 대체
  assert.equal(tabLabel(tab({ name: "tb7", named: true }), ps), "Claude Code");
});

test("tabLabel: 경로형·user@host·프로그램명 제목은 건너뛰고 자동 이름은 프로그램 이름으로", () => {
  for (const title of ["C:\\Users\\hee", "hee@mac:~/proj", "Claude Code", "claude", "", "✳ "]) {
    const ps = [pane({ program: prog(), title })];
    assert.equal(tabLabel(tab({ name: "tb2" }), ps), "Claude Code", JSON.stringify(title));
  }
  // 쉘 pane: 포커스된 pane이 lead
  const sh = [pane({ program: shell, title: "hee@mac: ~", focused: true })];
  assert.equal(tabLabel(tab({ name: "tb1" }), sh), "zsh");
  // 현재 동작 고정: clean()이 앞쪽 "~/"를 먼저 지우므로 "~/proj"는 "proj"로 쓰인다
  assert.equal(tabLabel(tab({ name: "tb1" }), [pane({ program: prog(), title: "~/proj" })]), "proj");
});

test("tabLabel: pane이 없으면 tb<번호>는 Terminal, 아니면 탭 이름", () => {
  assert.equal(tabLabel(tab({ name: "tb4" }), []), "Terminal");
  assert.equal(tabLabel(tab({ name: "5" }), []), "5");
  assert.equal(tabLabel(tab({ name: "dev", named: true }), []), "dev");
});

test("tabLabel: 포커스 없는 쉘 pane은 lead가 아니라 제목이 무시된다", () => {
  const ps = [pane({ program: shell, title: "building", focused: false })];
  assert.equal(tabLabel(tab({ name: "tb1" }), ps), "zsh");
  assert.equal(tabLabel(tab({ name: "tb1" }), [pane({ program: shell, title: "building", focused: true })]), "building");
});

test("tabText: 줌 표시", () => {
  assert.equal(tabText(tab({ zoomed: true }), "x"), "x Z");
  assert.equal(tabText(tab(), "x"), "x");
});

test("lightsPadding: macOS 무타이틀바만 계산, 나머지는 10", () => {
  const root = { traffic_lights: [76, 12], children: [{ id: "sidebar", size: { px: 100 } }] };
  const mac = { platform: "macos", titlebar: "none", fullscreen: false };
  assert.equal(lightsPadding(root, mac, 1), Math.max(10, (76 + 64) / 1 - 100)); // 40
  assert.equal(lightsPadding(root, mac, 2), 10); // (140/2) - 100 < 10
  assert.equal(lightsPadding({ ...root, children: [{ id: "sidebar", hidden: true, size: { px: 100 } }] }, mac, 1), 140);
  assert.equal(lightsPadding({ traffic_lights: [76, 12] }, mac, 1), 140); // 사이드바 없음
  assert.equal(lightsPadding(root, { ...mac, fullscreen: true }, 1), 10);
  assert.equal(lightsPadding(root, { ...mac, platform: "windows" }, 1), 10);
  assert.equal(lightsPadding(root, { ...mac, titlebar: "system" }, 1), 10);
  assert.equal(lightsPadding({ children: [] }, mac, 1), 10); // traffic_lights 없음
  assert.equal(lightsPadding(root, null, 1), 10);
});

test("panelIsOn", () => {
  assert.equal(panelIsOn({ hidden: false }, { active: "files" }, "files"), true);
  assert.equal(panelIsOn({ hidden: true }, { active: "files" }, "files"), false);
  assert.equal(panelIsOn({ hidden: false }, { active: "graph" }, "files"), false);
  assert.equal(panelIsOn(null, { active: "files" }, "files"), false);
  assert.equal(panelIsOn({ hidden: false }, null, "files"), false);
});
