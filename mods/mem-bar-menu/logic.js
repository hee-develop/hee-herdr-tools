// 캐시 파일이 갱신된 지 얼마나 됐는지(초 단위 나이): N초 전 · N분 전 · N시간 전 · N일 전
// (mod 간 상대 import는 herdr가 막으므로 이 mod 안에 둔다.)
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
