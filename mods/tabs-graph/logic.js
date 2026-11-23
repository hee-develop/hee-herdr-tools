// Modified from Herdr's bundled `tabs` mod (Apache License 2.0); see NOTICE.
// tabs-graph의 순수 로직: 탭 이름·아이콘 프로그램 결정, 신호등 여백 계산. herdr·gpui 의존 없음.

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// 탭 아이콘용 프로그램: 탭의 에이전트 pane, 없으면 첫 pane의 program. ps: panes().
export function tabProgram(tab, ps) {
  return ps.find((p) => p.tab === tab.id && p.program?.agent)?.program ?? ps.find((p) => p.tab === tab.id)?.program;
}

// 탭 이름: 이름 없는 탭은 에이전트가 보고한 제목(Claude Code의 세션 이름)을 보여 준다.
// 경로·user@host·프로그램 이름 같은 제목은 건너뛰고, 직접 이름 붙인 탭은 그대로 둔다.
// 자동 이름(tb<번호>)은 프로그램 이름(없으면 "Terminal")으로 바꾼다.
export function tabLabel(tab, ps) {
  const program = tabProgram(tab, ps);
  const lead = ps.find((p) => p.tab === tab.id && p.program?.agent) ?? ps.find((p) => p.tab === tab.id && p.focused);
  const live = (lead?.title ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const telling = live && live !== lead?.program?.name && live.toLowerCase() !== lead?.program?.key && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@");
  return !tab.named && telling ? live : /^tb\d+$/.test(tab.name) ? program?.name ?? "Terminal" : tab.name;
}

// 줌된 탭은 이름 뒤에 " Z".
export const tabText = (tab, name) => (tab.zoomed ? `${name} Z` : name);

// macOS 신호등 버튼 때문에 탭 바 왼쪽에 둘 여백(px).
// root: layout(), w: window(), zoom: settings().zoom.
// Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
export function lightsPadding(root, w, zoom) {
  const sidebar = find(root, "sidebar");
  return w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
    ? Math.max(10, (root.traffic_lights[0] + 64) / zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
    : 10;
}

// 옆 패널 버튼이 켜져 있는가: 패널이 보이고 그 스택의 활성 자식이 id.
export const panelIsOn = (panel, body, id) => Boolean(panel && !panel.hidden && body?.active === id);
