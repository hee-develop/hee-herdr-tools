// macOS 시스템 알림: 에이전트가 Needs you(blocked)가 되거나 완료(done)됐는데
// Herdr 창이 비활성이면 헬퍼 앱(herdr-notify)으로 알림을 띄운다. 클릭하면 Herdr를
// 앞으로 가져오고 그 에이전트로 이동한다. 화면에는 아무것도 그리지 않는다
// (레이아웃의 0px 블록으로 살아 있기만 하면 된다).

import { View, div } from "gpui-kit";
import { agents, exec, home, window } from "herdr";
import { snapshot, detectTransitions, notifyArgs } from "./logic.js";

// 직접 만든 헬퍼 앱(~/.local/share/herdr-notify, 소스는 src/main.swift).
// terminal-notifier는 macOS의 threadIdentifier(알림센터에서 접히는 묶음)를 지원하지 않아
// space별 스택을 만들 수 없으므로 헬퍼가 대신 알림을 올린다.
// 알림 ID는 에이전트당 1개(같으면 교체), 묶음(thread)은 space 단위다.
const NOTIFIER_REL = ".local/share/herdr-notify/herdr-notify.app/Contents/MacOS/herdr-notify";

// 상태 감시 주기(ms). render만으로는 부족하다: 창이 가려지거나(다른 창·전체 화면·다른 Space)
// 최소화되거나 디스플레이가 꺼지면 Herdr가 프레임을 그리지 않아 render가 불리지 않는다.
// 그러면 전이를 놓쳤다가 창을 다시 볼 때 한꺼번에 알리게 된다. 타이머는 그동안에도 돈다
// (herdrdev/herdr-app#1320, 2026-11-24 화면 잠금 상태에서 실측).
const POLL_MS = 1000;

export default class SystemNotify extends View {
  init(_props, cx) {
    // 시작 시점의 상태는 알리지 않는다: 이후 바뀐 것만 알린다.
    this.prev = snapshot(agents());
    this.herdrApp = `${home()}/.local/bin/herdr-app`;
    this.notifier = `${home()}/${NOTIFIER_REL}`;
    cx.timer.every(POLL_MS, (cx) => this.check(cx));
  }

  // 타이머(창이 안 그려질 때도)와 render(창이 보일 때 즉시) 양쪽에서 부른다.
  // 같은 전이는 this.prev 스냅샷 덕분에 한 번만 알린다.
  check(cx) {
    // 창이 없을 때(herdr-app check 등)는 null이 온다: 비활성으로 본다.
    const active = window()?.active ?? false;
    const { next, toNotify } = detectTransitions(this.prev, agents(), active);
    for (const a of toNotify) this.post(a, cx);
    this.prev = next;
  }

  post(a, cx) {
    const args = notifyArgs(a, this.herdrApp);
    cx.spawn(async () => {
      try {
        await exec(this.notifier, args, { timeout: 10000 });
      } catch (e) {
        console.log(`system-notify: ${e}`);
      }
    });
  }

  render(cx) {
    this.check(cx);
    return div().size(0);
  }
}
