# notify-helper

space별로 알림센터에서 접히는 macOS 알림을 올리는 헬퍼 앱(`herdr-notify.app`)입니다. `mods/system-notify`가 이 앱을 호출합니다.

## 무엇을 하나

범용 알림 도구(`terminal-notifier`)는 macOS의 `threadIdentifier`(알림센터에서 접히는 묶음)를 지원하지 않아 space별 묶음을 만들 수 없습니다. 그래서 `UserNotifications`를 직접 쓰는 작은 Swift 앱을 만들었습니다.

- 인자가 있으면(`--title` 등) 알림을 올리고 종료합니다. 인자: `--title`, `--subtitle`, `--body`, `--id`(같으면 이전 알림 교체), `--thread`(알림센터 묶음), `--terminal`, `--herdr-app`.
- 알림을 클릭하면 macOS가 앱을 다시 띄우고, 앱은 `<herdr-app> do agent.focus {"terminal": ...}`로 그 에이전트에 포커스한 뒤 Herdr를 앞으로 가져옵니다.
- 처음 실행하면 알림 권한을 요청합니다. 거부되면 종료코드 3으로 끝납니다.

구성: `src/main.swift`(소스), `Info.plist`, `build.sh`(빌드 스크립트).

## 설치

일괄 설치 `sh scripts/hee-herdr-tools.sh install`이 다음을 합니다(`--skip-notify`로 건너뜀, `--dry-run`은 빌드하지 않음).

1. `build.sh`로 저장소 루트의 `build/herdr-notify.app`을 빌드합니다.
2. 기존 `~/.local/share/herdr-notify/herdr-notify.app`을 백업(`~/.local/state/hee-herdr-tools/backup/<타임스탬프>/`)한 뒤 새 앱으로 교체합니다.
3. 소스를 `~/.local/share/herdr-notify/src/main.swift`에 함께 복사합니다.

단독으로 빌드해 쓰려면:

```sh
sh extensions/notify-helper/build.sh [out_dir]   # 기본: 저장소 루트의 build/
```

`src/main.swift`를 `swiftc -O`로 빌드하고 `Info.plist`를 넣어 `herdr-notify.app`을 만든 뒤 ad-hoc 서명(`codesign`)합니다. `Herdr.icns`는 빌드 시점에 `/Applications/Herdr.app`에서 복사하며 저장소에는 포함하지 않습니다(없으면 경고만 하고 아이콘 없이 빌드). 설치 위치를 바꾸려면 만들어진 앱을 원하는 곳에 복사하면 되지만, `mods/system-notify`는 `~/.local/share/herdr-notify/herdr-notify.app`을 찾습니다.

빌드한 앱을 직접 시험하려면:

```sh
build/herdr-notify.app/Contents/MacOS/herdr-notify --title "제목" --body "본문"
```

## 요구 사항

- macOS 12 이상, `swiftc`(Xcode Command Line Tools), `codesign`.
- 아이콘용 `/Applications/Herdr.app`(다른 위치면 `HERDR_APP_BUNDLE` 환경변수로 지정).

## 되돌리기

`~/.local/share/herdr-notify/`를 지우면 앱이 사라지고(이전 앱은 백업 폴더에 있음), `mods/system-notify`는 알림 대신 로그만 남깁니다.
