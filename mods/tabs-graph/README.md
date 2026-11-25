# tabs-graph

탭 바입니다. 에이전트가 보고하는 터미널 제목을 탭 이름으로 보여 주고, 옆 패널 버튼과 창 버튼을 함께 그립니다.

## 무엇을 하나

- 레이아웃의 `tabs` 블록으로 뜹니다. 활성 space의 탭을 보여 줍니다.
- 이름 붙이지 않은 탭은 에이전트가 보고한 제목(예: Claude Code의 세션 이름)을 이름으로 씁니다. 경로, `user@host`, 프로그램 이름 같은 제목은 건너뛰고, 직접 이름 붙인 탭은 그대로 둡니다. 줌된 탭은 이름 뒤에 ` Z`가 붙습니다.
- 탭마다 프로그램 아이콘, 작업 중 회전 아이콘, Needs you/Done 점을 보여 줍니다. 활성 탭에는 닫기 버튼이 있습니다.
- 오른쪽에 `Files`, `Changes`, `Git` 옆 패널 토글 버튼(`Files`와 `Changes`는 `shared("workspace.panels")`에 있을 때만, 값이 없으면 둘 다 표시)과 창 버튼(최소화, 최대화, 닫기)이 있습니다. 옆 패널 선택은 space별로 기억합니다.
- macOS 신호등 버튼 때문에 사이드바 폭에 맞춰 왼쪽 여백을 계산합니다.

## 조작

- 탭 클릭: 선택. 두 번 클릭: 이름 변경. 끌어서 순서 이동. 우클릭: 탭 메뉴. 바 위에서 휠: 이전/다음 탭.
- `+`: 새 탭 메뉴.

## 원본

herdr 내장 `tabs` mod(0.1.14)를 복제해 수정한 파생물입니다(Apache License 2.0, 루트의 `NOTICE` 참고). 터미널 제목 추적과 창 버튼이 이 저장소에서 바꾼 부분입니다.

## 의존

- 레이아웃의 `panel`, `panel-body`, `sidebar` 블록 id를 읽고 `layout.show`/`layout.select`로 옆 패널을 조작합니다.
- 아이콘은 herdr 내장 mod(`files`, `changes`, `pane`, `workspace-chrome`, `menu`, `new-menu`)와 서드파티 `git-graph` mod의 `icons/graph.svg`를 씁니다. `Git` 버튼 아이콘 경로는 `mods/git-graph/icons/graph.svg`로 고정돼 있어, 이 저장소의 `git-graph-branch`가 아니라 herdr 홈에 설치된 `git-graph` mod를 참조합니다.
