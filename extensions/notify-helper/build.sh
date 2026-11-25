#!/bin/sh
# extensions/notify-helper/src/main.swift 를 빌드해 herdr-notify.app 번들을 만든다 (ad-hoc 서명).
# 사용법: sh extensions/notify-helper/build.sh [out_dir]   (기본: <repo>/build)
# Herdr.icns 는 빌드 시점에 /Applications/Herdr.app 에서 복사한다(저장소에 포함하지 않음).
set -eu
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$SCRIPT_DIR/../.." && pwd)
OUT=${1:-$REPO/build}
APP=$OUT/herdr-notify.app
ICON_SRC=${HERDR_APP_BUNDLE:-/Applications/Herdr.app}/Contents/Resources/Herdr.icns

command -v swiftc >/dev/null || { echo "오류: swiftc 필요 (Xcode Command Line Tools)" >&2; exit 2; }
if [ -d "$APP" ]; then rm -r "${APP:?}"; fi
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O "$SCRIPT_DIR/src/main.swift" -o "$APP/Contents/MacOS/herdr-notify"
cp "$SCRIPT_DIR/Info.plist" "$APP/Contents/Info.plist"
if [ -f "$ICON_SRC" ]; then
  cp "$ICON_SRC" "$APP/Contents/Resources/Herdr.icns"
else
  echo "경고: $ICON_SRC 없음 - 아이콘 없이 빌드합니다" >&2
fi
codesign --force --sign - "$APP"
codesign -v "$APP"
echo "빌드 완료: $APP"
