#!/bin/sh
# 공개 전 개인정보 점검: 발견 위치만 보고하고 고치지 않는다. 발견 시 종료코드 1.
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO" || exit 2
found=0
scan() { # scan <label> <pattern(ERE)>
  out=$(grep -rnEI --exclude-dir=.git --exclude-dir=build --exclude-dir=node_modules \
    --exclude=scan-private.sh -e "$2" . 2>/dev/null | cut -c1-200)
  if [ -n "$out" ]; then found=1; echo "== $1"; echo "$out"; fi
}
scan "절대경로 /Users/" '/Users/'
scan "soomgo" '@soomgo|soomgo'
scan "이메일" '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
scan "토큰 패턴" 'gh[opsu]_[A-Za-z0-9]{20,}|github_pat_|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]+|-----BEGIN [A-Z ]*PRIVATE KEY'
if [ "$found" = 0 ]; then echo "발견 없음"; fi
exit $found
