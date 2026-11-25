# branch-switch

VS Code의 "Checkout to..."와 같은 브랜치/태그 전환 퀵 픽입니다.

## 무엇을 하나

- `mod.open`으로 열면 화면 위쪽에 팝업(너비 640px, 창 높이의 0.6배까지)이 뜹니다. 레이아웃에 들어가는 mod가 아니라 호출형입니다. 키 바인딩은 이 저장소가 관리하지 않습니다.
- 로컬 브랜치(최근 커밋 순), 원격 브랜치(`HEAD` 제외), 태그를 한 목록에 보여 주고, 입력한 글자로 거릅니다.
- 목록 맨 위에 `+ Create new branch...`, `+ Create new branch from...`, `Checkout detached...` 항목이 있습니다.
- 실행하는 명령은 모두 `git switch` 계열입니다: 로컬 브랜치는 `git switch <이름>`, 로컬에 없는 원격 브랜치는 `git switch --track`, 태그와 detach 모드는 `git switch --detach`, 새 브랜치는 `git switch -c`.
- 로컬 ref만 읽습니다. fetch는 하지 않습니다.
- 성공하면 `Switched to <이름>` 토스트를 띄우고 닫힙니다. 실패하면 git 오류의 앞 6줄을 팝업에 보여 줍니다.
- 대상 폴더는 `props.folder`, 포커스된 pane의 cwd, 활성 space의 pane cwd, space 폴더 순으로 정합니다. 원격 머신의 space면 그 머신에서 git을 실행합니다.

## 조작

| 키 | 동작 |
| --- | --- |
| 위/아래 | 항목 이동(끝에서 순환) |
| Enter | 선택한 항목으로 전환 또는 다음 단계 |
| Esc | 한 단계 뒤로, 첫 화면이면 닫기 |

## 원본

herdr 내장 mod를 복제한 것이 아니라 이 저장소에서 새로 작성한 mod입니다(VS Code의 UI를 본뜸).

## 의존

`git` 명령만 필요합니다. 다른 mod나 extensions에는 의존하지 않습니다.
