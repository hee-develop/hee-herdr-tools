# herdr-tools

Herdr용 개인 커스텀(mod, 레이아웃, 두 번째 창 실행 스크립트, 알림 헬퍼)을 형상관리하는 저장소입니다. 이 저장소가 원본이고, 설치 스크립트가 herdr 홈으로 **복사**합니다(심볼릭 링크 아님).

## 구성

| 경로 | 설명 |
| --- | --- |
| `mods/hee-agent-list` | 에이전트를 그룹/우선순위 뷰로 보여 주는 사이드바. 하위 에이전트 중 가장 급한 상태가 부모 자리를 차지합니다. (herdr `agents` 복제) |
| `mods/git-changes` | Git 변경 파일 목록과 diff 패널. 다중 선택과 discard 요청을 처리합니다. (herdr `changes` 복제) |
| `mods/my-changes-menu` | Changes 행의 우클릭 메뉴와 Discard 확인 창. |
| `mods/hee-space-list` | space 목록. 고정 색 아바타, worktree 묶음, 머신별 그룹, 브랜치·ahead/behind 표시. (herdr `spaces` 복제) |
| `mods/tabs-graph` | 탭 바. 에이전트 터미널 제목 추적과 윈도우 버튼을 포함합니다. (herdr `tabs` 복제) |
| `mods/branch-switch` | VS Code "Checkout to..."와 같은 브랜치/태그 전환 퀵 픽. 로컬 ref만 사용합니다. |
| `mods/git-graph-branch` | Git 그래프 패널. 브랜치 다중 선택과 "Show only this branch"를 추가한 복제본(아래 서드파티 고지 참고). |
| `mods/mem-bar` | 메모리 사용량(활동 모니터의 "사용된 메모리" 방식)과 Claude Code 사용 한도 게이지. 사용량 영역을 우클릭하면 새로고침 메뉴가 뜹니다. |
| `mods/mem-bar-menu` | mem-bar 사용량 영역의 우클릭 팝업. 사용량이 어느 계정의 값인지, 캐시를 마지막으로 갱신한 뒤 경과 시간, 새로고침 항목을 보여 줍니다. |
| `mods/system-notify` | 에이전트가 사용자 입력 대기/완료 상태가 되었는데 Herdr 창이 비활성이면 macOS 알림을 띄웁니다. 화면에는 아무것도 그리지 않습니다. |
| `layouts/main-window/my-main.json` | 메인 창 레이아웃. |
| `layouts/second-window/my-main.json` | 두 번째 창 레이아웃(`system-notify` 블록 제외). |
| `extensions/herdr-window` | 두 번째 Herdr 창을 띄우는 스크립트. |
| `extensions/notify-helper` | 알림 헬퍼 앱(`herdr-notify.app`)의 Swift 소스, `Info.plist`, 빌드 스크립트(`build.sh`). |
| `extensions/statusline-patch` | Claude Code 상태줄 스크립트 패치(`patch-statusline.sh`). |
| `scripts/` | 설치·동기화 스크립트. |
| `dev/` | 개발용 점검 스크립트(`check-all.sh`, `scan-private.sh`). |
| `tests/` | mod 로직 단위 테스트. |

## 사용법

macOS와 `rsync`, `herdr-app` 명령이 필요합니다. 알림 헬퍼를 빌드하려면 `swiftc`(Xcode Command Line Tools)와 `/Applications/Herdr.app`이 필요합니다.

```sh
sh scripts/herdr-tools.sh status                 # 저장소 vs 설치본 차이 (차이 있으면 종료코드 1)
sh scripts/herdr-tools.sh install --dry-run      # 무엇이 바뀌는지 미리 보기
sh scripts/herdr-tools.sh install                # 저장소 -> herdr 홈 복사
sh scripts/herdr-tools.sh install --skip-notify  # 알림 헬퍼 빌드·설치 건너뛰기
sh scripts/herdr-tools.sh capture                # herdr 홈 -> 저장소 (라이브로 고친 내용 가져오기)
```

- `install`은 덮어쓰거나 지우기 전에 기존 파일을 `~/.local/state/herdr-tools/backup/<타임스탬프>/`에 백업합니다.
- mod는 폴더 단위로 맞추되, herdr가 시작할 때마다 다시 쓰는 `gpui-kit.d.ts`, `herdr.d.ts`, `jsconfig.json`은 비교·삭제 대상에서 제외합니다.
- `capture`는 저장소에 커밋되지 않은 변경이 있으면 경고하고 중단합니다(`--force`로 진행). 저장소 전용 파일(`mods/git-graph-branch/LICENSE`)은 지우지 않습니다.
- 모든 경로는 `$HOME` 기준이며, 테스트용으로 `HERDR_TOOLS_HOME=<임시 루트>`로 대상 루트를 바꿀 수 있습니다. 실제 홈을 건드리지 않고 시험하려면 가짜 홈을 만들어 이 변수로 실행하세요.

설치 후 herdr를 재시작해야 mod 변경이 반영됩니다.

### mem-bar 계정 표시와 상태줄 패치

mem-bar는 Claude Code 상태줄 스크립트가 남기는 캐시(`~/.claude/state/rate-limits.json`)를 읽습니다. 우클릭 메뉴의 계정 표시는 상태줄 스크립트가 이 캐시에 `account`를 함께 기록해야 동작합니다. 상태줄 스크립트는 저장소 밖(`~/.claude`)에 있으므로, 이 저장소의 스크립트로 한 번 패치합니다. 패치하지 않으면 메뉴에 "계정 정보 없음"이 표시됩니다.

```sh
sh extensions/statusline-patch/patch-statusline.sh --check     # 이미 적용돼 있으면 0, 패치가 필요하면 1, 알 수 없는 내용이면 2
sh extensions/statusline-patch/patch-statusline.sh --dry-run   # 바뀔 diff만 출력 (파일은 그대로)
sh extensions/statusline-patch/patch-statusline.sh             # 적용 (적용 전 ~/.local/state/herdr-tools/backup/<타임스탬프>/ 에 백업)
```

- 이미 적용돼 있으면 아무것도 하지 않고, 상태줄 스크립트의 해당 블록이 예상과 다르면 추측해서 고치지 않고 종료코드 2로 멈춥니다.
- 두 번째 계정을 `CLAUDE_CONFIG_DIR`로 쓰는 경우 상태줄은 그 폴더의 `.claude.json`에서 계정을 읽고, 변수가 없으면 `$HOME/.claude.json`을 읽습니다. 읽지 못하면 `account`는 null입니다.
- 대상 경로는 `HERDR_TOOLS_HOME`을 따릅니다.

## 테스트

```sh
npm test          # node --test "tests/**/*.test.js"
npm run check     # dev/check-all.sh: mods/* 각각에 herdr-app check 실행
sh dev/scan-private.sh   # 공개 전 개인정보(절대경로, 이메일, 토큰 패턴) 점검
```

## 두 번째 창 구조

`extensions/herdr-window/herdr-window`는 `HC_SESSION=window2`와 `HERDR_APP_HOME=~/.config/herdr-app-2`를 주어 코어까지 분리된 두 번째 창을 띄웁니다. 두 창은 space·탭·터미널이 서로 보이지 않습니다.

`install`은 두 번째 홈(`~/.config/herdr-app-2`)이 있으면 다음을 맞춥니다.

- `layouts/my-main.json`: `layouts/second-window/my-main.json` 복사본
- `mods/<name>`: 메인 홈의 같은 mod로 향하는 심볼릭 링크 (`system-notify` 제외, 서드파티 `git-graph`는 메인 홈에 있으면 링크 유지)

`keys.json`, `settings.json`은 이 저장소가 관리하지 않습니다. 원본을 고치면 두 번째 홈에도 직접 반영해야 합니다.

## 알림 헬퍼 빌드

```sh
sh extensions/notify-helper/build.sh [out_dir]   # 기본 build/
```

`extensions/notify-helper/src/main.swift`를 `swiftc`로 빌드하고 `Info.plist`를 넣어 `herdr-notify.app`을 만든 뒤 ad-hoc 서명합니다. `Herdr.icns`는 빌드 시점에 `/Applications/Herdr.app`에서 복사하며 저장소에는 포함하지 않습니다(없으면 경고만 하고 아이콘 없이 빌드). `install`은 이 스크립트를 호출해 `~/.local/share/herdr-notify/`에 설치합니다.

## 서드파티 고지

- `mods/git-graph-branch`는 [rabeeh-ta/herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph)(MIT)를 복제해 수정한 것입니다. 원본 라이선스는 `mods/git-graph-branch/LICENSE`에 있습니다.
- 아이콘 일부는 [Lucide](https://lucide.dev)(ISC)를 따라 그렸습니다: `mods/git-graph-branch/icons/LICENSE-lucide.txt`.
- 자세한 내용은 `NOTICE`를 참고하세요. Herdr 자체와 그 아이콘은 이 저장소에 포함되어 있지 않습니다.

## 라이선스

이 저장소에서 새로 작성한 코드는 MIT(`LICENSE`)입니다. 예외는 다음과 같습니다.

- `mods/hee-agent-list`, `mods/git-changes`, `mods/hee-space-list`, `mods/tabs-graph`: Herdr 내장 mod를 수정한 파생물이라 Apache License 2.0을 따릅니다(`LICENSES/Apache-2.0-Herdr.txt`).
- `mods/git-graph-branch`: 원본의 MIT 라이선스(`mods/git-graph-branch/LICENSE`)를 따릅니다.
