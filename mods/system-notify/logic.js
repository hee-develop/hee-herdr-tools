// system-notify의 순수 로직: 상태 전이 판정과 알림 인자 조립. herdr 의존 없음.

export const MESSAGE = {
  blocked: "입력이 필요합니다 (Needs you)",
  done: "작업을 마쳤습니다",
};

// 시작 시점 상태 스냅샷: address -> status.
export const snapshot = (list) => new Map(list.map((a) => [a.address, a.status]));

// 이전 스냅샷(prev)과 현재 agents()를 비교한다.
// 알릴 대상: 상태가 바뀌었고(처음 보는 에이전트 포함) blocked/done이며 창이 비활성일 때.
// 창이 활성이어도 next 스냅샷은 갱신된다. 반환: { next, toNotify }.
export function detectTransitions(prev, list, active) {
  const next = new Map();
  const toNotify = [];
  for (const a of list) {
    next.set(a.address, a.status);
    const before = prev.get(a.address);
    if (a.status === before || !MESSAGE[a.status] || active) continue;
    toNotify.push(a);
  }
  return { next, toNotify };
}

// herdr-notify 헬퍼에 넘길 인자.
export function notifyArgs(a, herdrApp) {
  const name = a.program?.name || a.app || "agent";
  return [
    "--title", `${name} · ${MESSAGE[a.status]}`,
    "--subtitle", `${a.space_name} › ${a.tab_name}`,
    "--body", a.title || a.address,
    "--id", `herdr-${a.address}`,
    "--thread", `herdr-space-${a.space}`,
    "--terminal", a.address,
    "--herdr-app", herdrApp,
  ];
}
