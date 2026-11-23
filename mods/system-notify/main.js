// macOS 시스템 알림: 에이전트가 Needs you(blocked)가 되거나 완료(done)됐는데
// Herdr 창이 비활성이면 헬퍼 앱(herdr-notify)으로 알림을 띄운다. 클릭하면 Herdr를
// 앞으로 가져오고 그 에이전트로 이동한다. 화면에는 아무것도 그리지 않는다
// (레이아웃의 0px 블록으로 살아 있기만 하면 된다).

import { View, div } from "gpui-kit";
import { agents, exec, home, window } from "herdr";

// 직접 만든 헬퍼 앱(~/.local/share/herdr-notify, 소스는 src/main.swift).
// terminal-notifier는 macOS의 threadIdentifier(알림센터에서 접히는 묶음)를 지원하지 않아
// space별 스택을 만들 수 없으므로 헬퍼가 대신 알림을 올린다.
// 알림 ID는 에이전트당 1개(같으면 교체), 묶음(thread)은 space 단위다.
const NOTIFIER_REL = ".local/share/herdr-notify/herdr-notify.app/Contents/MacOS/herdr-notify";

const MESSAGE = {
  blocked: "입력이 필요합니다 (Needs you)",
  done: "작업을 마쳤습니다",
};

export default class SystemNotify extends View {
  init() {
    // 시작 시점의 상태는 알리지 않는다: 이후 바뀐 것만 알린다.
    this.prev = new Map(agents().map((a) => [a.address, a.status]));
    this.herdrApp = `${home()}/.local/bin/herdr-app`;
    this.notifier = `${home()}/${NOTIFIER_REL}`;
  }

  // agents()가 바뀔 때마다 Herdr가 render를 다시 부른다.
  check(cx) {
    // 창이 없을 때(herdr-app check 등)는 null이 온다: 비활성으로 본다.
    const active = window()?.active ?? false;
    const next = new Map();
    for (const a of agents()) {
      next.set(a.address, a.status);
      const before = this.prev.get(a.address);
      if (a.status === before || !MESSAGE[a.status] || active) continue;
      this.post(a, cx);
    }
    this.prev = next;
  }

  post(a, cx) {
    const name = a.program?.name || a.app || "agent";
    const args = [
      "--title", `${name} · ${MESSAGE[a.status]}`,
      "--subtitle", `${a.space_name} › ${a.tab_name}`,
      "--body", a.title || a.address,
      "--id", `herdr-${a.address}`,
      "--thread", `herdr-space-${a.space}`,
      "--terminal", a.address,
      "--herdr-app", this.herdrApp,
    ];
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
