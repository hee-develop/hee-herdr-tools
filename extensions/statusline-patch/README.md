# statusline-patch

Claude Code 상태줄 스크립트가 `rate-limits.json` 캐시에 계정(`account`)을 함께 기록하도록 고치는 스크립트입니다. `mods/mem-bar`의 계정 표시가 이 값에 의존합니다.

## 무엇을 하나

`mods/mem-bar`는 Claude Code 상태줄 스크립트가 남기는 캐시(`~/.claude/state/rate-limits.json`)를 읽습니다. 우클릭 메뉴가 사용량이 어느 계정의 값인지 보여 주려면 상태줄 스크립트가 이 캐시에 `account`를 함께 기록해야 합니다. 상태줄 스크립트는 저장소 밖(`~/.claude/statusline-command.sh`)에 있으므로 이 스크립트로 한 번 패치합니다. 패치하지 않으면 메뉴에 `계정 정보 없음`이 표시됩니다.

패치 후 상태줄은 `CLAUDE_CONFIG_DIR`가 있으면 그 폴더의 `.claude.json`에서, 없으면 `$HOME/.claude.json`에서 이메일을 읽어 캐시에 `account`로 씁니다. 읽지 못하면 `account`는 null입니다(두 번째 계정을 `CLAUDE_CONFIG_DIR`로 쓰는 경우도 같은 방식입니다).

## 설치

일괄 설치 `sh scripts/hee-herdr-tools.sh install`은 이 패치를 적용하지 않습니다. 저장소 밖(`~/.claude`) 파일이라 이 스크립트를 직접 실행해야 합니다.

```sh
sh extensions/statusline-patch/patch-statusline.sh --check     # 이미 적용돼 있으면 0, 패치가 필요하면 1, 알 수 없는 내용이면 2
sh extensions/statusline-patch/patch-statusline.sh --dry-run   # 바뀔 diff만 출력 (파일은 그대로)
sh extensions/statusline-patch/patch-statusline.sh             # 적용 (적용 전 ~/.local/state/hee-herdr-tools/backup/<타임스탬프>/ 에 백업)
```

- 이미 적용돼 있으면 아무것도 하지 않습니다.
- 상태줄 스크립트의 캐시 기록 블록이 예상과 다르면 추측해서 고치지 않고 종료코드 2로 멈춥니다(파일은 그대로).
- 적용은 같은 폴더의 임시 파일에 쓰고 `mv`로 교체하며, 기존 권한을 이어받습니다.
- 대상 경로의 기준 루트는 `HEE_HERDR_TOOLS_HOME`(기본 `$HOME`)을 따라 바꿀 수 있습니다.

## 요구 사항

- `~/.claude/statusline-command.sh`가 있고, 캐시를 기록하는 `jq` 블록이 이 스크립트가 아는 형태여야 합니다.
- 패치된 상태줄이 계정을 읽을 때 `jq`를 씁니다.

## 되돌리기

적용 직전의 파일이 `~/.local/state/hee-herdr-tools/backup/<타임스탬프>/statusline-command.sh`에 있습니다. 그 파일로 `~/.claude/statusline-command.sh`를 덮어쓰면 됩니다.
