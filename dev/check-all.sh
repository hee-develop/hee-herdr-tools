#!/bin/sh
# mods/* 각각에 herdr-app check 를 실행한다. 하나라도 실패하면 종료코드 1.
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$SCRIPT_DIR/.." && pwd)
command -v herdr-app >/dev/null || { echo "오류: herdr-app 명령이 없습니다" >&2; exit 2; }
fail=0
for d in "$REPO"/mods/*/; do
  name=$(basename "$d")
  if herdr-app check "$d"; then echo "OK   $name"; else echo "FAIL $name"; fail=1; fi
done
exit $fail
