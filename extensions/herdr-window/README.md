# herdr-window

두 번째 Herdr 창을 띄우는 스크립트입니다. herdr가 창을 둘 이상 띄우는 기능을 제공하지 않아 바깥에서 환경변수로 분리해 구현했습니다.

## 무엇을 하나

`herdr-window`는 다음 두 환경변수를 주고 `/Applications/Herdr.app`을 하나 더 실행합니다.

- `HC_SESSION=window2`: 코어 세션을 분리합니다. space, 탭, 터미널이 기본 창과 서로 보이지 않습니다.
- `HERDR_APP_HOME=~/.config/herdr-app-2`: 설정 홈을 분리합니다.

Claude Code 세션 안에서 실행해도 그 세션의 환경변수(`CLAUDE_CODE_CHILD_SESSION` 등)가 새 창의 터미널로 새지 않도록, `CLAUDE*`와 `ANTHROPIC*` 변수는 지우고 띄웁니다.

## 설치

일괄 설치 `sh scripts/hee-herdr-tools.sh install`이 다음을 합니다.

- `extensions/herdr-window/herdr-window`를 `~/.local/bin/herdr-window`로 복사합니다(실행 권한 755).
- 두 번째 홈(`~/.config/herdr-app-2`)이 있으면 그 안을 맞춥니다.
  - `layouts/my-main.json`: `layouts/second-window/my-main.json` 복사본
  - `mods/<name>`: 메인 홈(`~/.config/herdr-app`)의 같은 mod로 향하는 심볼릭 링크. `system-notify`는 제외하고(알림은 메인 창에서만), 메인 홈에 서드파티 `git-graph`가 있으면 그것도 링크합니다.
- 덮어쓰거나 바꾸기 전의 파일은 `~/.local/state/hee-herdr-tools/backup/<타임스탬프>/`에 백업합니다.

`keys.json`, `settings.json`은 이 저장소가 관리하지 않습니다. 원본을 고치면 두 번째 홈에도 직접 반영해야 합니다.

단독으로 쓰려면 스크립트를 그대로 실행하거나(`sh extensions/herdr-window/herdr-window`), 원하는 PATH 위치에 복사해 실행 권한을 주면 됩니다. 이 경우 두 번째 홈의 레이아웃과 mod 링크는 직접 준비해야 합니다.

## 요구 사항

- macOS와 `/Applications/Herdr.app`.
- 두 번째 홈에 레이아웃과 mod가 있어야 정상적인 화면이 나옵니다(일괄 설치가 맞춰 줍니다).

## 되돌리기

`~/.local/bin/herdr-window`를 지우고, `~/.config/herdr-app-2/mods/` 아래의 링크와 `layouts/my-main.json`을 지우거나 백업에서 복원합니다.
