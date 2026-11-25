# mem-bar

메모리 사용량과 Claude Code 사용 한도를 보여 주는 얇은 상태 바입니다.

## 무엇을 하나

- 레이아웃의 24px 높이 `membar` 블록으로 뜹니다(창 드래그 영역). 내용은 오른쪽 정렬입니다.
- Claude Code 사용 한도(파란 게이지): `주간`과 `5시간` 두 창의 사용률(%)과 남은 시간(`42m`, `2h 40m`, `5d 7h` 형식). 사용률이 90% 이상이면 빨간색, 한도 초기화 시각이 지난 창은 `--`로 표시합니다.
- 구분선 뒤에 메모리(주황 게이지): 활동 모니터의 "사용된 메모리"와 같은 방식(앱 메모리에서 purgeable을 뺀 값 + wired + compressed)의 `RAM 사용 / 전체 GB (%)`와 메모리 압력(`normal`, `warning`, `critical`) 점·글자.
- 5초마다 갱신합니다. 메모리는 `sysctl`과 `vm_stat`을 실행해 읽고, 사용량은 `~/.claude/state/rate-limits.json`을 읽습니다. 한쪽을 읽지 못하면 그쪽만 숨깁니다.

## 조작

사용량 영역을 우클릭하면 팝업이 뜹니다.

- 사용량이 어느 계정의 값인지(없으면 `계정 정보 없음`)
- `새로고침` 항목과 캐시를 마지막으로 갱신한 뒤 경과 시간(`갱신 N초 전`, 1초마다 올라감)
- Enter 또는 클릭: 새로고침, Esc: 닫기

새로고침은 바 인스턴스가 `shared("mem-bar.refresh")` 신호를 받아 메모리와 캐시를 즉시 다시 읽는 것입니다.

## 구조

같은 mod가 `props.menu: true`로 자기 자신을 팝업으로 열어 `menu.js`의 화면을 그립니다. 팝업 인스턴스는 바 전용 폴링을 하지 않고 1초 tick만 돌며, 닫을 때 tick을 취소합니다. 바와 팝업은 서로 다른 인스턴스입니다.

## 원본

herdr 내장 mod의 복제본이 아니라 이 저장소에서 새로 작성한 mod입니다.

## 의존

- macOS의 `sysctl`, `vm_stat`.
- 사용량 값: Claude Code 상태줄 스크립트(`~/.claude/statusline-command.sh`)가 렌더링할 때마다 남기는 `~/.claude/state/rate-limits.json` 캐시. 상태줄이 갱신되지 않으면 값도 갱신되지 않습니다.
- 계정 표시: 위 캐시의 `account` 필드가 필요하며, 이 필드는 [extensions/statusline-patch](../../extensions/statusline-patch/README.md)로 상태줄 스크립트를 패치해야 기록됩니다. 패치하지 않으면 `계정 정보 없음`이 표시됩니다.
