# hee-space-list

space(작업 공간) 목록 사이드바입니다.

## 무엇을 하나

- 레이아웃의 사이드바(`sidebar-lists`) 위쪽 `spaces` 블록으로 뜹니다.
- space마다 고정 색 아바타(이름 첫 글자)를 보여 줍니다. 색은 `shared("space.colors")`에 저장되며, 새 space에는 가장 덜 쓰인 팔레트 색을 줍니다.
- worktree space는 본 체크아웃 space 아래로 들여써서 묶고, 목록 순서에 맞게 `space.move`로 space 순서도 옮깁니다.
- 둘 이상의 머신이 있으면 머신별로 묶어 보여 주고, 원격 머신의 재연결을 다룹니다.
- 이름 뒤에 첫 터미널이 있는 저장소의 정보를 보여 줍니다: 브랜치, ahead/behind(저장소 이름이나 `master`/`main`처럼 흔한 값은 생략). 에이전트 상태는 이 목록이 아니라 에이전트 목록(`hee-agent-list`)이 그리고, 이 목록은 무언가 사용자를 기다릴 때만 표시합니다.
- 클릭하면 space로 전환하고, 우클릭 메뉴가 있으며, 끌어서 순서를 바꿀 수 있습니다.
- 사이드바 폭이 160px 미만이면 좁은(레일) 보기로 바뀝니다.

## 원본

herdr 내장 `spaces` mod(0.1.15)를 복제해 수정한 파생물입니다(Apache License 2.0, 루트의 `NOTICE` 참고). 고정 색 아바타, worktree 묶음, 머신별 그룹, 브랜치·ahead/behind 표시가 이 저장소에서 바꾼 부분입니다.

## 의존

- `git` 명령(브랜치와 ahead/behind 조회)과 herdr의 `hc` 명령(머신 목록)을 씁니다.
- 레이아웃에서 `sidebar` 블록의 폭을 읽어 좁은 보기를 정합니다.
