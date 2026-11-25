#!/bin/sh
# herdr-tools: 저장소(원본) <-> herdr 홈 설치·동기화.
#   status | install [--dry-run] [--skip-notify] | capture [--dry-run] [--force]
# 대상 루트는 HERDR_TOOLS_HOME(기본 $HOME)으로 바꿀 수 있다.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$SCRIPT_DIR/.." && pwd)
ROOT=${HERDR_TOOLS_HOME:-$HOME}
MAIN=$ROOT/.config/herdr-app
HOME2=$ROOT/.config/herdr-app-2
BIN=$ROOT/.local/bin
NOTIFY=$ROOT/.local/share/herdr-notify
BACKUP_ROOT=$ROOT/.local/state/herdr-tools/backup
# 두 번째 홈에서 제외하는 mod (알림은 메인 창에서만)
SECOND_SKIP="system-notify"
# 저장소에 없지만 두 번째 홈에 링크해 두는 서드파티 mod (메인 홈에 있을 때만)
SECOND_EXTRA="git-graph"

# herdr가 mod 폴더에 다시 쓰는 파일 (비교·삭제 대상 제외)
RSYNC_EX="--exclude=gpui-kit.d.ts --exclude=herdr.d.ts --exclude=jsconfig.json --exclude=.DS_Store"

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=$BACKUP_ROOT/$STAMP
DRY=0; SKIP_NOTIFY=0; FORCE=0

die() { echo "오류: $*" >&2; exit 2; }
say() { echo "$*"; }
repo_mods() { ls "$REPO/mods"; }

usage() {
  cat <<USAGE
사용법: sh scripts/herdr-tools.sh <status|install|capture> [옵션]
  status                                저장소와 설치본의 차이 표시 (차이 있으면 종료코드 1)
  install [--dry-run] [--skip-notify]   저장소 -> 홈 복사 (덮어쓰기 전 백업)
  capture [--dry-run] [--force]         홈 -> 저장소 역복사 (저장소가 깨끗해야 함)
환경변수: HERDR_TOOLS_HOME (기본 \$HOME)
USAGE
}

# file_differs <src> <dst> : 차이 있으면(또는 dst 없음) 0, 같으면 1
file_differs() {
  [ -f "$2" ] || return 0
  cmp -s "$1" "$2" && return 1
  return 0
}

backup_path() { # 기존 경로 $1 를 백업 디렉터리의 상대 위치 $2 로 복사
  [ -e "$1" ] || [ -L "$1" ] || return 0
  [ "$DRY" = 1 ] && return 0
  mkdir -p "${BACKUP:?}/$(dirname "$2")"
  cp -pRP "$1" "${BACKUP:?}/$2"
}

copy_file() { # copy_file <src> <dst> <backup-rel> [mode]
  if ! file_differs "$1" "$2"; then return 0; fi
  say "  복사: $2"
  [ "$DRY" = 1 ] && return 0
  backup_path "$2" "$3"
  mkdir -p "$(dirname "$2")"
  cp "$1" "$2"
  if [ -n "${4:-}" ]; then chmod "$4" "$2"; fi
  return 0
}

# ---- status ----
DIFFS=0
report() { DIFFS=1; echo "  $*"; }

status_dir() { # status_dir <repo-dir> <home-dir> <label> : 저장소 -> 홈 기준
  if [ ! -d "$2" ]; then report "[없음] $3 (설치 안 됨)"; return 0; fi
  out=$(rsync -rlcni --delete $RSYNC_EX "$1/" "$2/" | grep -E '^(>f(c|\+)|\*deleting)' || true)
  [ -z "$out" ] && return 0
  DIFFS=1
  echo "$out" | while IFS= read -r line; do
    case "$line" in
      "*deleting"*) d=${line#*deleting}; echo "  [홈에만 있음] $3/${d# }" ;;
      ">f+++"*) echo "  [홈에 없음]   $3/${line#* }" ;;
      ">f"*) echo "  [내용 다름]   $3/${line#* }" ;;
      *) echo "  [차이] $3/ $line" ;;
    esac
  done
}

status_file() { # status_file <repo> <home> <label>
  if [ ! -f "$2" ]; then report "[홈에 없음]   $3"
  elif ! cmp -s "$1" "$2"; then report "[내용 다름]   $3"; fi
  return 0
}

status_link() { # status_link <path> <expected-target>
  if [ -L "$1" ] && [ "$(readlink "$1")" = "$2" ]; then return 0; fi
  if [ -L "$1" ]; then report "[링크 대상 다름] $1 -> $(readlink "$1") (기대: $2)"
  elif [ -e "$1" ]; then report "[링크 아님]   $1 (기대: -> $2)"
  else report "[링크 없음]   $1 (기대: -> $2)"; fi
}

second_mods() {
  for m in $(repo_mods); do
    case " $SECOND_SKIP " in *" $m "*) continue ;; esac
    echo "$m"
  done
  for m in $SECOND_EXTRA; do
    if [ -e "$MAIN/mods/$m" ]; then echo "$m"; fi
  done
  return 0
}

cmd_status() {
  command -v rsync >/dev/null || die "rsync가 필요합니다"
  [ -d "$MAIN" ] || die "메인 홈이 없습니다: $MAIN"
  say "기준: 저장소 $REPO"
  say "대상: $ROOT"
  for m in $(repo_mods); do status_dir "$REPO/mods/$m" "$MAIN/mods/$m" "mods/$m"; done
  status_file "$REPO/layouts/main-window/my-main.json" "$MAIN/layouts/my-main.json" "layouts/main-window/my-main.json"
  status_file "$REPO/extensions/herdr-window/herdr-window" "$BIN/herdr-window" "extensions/herdr-window/herdr-window"
  if [ -d "$HOME2" ]; then
    status_file "$REPO/layouts/second-window/my-main.json" "$HOME2/layouts/my-main.json" "layouts/second-window/my-main.json"
    for m in $(second_mods); do status_link "$HOME2/mods/$m" "$MAIN/mods/$m"; done
  else
    say "  (두 번째 홈 없음: 건너뜀)"
  fi
  status_file "$REPO/extensions/notify-helper/src/main.swift" "$NOTIFY/src/main.swift" "extensions/notify-helper/src/main.swift"
  status_file "$REPO/extensions/notify-helper/Info.plist" "$NOTIFY/herdr-notify.app/Contents/Info.plist" "extensions/notify-helper/Info.plist"
  [ -d "$NOTIFY/herdr-notify.app" ] || report "[없음] herdr-notify.app (설치 안 됨)"
  if [ "$DIFFS" = 0 ]; then say "차이 없음"; return 0; fi
  say "차이 있음"; return 1
}

# ---- install ----
sync_dir() { # sync_dir <src> <dst> <backup-rel>
  mkdir -p "$2"
  if [ "$DRY" = 1 ]; then
    out=$(rsync -rlcni --delete $RSYNC_EX "$1/" "$2/" | grep -E '^(>f(c|\+)|\*deleting)' || true)
    if [ -n "$out" ]; then echo "$out" | sed 's/^/  /'; fi
    return 0
  fi
  mkdir -p "${BACKUP:?}/$3"
  out=$(rsync -rlci --delete --backup --backup-dir="${BACKUP:?}/$3" $RSYNC_EX "$1/" "$2/" | grep -E '^(>f(c|\+)|\*deleting)' || true)
  if [ -n "$out" ]; then echo "$out" | sed 's/^/  /'; fi
  # 비어 있으면 빈 백업 폴더 정리 (비어 있지 않으면 실패하고 유지됨)
  find "${BACKUP:?}" -type d -empty -delete 2>/dev/null || true
  return 0
}

ensure_link() { # ensure_link <link> <target>
  if [ -L "$1" ] && [ "$(readlink "$1")" = "$2" ]; then return 0; fi
  say "  링크: $1 -> $2"
  [ "$DRY" = 1 ] && return 0
  backup_path "$1" "second-home/mods/$(basename "$1")"
  if [ -L "$1" ]; then rm "$1"; elif [ -e "$1" ]; then rm -r "${1:?}"; fi
  mkdir -p "$(dirname "$1")"
  ln -s "$2" "$1"
}

cmd_install() {
  command -v rsync >/dev/null || die "rsync가 필요합니다"
  [ -d "$MAIN" ] || die "메인 홈이 없습니다: $MAIN (herdr를 한 번 실행한 뒤 다시 시도)"
  if [ "$DRY" = 1 ]; then say "[dry-run] 실제로는 쓰지 않습니다"; fi
  say "백업 위치(변경 시 생성): $BACKUP"
  say "mods"
  for m in $(repo_mods); do
    say " $m"; sync_dir "$REPO/mods/$m" "$MAIN/mods/$m" "main-home/mods/$m"
  done
  say "layouts (메인)"
  copy_file "$REPO/layouts/main-window/my-main.json" "$MAIN/layouts/my-main.json" "main-home/layouts/my-main.json"
  say "herdr-window"
  copy_file "$REPO/extensions/herdr-window/herdr-window" "$BIN/herdr-window" "bin/herdr-window" 755
  if [ "$DRY" != 1 ] && [ -f "$BIN/herdr-window" ]; then chmod 755 "$BIN/herdr-window"; fi
  if [ -d "$HOME2" ]; then
    say "두 번째 홈"
    copy_file "$REPO/layouts/second-window/my-main.json" "$HOME2/layouts/my-main.json" "second-home/layouts/my-main.json"
    for m in $(second_mods); do ensure_link "$HOME2/mods/$m" "$MAIN/mods/$m"; done
  else
    say "두 번째 홈 없음: 건너뜀"
  fi
  if [ "$SKIP_NOTIFY" = 1 ]; then
    say "notify: 건너뜀 (--skip-notify)"
  elif [ "$DRY" = 1 ]; then
    say "notify: [dry-run] notify-helper/build.sh 빌드 후 $NOTIFY/herdr-notify.app 로 설치 예정"
  else
    say "notify"
    OUT=$REPO/build
    sh "$REPO/extensions/notify-helper/build.sh" "$OUT"
    backup_path "$NOTIFY/herdr-notify.app" "notify/herdr-notify.app"
    mkdir -p "$NOTIFY/src"
    if [ -d "$NOTIFY/herdr-notify.app" ]; then rm -r "${NOTIFY:?}/herdr-notify.app"; fi
    cp -R "$OUT/herdr-notify.app" "$NOTIFY/herdr-notify.app"
    cp "$REPO/extensions/notify-helper/src/main.swift" "$NOTIFY/src/main.swift"
    say "  설치: $NOTIFY/herdr-notify.app"
  fi
  if [ -d "$BACKUP" ]; then say "백업 생성됨: $BACKUP"; else say "백업할 변경 없음"; fi
  say "완료. herdr를 재시작하면 반영됩니다."
}

# ---- capture ----
cap_file() { # cap_file <home-file> <repo-file>
  if [ -f "$1" ] && file_differs "$1" "$2"; then
    say "  가져옴: $2"
    if [ "$DRY" != 1 ]; then mkdir -p "$(dirname "$2")"; cp "$1" "$2"; fi
  fi
  return 0
}

cmd_capture() {
  command -v rsync >/dev/null || die "rsync가 필요합니다"
  [ -d "$MAIN" ] || die "메인 홈이 없습니다: $MAIN"
  if [ "$FORCE" != 1 ] && [ "$DRY" != 1 ]; then
    dirty=$(git -C "$REPO" status --porcelain 2>/dev/null || true)
    if [ -n "$dirty" ]; then
      echo "경고: 저장소에 커밋되지 않은 변경이 있어 중단합니다 (덮어쓰기 방지). 진행하려면 --force." >&2
      echo "$dirty" | sed 's/^/  /' >&2
      exit 3
    fi
  fi
  if [ "$DRY" = 1 ]; then say "[dry-run] 실제로는 쓰지 않습니다"; fi
  FLAG=-rlci; if [ "$DRY" = 1 ]; then FLAG=-rlcni; fi
  for m in $(repo_mods); do
    say "mods/$m"
    if [ ! -d "$MAIN/mods/$m" ]; then say "  홈에 없음: 건너뜀"; continue; fi
    # 저장소 전용 파일(LICENSE)은 지우지 않도록 보호
    out=$(rsync $FLAG --delete $RSYNC_EX --exclude=/LICENSE "$MAIN/mods/$m/" "$REPO/mods/$m/" | grep -E '^(>f(c|\+)|\*deleting)' || true)
    if [ -n "$out" ]; then echo "$out" | sed 's/^/  /'; fi
  done
  say "layouts / extensions"
  cap_file "$MAIN/layouts/my-main.json" "$REPO/layouts/main-window/my-main.json"
  cap_file "$HOME2/layouts/my-main.json" "$REPO/layouts/second-window/my-main.json"
  cap_file "$BIN/herdr-window" "$REPO/extensions/herdr-window/herdr-window"
  cap_file "$NOTIFY/src/main.swift" "$REPO/extensions/notify-helper/src/main.swift"
  cap_file "$NOTIFY/herdr-notify.app/Contents/Info.plist" "$REPO/extensions/notify-helper/Info.plist"
  say "완료. git diff로 확인 후 커밋하세요."
}

# ---- main ----
[ $# -ge 1 ] || { usage; exit 2; }
SUB=$1; shift
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --skip-notify) SKIP_NOTIFY=1 ;;
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "알 수 없는 옵션: $a" ;;
  esac
done
case "$SUB" in
  status) cmd_status ;;
  install) cmd_install ;;
  capture) cmd_capture ;;
  -h|--help|help) usage ;;
  *) usage; exit 2 ;;
esac
