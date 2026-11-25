# hee-herdr-tools

Herdr용 개인 커스텀 mod, 레이아웃, 바깥 기능(두 번째 창, 알림 헬퍼, 상태줄 패치)을 형상관리하는 저장소입니다. 이 저장소가 원본이고, 설치 스크립트가 herdr 홈으로 **복사**합니다(심볼릭 링크 아님).

## 폴더 구조

| 경로 | 설명 |
| --- | --- |
| `mods/` | herdr mod(herdr 기능). 폴더마다 `README.md`가 있습니다. |
| `extensions/` | herdr가 지원하지 않아 바깥에 구현한 기능. 폴더마다 `README.md`가 있습니다. |
| `layouts/` | 메인 창(`main-window`)과 두 번째 창(`second-window`)의 `my-main.json` 레이아웃. 두 번째 창에는 `system-notify` 블록이 없습니다. |
| `scripts/` | 설치·동기화 스크립트(`hee-herdr-tools.sh`). |
| `dev/` | 개발용 점검 스크립트(`check-all.sh`, `scan-private.sh`). |
| `tests/` | mod 로직과 스크립트의 단위 테스트. |

## 기능 목록

### mods

| mod | 설명 |
| --- | --- |
| [branch-switch](mods/branch-switch/README.md) | VS Code "Checkout to..."와 같은 브랜치/태그 전환 퀵 픽 |
| [git-changes](mods/git-changes/README.md) | Git 변경 파일 목록, diff, 커밋, 다중 선택 Discard 패널 |
| [git-graph-branch](mods/git-graph-branch/README.md) | Git 그래프 패널(서드파티 복제본, 브랜치 다중 선택 추가) |
| [hee-agent-list](mods/hee-agent-list/README.md) | 에이전트를 우선순위/space별로 묶어 보여 주는 사이드바 |
| [hee-space-list](mods/hee-space-list/README.md) | 고정 색 아바타, worktree 묶음, 브랜치 표시가 있는 space 목록 |
| [mem-bar](mods/mem-bar/README.md) | 메모리 사용량과 Claude Code 사용 한도 게이지 |
| [system-notify](mods/system-notify/README.md) | 에이전트 입력 대기/완료 시 macOS 알림 |
| [tabs-graph](mods/tabs-graph/README.md) | 터미널 제목 추적과 창 버튼이 있는 탭 바 |

### extensions

| 기능 | 설명 |
| --- | --- |
| [herdr-window](extensions/herdr-window/README.md) | 코어까지 분리된 두 번째 Herdr 창 실행 |
| [notify-helper](extensions/notify-helper/README.md) | space별로 묶이는 macOS 알림 헬퍼 앱 빌드·설치 |
| [statusline-patch](extensions/statusline-patch/README.md) | Claude Code 상태줄 스크립트에 계정 기록 추가 |

## 일괄 설치와 동기화

macOS와 `rsync`, `herdr-app` 명령이 필요합니다. 알림 헬퍼를 빌드하려면 `swiftc`(Xcode Command Line Tools)와 `/Applications/Herdr.app`도 필요합니다.

```sh
sh scripts/hee-herdr-tools.sh status                 # 저장소 vs 설치본 차이 (차이 있으면 종료코드 1)
sh scripts/hee-herdr-tools.sh install --dry-run      # 무엇이 바뀌는지 미리 보기
sh scripts/hee-herdr-tools.sh install                # 저장소 -> herdr 홈 복사
sh scripts/hee-herdr-tools.sh install --skip-notify  # 알림 헬퍼 빌드·설치 건너뛰기
sh scripts/hee-herdr-tools.sh capture                # herdr 홈 -> 저장소 (라이브로 고친 내용 가져오기)
```

`install`이 놓는 것:

- `mods/<name>` -> `~/.config/herdr-app/mods/<name>`
- `layouts/main-window/my-main.json` -> `~/.config/herdr-app/layouts/my-main.json`
- `extensions/herdr-window/herdr-window` -> `~/.local/bin/herdr-window`
- 두 번째 홈(`~/.config/herdr-app-2`)이 있으면 그 레이아웃과 mod 링크
- 알림 헬퍼 앱 -> `~/.local/share/herdr-notify/`

상태줄 패치(`extensions/statusline-patch`)는 일괄 설치에 포함되지 않습니다. 각 항목의 자세한 내용은 해당 README를 보세요. 설치 후 herdr를 재시작해야 mod 변경이 반영됩니다.

- **백업**: `install`은 덮어쓰거나 지우기 전에 기존 파일을 `~/.local/state/hee-herdr-tools/backup/<타임스탬프>/`에 백업합니다.
- **제외 파일**: mod는 폴더 단위로 맞추되, herdr가 시작할 때마다 다시 쓰는 `gpui-kit.d.ts`, `herdr.d.ts`, `jsconfig.json`과 `.DS_Store`는 비교·삭제 대상에서 제외합니다. 저장소 문서인 `README.md`도 제외하므로 herdr 홈으로 복사되지 않고, `capture`가 저장소의 README를 지우지도 않습니다.
- **capture**: 저장소에 커밋되지 않은 변경이 있으면 경고하고 중단합니다(`--force`로 진행). 저장소 전용 파일(`mods/git-graph-branch/LICENSE`)은 지우지 않습니다.
- **가짜 홈으로 시험**: 모든 경로는 `$HOME` 기준이며, `HEE_HERDR_TOOLS_HOME=<임시 루트>`로 대상 루트를 바꿀 수 있습니다. 실제 홈을 건드리지 않고 시험하려면 가짜 홈을 만들어 이 변수로 실행하세요.

## 테스트

```sh
npm test                     # node --test "tests/**/*.test.js"
npm run check                # dev/check-all.sh: mods/* 각각에 herdr-app check 실행
sh dev/scan-private.sh       # 공개 전 개인정보(절대경로, 이메일, 토큰 패턴) 점검
```

## 서드파티 고지

- `mods/git-graph-branch`는 [rabeeh-ta/herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph)(MIT)를 복제해 수정한 것입니다. 원본 라이선스는 `mods/git-graph-branch/LICENSE`에 있습니다.
- 아이콘 일부는 [Lucide](https://lucide.dev)(ISC)를 따라 그렸습니다: `mods/git-graph-branch/icons/LICENSE-lucide.txt`.
- 자세한 내용은 `NOTICE`를 참고하세요. Herdr 자체와 그 아이콘은 이 저장소에 포함되어 있지 않습니다.

## 라이선스

이 저장소에서 새로 작성한 코드는 MIT(`LICENSE`)입니다. 예외는 다음과 같습니다.

- `mods/hee-agent-list`, `mods/git-changes`, `mods/hee-space-list`, `mods/tabs-graph`: Herdr 내장 mod를 수정한 파생물이라 Apache License 2.0을 따릅니다(`LICENSES/Apache-2.0-Herdr.txt`).
- `mods/git-graph-branch`: 원본의 MIT 라이선스(`mods/git-graph-branch/LICENSE`)를 따릅니다.
