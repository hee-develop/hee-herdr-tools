# hee-agent-list

에이전트 목록 사이드바입니다. 에이전트를 우선순위 또는 space별로 묶어 보여 줍니다.

## 무엇을 하나

- 레이아웃의 사이드바(`sidebar-lists`) 아래쪽 `agents` 블록으로 뜹니다.
- 두 가지 보기: `Priority`(Needs you, Done, Working, Idle 구역 순)와 `Grouped by space`. 헤더의 정렬 버튼이 `Sort agents` 팝업을 열고, 고른 값은 `shared("agents.sort")`에 저장됩니다.
- 하위 에이전트(sub-agent)는 트리 선으로 부모 아래에 보여 주고, 하위 중 가장 급한 상태가 부모 자리를 차지합니다. 접기 화살표로 접으면 개수와 가장 급한 상태 색을 보여 줍니다. 구역 헤더를 눌러도 접습니다.
- 상태 표시: Working은 회전 아이콘, Needs you는 배지, Idle은 빈 원, Done은 점입니다. 상태가 바뀐 시각을 기억해 경과 시간(`<1m`, `5m`, `2h`, `3d`)을 보여 줍니다.
- 확인한 Done 에이전트는 자리를 떠날 때까지 Done 구역에 남습니다.
- 사이드바 폭이 160px 미만이면 하위 에이전트를 숨기는 좁은(레일) 보기로 바뀝니다. 헤더의 버튼은 사이드바 접기 상태(`shared("sidebar.collapsed")`)를 바꿉니다.
- 에이전트를 누르면 그 pane으로 이동하고, pane이 없는 하위 에이전트는 peek으로 엽니다.

## 구조

정렬 메뉴는 같은 mod가 `props.sortMenu: true`로 자기 자신을 팝업으로 열어 그립니다. 순수 로직은 `logic.js`입니다.

## 원본

herdr 내장 `agents` mod(0.1.14)를 복제해 수정한 파생물입니다(Apache License 2.0, 루트의 `NOTICE` 참고). 그룹/우선순위 보기와 하위 에이전트 우선순위 반영이 이 저장소에서 바꾼 부분입니다.

## 의존

- herdr 내장 `workspace-chrome` mod의 아이콘(`mods/workspace-chrome/*.svg`)을 씁니다.
- 레이아웃에서 `sidebar` 블록의 폭을 읽어 좁은 보기를 정합니다.
