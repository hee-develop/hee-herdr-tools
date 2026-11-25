# git-graph-branch

Git 커밋 그래프 패널입니다.

## 무엇을 하나

- 레이아웃의 옆 패널(`panel-body`) 안 `graph` 블록으로 뜹니다. pane으로 열 수도 있습니다.
- 커밋 그래프와 열(Graph, Description, Date, Author, Commit)을 보여 줍니다. 상단 구간 버튼으로 범위를 고릅니다: `All branches`, `Current`, `Branches`(브랜치 다중 선택, 선택 수 표시).
- 행·브랜치·태그를 우클릭하면 메뉴가 뜹니다. 항목은 대상에 따라 다릅니다: Checkout, Create branch, Rename/Delete branch, Delete remote branch, Push branch, Pull, Fetch, Cherry pick, Revert, Commit, Stash/Reset uncommitted changes, Add/Delete/Push tag, 이름·해시·제목·경로 복사, New terminal tab, Show in Changes panel 등. 되돌리기 어려운 동작은 확인 대화상자를 먼저 띄웁니다.
- 톱니 버튼의 설정 팝업: 보일 열, 파일 diff를 여는 위치(패널 안, 오른쪽 분할, 아래 분할, 새 탭, 창), Manygit 탐색 깊이(1에서 5), 행에 최신 태그를 보일지.
- Manygit: git 저장소가 아닌 폴더에서는 그 아래 저장소 목록을 찾아 보여 주고, 저장소를 열거나 일괄 fetch 할 수 있습니다.
- 한 mod가 `props.role` 값(`menu`, `dialog`, `update`, `settings`, `diff`)에 따라 우클릭 메뉴, 대화상자, 설정, 파일 전체 크기 diff 화면도 그립니다.

## 원본과 변경점

[rabeeh-ta/herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph)(MIT, 코드 안의 버전 0.3.2)를 복사해 수정한 서드파티 복제본입니다. 원본 라이선스는 이 폴더의 `LICENSE`, 아이콘 일부의 출처는 `icons/LICENSE-lucide.txt`, 전체 고지는 루트의 `NOTICE`에 있습니다.

이 저장소에서 바꾼 부분:

- 브랜치 다중 선택(`Branches` 구간)
- 브랜치 메뉴의 `Show only this branch`
- 업데이트 확인 끄기(`update.js`의 `CHECK = false`: 원본 저장소에 요청을 보내지 않음)

`tests/git-graph-branch*.test.js`의 일부는 원본 저장소의 테스트를 옮긴 것입니다.

## 의존

- `git` 명령이 필요합니다.
- `Show in Changes panel`은 옆 패널 스택(`panel-body`)의 `changes` 자식을 선택하므로, `mods/git-changes`가 그 자리에 있는 레이아웃을 전제로 합니다. 메뉴 아이콘은 herdr의 `mods/changes/changes.svg`를 씁니다.
