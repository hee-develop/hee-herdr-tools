// Modified from Herdr's bundled `agents` mod (Apache License 2.0); see NOTICE.
// hee-agent-list의 순수 로직. herdr·gpui를 import하지 않으므로 node에서 그대로 테스트할 수 있다.
// herdr API 결과(agents(), panes(), spaces(), terminals(), layout())를 인자로 받는다.

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
export const sidebarNarrow = (root) => (find(root, "sidebar")?.size?.px ?? Infinity) < 160;

export const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

export function leadPanes(all) {
  const leads = new Map();
  for (const p of all) {
    if (!p.terminal) continue;
    const current = leads.get(p.tab);
    // First agent, else first focused terminal, else first terminal in the tab.
    if (!current || (!current.program?.agent && (p.program?.agent || (!current.focused && p.focused)))) leads.set(p.tab, p);
  }
  return leads;
}

// 탭 이름이 비었거나 프로그램 이름이면 터미널 실시간 제목(경로·user@host·프로그램명 제목 제외)을 쓴다.
export function title(tab, l) {
  const prog = l?.program?.name;
  const live = clean(l?.title);
  const telling = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== l?.program?.key;
  return (tab.name === prog || !tab.named) && telling ? live : tab.name;
}

export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
export const SECTION = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" };
export const SECTION_STATUS = { 4: "blocked", 3: "done", 2: "working" };

// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
// `listed`: Map address -> status of agents().
export const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};

export function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// Stamps agents whose state changed. Done and idle count as one: looking at a
// finished agent turns done into idle, and looking isn't the agent doing anything.
// `changed`: { [address]: { s, at } }. Returns { changed, dirty } (a new object; the input is untouched).
export function trackChanges(changed, list, now) {
  const next = { ...changed };
  let dirty = false;
  for (const a of list) {
    const s = a.status === "done" ? "idle" : a.status;
    if (next[a.address]?.s === s) continue;
    next[a.address] = { s, at: now };
    dirty = true;
  }
  if (!dirty) return { changed, dirty: false };
  // Gone and old: the list alone is empty right after a start.
  const listed = new Set(list.map((a) => a.address));
  for (const [k, c] of Object.entries(next)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete next[k];
  return { changed: next, dirty: true };
}

// Looking at a done agent makes it idle; it stays with Done until you leave
// it rather than drop away under you. Any other change moves it at once.
// `held`: { address, rank } | null | undefined. Returns the next held.
export function nextHeld(held, list) {
  const cur = list.find((a) => a.focused);
  const same = cur && cur.address === held?.address;
  // Arriving, or any change but done turning idle, sets what it was.
  if (!same || cur.status !== "idle") return cur ? { address: cur.address, rank: RANK[cur.status] ?? 0 } : null;
  return held;
}

export function rankOf(a, held) {
  const sawDone = a.address === held?.address && held.rank === RANK.done && a.status === "idle";
  return sawDone ? RANK.done : RANK[a.status] ?? 0;
}

// Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
// `all`: terminals().
export function buildTree(all, addr, lead = []) {
  const kids = all.filter((k) => k.parent === addr && k.state === "live");
  return kids.flatMap((k, i) => {
    const last = i === kids.length - 1;
    return [
      { t: k, lines: [...lead, last ? "└" : "├"] },
      ...buildTree(all, k.address, [...lead, last ? "" : "│"]),
    ];
  });
}

// Addresses of agents that a tree already shows (they get no row of their own).
export function nestedAddresses(list, all) {
  return new Set(list.flatMap((a) => buildTree(all, a.address).map((s) => s.t.address)));
}

export function countByTab(list) {
  const counts = new Map();
  for (const a of list) counts.set(a.tab, (counts.get(a.tab) ?? 0) + 1);
  return counts;
}

// address -> the most urgent rank among the agent itself and its sub-agents.
export function urgencyMap(list, all, listed, held) {
  return new Map(list.map((a) => [a.address, Math.max(rankOf(a, held), ...buildTree(all, a.address).map((s) => RANK[kidStatus(s.t, listed)] ?? 0))]));
}

// Priority view order: urgency, then most recently changed, then newest.
// `since(a)`: when the agent's state last changed (ms).
export function sortByPriority(list, urgency, since) {
  return [...list].sort((x, y) => urgency.get(y.address) - urgency.get(x.address) || since(y) - since(x) || y.seq - x.seq);
}

// The most urgent status among `statuses` (null when empty).
export function topStatus(statuses) {
  return statuses.reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null);
}

// 행 이름 계산: label(탭 이름 또는 에이전트 제목)과 detail(번호만인 이름 제외, 같은 space에서 겹치면 되살림).
// `tabs`: Map tab id -> TabInfo, `leads`: leadPanes(panes()), `tabCounts`: countByTab(list).
export function computeLabels(list, tabs, leads, tabCounts) {
  const labels = new Map(list.map((a) => {
    const tab = tabs.get(a.tab);
    const many = tabCounts.get(a.tab) > 1;
    return [a.address, tab ? title(many ? { ...tab, named: false } : tab, many ? a : leads.get(a.tab)) : (a.title || a.program?.name || "")];
  }));
  const label = (a) => labels.get(a.address);
  const detail = new Map(list.map((a) => [a.address, /^\d+$/.test(label(a)) ? null : label(a)]));
  const seen = {};
  for (const a of list) { const k = `${a.space_name}\u0000${detail.get(a.address) ?? ""}`; seen[k] = (seen[k] ?? 0) + 1; }
  for (const a of list) {
    if (detail.get(a.address) == null && seen[`${a.space_name}\u0000`] > 1) detail.set(a.address, label(a));
  }
  return { labels, detail };
}

// An agent on another machine (`vps/t7`) says which.
export const machineOf = (address) => (address.includes("/") ? address.split("/")[0] : null);

// 행에 보일 이름. full: space 이름도 따로 표시하는 행(priority·pinned).
export function rowName({ full, more, spaceName, label, programName }) {
  return full ? (more ?? spaceName) : more ?? (/^\d+$/.test(label) ? programName || label : label);
}

// Groups in list order: spaces (grouped) or priority sections. Agents of a
// space are next to each other in agents(), so neighbours make a group.
export function groupAgents(pinned, rest, urgency, byPriority) {
  const groups = pinned.length ? [{ id: "pinned", label: "Pinned", status: null, members: pinned }] : [];
  for (const a of rest) {
    const r = urgency.get(a.address) || RANK.idle;
    const id = byPriority ? `sec-${r}` : `sp-${a.space}`;
    if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
    else groups.push({ id, label: byPriority ? SECTION[r] : a.space_name || "", status: byPriority ? SECTION_STATUS[r] : null, members: [a] });
  }
  return groups;
}

// Keep offline pins until their terminal returns; returns the addresses still pending
// and the terminals whose pin must be (re)written now.
// `migrating`: Set of addresses already asked (the caller adds `toPin` to it).
export function pendingPinsAfter(pendingPins, all, migrating) {
  const listed = new Map(all.filter((t) => t.state === "live").map((t) => [t.address, t]));
  const toPin = [];
  const pending = pendingPins.filter((address) => {
    const terminal = listed.get(address);
    if (!terminal) return true;
    if (terminal.labels?.["herdr.pinned"]) return false;
    if (!migrating.has(address) && !toPin.includes(address)) toPin.push(address);
    return true;
  });
  return { pending, toPin };
}
