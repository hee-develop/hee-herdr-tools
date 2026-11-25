#!/bin/sh
# patch-statusline: Claude Code 상태줄 스크립트가 rate-limits.json 캐시에 account(계정 이메일)를 함께 기록하도록 고친다.
#   (인자 없음: 적용) | --dry-run: 바뀔 diff만 출력 | --check: 적용돼 있으면 0, 필요하면 1
# 대상: ${HEE_HERDR_TOOLS_HOME:-$HOME}/.claude/statusline-command.sh (저장소 밖 파일이라 이 스크립트로 한 번 패치한다)
# 종료코드: 0 적용됨/이미 적용됨, 1 --check에서 패치 필요, 2 오류(파일 없음, 알 수 없는 내용 등)
# mem-bar의 계정 표시는 이 패치가 캐시에 남기는 account 필드에 의존한다.
set -eu

ROOT=${HEE_HERDR_TOOLS_HOME:-$HOME}
TARGET=$ROOT/.claude/statusline-command.sh
BACKUP_ROOT=$ROOT/.local/state/hee-herdr-tools/backup
STAMP=$(date +%Y%m%d-%H%M%S)
MODE=apply

die() { echo "오류: $*" >&2; exit 2; }
say() { echo "$*"; }

for a in "$@"; do
  case "$a" in
    --dry-run) MODE=dry ;;
    --check) MODE=check ;;
    -h|--help)
      echo "사용법: sh extensions/statusline-patch/patch-statusline.sh [--dry-run|--check]"
      echo "  (없음)     상태줄 스크립트에 account 기록을 적용 (적용 전 백업)"
      echo "  --dry-run  바뀔 diff만 출력하고 파일은 바꾸지 않음"
      echo "  --check    이미 적용돼 있으면 0, 패치가 필요하면 1, 알 수 없는 내용이면 2"
      echo "환경변수: HEE_HERDR_TOOLS_HOME (기본 \$HOME)"
      exit 0 ;;
    *) die "알 수 없는 옵션: $a" ;;
  esac
done

[ -f "$TARGET" ] || die "상태줄 스크립트가 없습니다: $TARGET"

# 패치 전에 있는 줄(캐시 기록 jq 호출의 첫 줄)과 그 다음 줄의 앞부분
ORIG_LINE='  echo "$input" | jq -c --argjson now "$(date +%s)" '"'"'.rate_limits + {updated_at: $now}'"'"' \'
NEXT_LINE='    > "$rate_cache.tmp.$$" 2>/dev/null && mv -f "$rate_cache.tmp.$$" "$rate_cache"'
# 패치 후에만 있는 줄
MARK_LINE='  account=$(jq -r '"'"'.oauthAccount.emailAddress // empty'"'"' "${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json" 2>/dev/null)'

if grep -Fxq -- "$MARK_LINE" "$TARGET" && ! grep -Fxq -- "$ORIG_LINE" "$TARGET"; then
  say "이미 적용됨: $TARGET"
  exit 0
fi

TMPDIR_=$(mktemp -d "${TMPDIR:-/tmp}/patch-statusline.XXXXXX")
trap 'rm -rf "$TMPDIR_"' EXIT INT TERM
REPL=$TMPDIR_/replacement
NEW=$TMPDIR_/new

# 원래 한 줄을 대신할 블록
cat > "$REPL" <<'REPLACEMENT'
  # 어느 계정의 값인지 캐시에 account(이메일)로 함께 남긴다. CLAUDE_CONFIG_DIR 이 있으면 그 폴더, 없으면 $HOME 의 .claude.json 에서 읽고, 못 구하면 null
  account=$(jq -r '.oauthAccount.emailAddress // empty' "${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json" 2>/dev/null)
  echo "$input" | jq -c --argjson now "$(date +%s)" --arg account "$account" \
    '.rate_limits + {updated_at: $now, account: (if $account == "" then null else $account end)}' \
REPLACEMENT

# 원래 줄이 정확히 한 번 있고 바로 다음 줄이 기대한 줄일 때만 바꾼다. 아니면 추측하지 않는다.
if ! HT_ORIG=$ORIG_LINE HT_NEXT=$NEXT_LINE awk '
  BEGIN { orig = ENVIRON["HT_ORIG"]; nxt = ENVIRON["HT_NEXT"] }
  NR == FNR { rep = rep $0 "\n"; next }
  pending { if ($0 == nxt) ok++; pending = 0 }
  $0 == orig { printf "%s", rep; pending = 1; n++; next }
  { print }
  END { exit (n == 1 && ok == 1) ? 0 : 1 }
' "$REPL" "$TARGET" > "$NEW"; then
  die "상태줄 스크립트의 캐시 기록 블록이 예상과 달라 고치지 않았습니다(파일 그대로): $TARGET"
fi

if [ "$MODE" = check ]; then
  say "패치 필요: $TARGET"
  exit 1
fi

if [ "$MODE" = dry ]; then
  say "[dry-run] 적용할 변경 (파일은 바꾸지 않음):"
  diff -u "$TARGET" "$NEW" || true
  exit 0
fi

BACKUP=$BACKUP_ROOT/$STAMP
mkdir -p "$BACKUP"
cp -p "$TARGET" "$BACKUP/statusline-command.sh"
# 같은 폴더의 임시 파일에 쓰고 mv로 교체한다(원자적). cp -p로 기존 권한을 이어받는다.
TMP=$TARGET.tmp.$$
cp -p "$TARGET" "$TMP"
cat "$NEW" > "$TMP"
mv -f "$TMP" "$TARGET"
say "적용 완료: $TARGET"
say "백업: $BACKUP/statusline-command.sh"
