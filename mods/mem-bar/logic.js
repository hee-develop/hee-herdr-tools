// mem-bar의 순수 로직: 메모리·Claude 사용량 파서와 포맷터. herdr·gpui 의존 없음.

export const PRESSURE = { 1: "normal", 2: "warning", 4: "critical" };
// 사용량이 이 값(%) 이상이면 빨강.
export const HOT_PERCENT = 90;

// ~/.claude/state/rate-limits.json 내용을 파싱한다. nowSec: 현재 시각(초).
// resets_at이 지난 창은 { pct: null, left: null }("--" 표시).
export function parseRate(text, nowSec) {
  const j = JSON.parse(text);
  const one = (w) => {
    if (!w || typeof w.used_percentage !== "number") return null;
    const resets = Number(w.resets_at) || 0;
    // Window already reset since the last Claude Code render: the cached % no longer applies.
    if (resets && resets <= nowSec) return { pct: null, left: null };
    return { pct: w.used_percentage, left: resets ? resets - nowSec : null };
  };
  const r = { h5: one(j.five_hour), d7: one(j.seven_day), updatedAt: Number(j.updated_at) || null, account: typeof j.account === "string" && j.account ? j.account : null };
  return r.h5 || r.d7 ? r : null;
}

// 42m · 2h 40m · 5d 7h (한 글자 단위)
export function fmtLeft(sec) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return h % 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${Math.floor(h / 24)}d`;
}

export const isHot = (pct) => pct >= HOT_PERCENT;
// 0..1로 자른 비율.
export const clampRatio = (x) => Math.min(1, Math.max(0, x));
// 게이지 채움 너비(px).
export const gaugeWidth = (full, ratio) => Math.round(full * ratio);
// "5%", "90%", "100%". 앞쪽 공백으로 폭을 맞추지 않는다(좌우 여백이 달라 보임).
export const fmtPct = (pct) => `${Math.round(pct)}%`;
// 고정폭 GB 필드.
export const fmtGb = (bytes) => (bytes / 1024 ** 3).toFixed(1).padStart(4);

// `sysctl -n hw.memsize vm.pagesize vm.page_pageable_internal_count kern.memorystatus_vm_pressure_level; vm_stat` 출력 파서.
// Activity Monitor의 "Memory Used": (internal - purgeable) + wired + compressed.
export function parseMem(out) {
  const [total, page, internal, level] = out.split("\n").slice(0, 4).map(Number);
  const stat = (name) => Number((out.match(new RegExp(name + ":\\s+(\\d+)")) ?? [])[1] ?? 0);
  const used = (internal - stat("Pages purgeable") + stat("Pages wired down") + stat("Pages occupied by compressor")) * page;
  if (!total || !page || !Number.isFinite(used)) return null;
  return { used, total, pressure: PRESSURE[level] ?? "unknown" };
}

export function memLabel(m) {
  const ratio = clampRatio(m.used / m.total);
  return `RAM ${fmtGb(m.used)} / ${fmtGb(m.total)} GB (${String(Math.round(ratio * 100)).padStart(2)}%)`;
}

export const pressureLabel = (pressure) => `Pressure ${pressure.padEnd(8)}`;

// 캐시 파일이 갱신된 지 얼마나 됐는지(초 단위 나이): N초 전 · N분 전 · N시간 전 · N일 전
export function fmtAge(sec) {
  if (sec == null || !Number.isFinite(sec)) return "";
  const s = Math.floor(Math.max(0, sec));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
