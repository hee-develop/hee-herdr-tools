import test from "node:test";
import assert from "node:assert/strict";
import { parseRate, fmtLeft, parseMem, isHot, clampRatio, gaugeWidth, fmtPct, fmtGb, memLabel, pressureLabel, HOT_PERCENT, fmtAge } from "../mods/mem-bar/logic.js";

const NOW = 1_800_000_000; // 초

test("parseRate: 정상 값, 남은 시간 계산", () => {
  const text = JSON.stringify({
    five_hour: { used_percentage: 42.5, resets_at: NOW + 3600 },
    seven_day: { used_percentage: 10, resets_at: NOW + 3 * 86400 },
    updated_at: NOW - 5,
  });
  assert.deepEqual(parseRate(text, NOW), { h5: { pct: 42.5, left: 3600 }, d7: { pct: 10, left: 3 * 86400 }, updatedAt: NOW - 5, account: null });
});

test("parseRate: resets_at이 지났거나 같으면 pct·left는 null(\"--\")", () => {
  const text = JSON.stringify({
    five_hour: { used_percentage: 99, resets_at: NOW - 1 },
    seven_day: { used_percentage: 50, resets_at: NOW }, // 경계: <= now 이면 지남
  });
  const r = parseRate(text, NOW);
  assert.deepEqual([r.h5, r.d7], [{ pct: null, left: null }, { pct: null, left: null }]);
  // 1초 남았으면 아직 유효
  assert.deepEqual(parseRate(JSON.stringify({ five_hour: { used_percentage: 1, resets_at: NOW + 1 } }), NOW).h5, { pct: 1, left: 1 });
});

test("parseRate: resets_at 없음/문자열 숫자/잘못된 창", () => {
  const r = parseRate(JSON.stringify({ five_hour: { used_percentage: 7 }, seven_day: { used_percentage: "x", resets_at: NOW + 60 } }), NOW);
  assert.deepEqual(r.h5, { pct: 7, left: null });
  assert.equal(r.d7, null); // used_percentage가 숫자가 아님
  assert.equal(parseRate(JSON.stringify({ five_hour: { used_percentage: 3, resets_at: String(NOW + 60) } }), NOW).h5.left, 60);
  assert.equal(parseRate("{}", NOW), null);
  assert.equal(parseRate(JSON.stringify({ five_hour: null, seven_day: null }), NOW), null);
  assert.throws(() => parseRate("not json", NOW));
});

test("parseRate: updatedAt(캐시 갱신 시각, 초)", () => {
  const w = { five_hour: { used_percentage: 1, resets_at: NOW + 60 } };
  assert.equal(parseRate(JSON.stringify({ ...w, updated_at: 1500 }), NOW).updatedAt, 1500);
  assert.equal(parseRate(JSON.stringify(w), NOW).updatedAt, null); // 없음
  assert.equal(parseRate(JSON.stringify({ ...w, updated_at: 0 }), NOW).updatedAt, null);
  assert.equal(parseRate(JSON.stringify({ ...w, updated_at: "x" }), NOW).updatedAt, null);
});

test("parseRate: account는 비어 있지 않은 문자열만 통과, 나머지는 null", () => {
  const w = { five_hour: { used_percentage: 1, resets_at: NOW + 60 } };
  const account = (v) => parseRate(JSON.stringify({ ...w, account: v }), NOW).account;
  assert.equal(account("person-a"), "person-a");
  assert.equal(account(""), null);
  assert.equal(account(5), null);
  assert.equal(account(null), null);
  assert.equal(parseRate(JSON.stringify(w), NOW).account, null); // 필드 없음
  // account가 있어도 창 값은 그대로
  assert.deepEqual(parseRate(JSON.stringify({ ...w, account: "person-a" }), NOW).h5, { pct: 1, left: 60 });
});

test("fmtLeft: 영어 한 글자 단위(m/h/d) 경계", () => {
  assert.equal(fmtLeft(null), "");
  assert.equal(fmtLeft(undefined), "");
  assert.equal(fmtLeft(0), "0m");
  assert.equal(fmtLeft(59), "0m");
  assert.equal(fmtLeft(42 * 60), "42m");
  assert.equal(fmtLeft(59 * 60 + 59), "59m");
  assert.equal(fmtLeft(3600), "1h");
  assert.equal(fmtLeft(2 * 3600 + 40 * 60), "2h 40m");
  assert.equal(fmtLeft(24 * 3600), "1d");
  assert.equal(fmtLeft(5 * 86400 + 7 * 3600 + 59 * 60), "5d 7h");
  assert.equal(fmtLeft(23 * 3600 + 59 * 60), "23h 59m");
});

test("90% 경계: isHot", () => {
  assert.equal(HOT_PERCENT, 90);
  assert.equal(isHot(89.99), false);
  assert.equal(isHot(90), true);
  assert.equal(isHot(100), true);
  assert.equal(isHot(0), false);
});

test("clampRatio / gaugeWidth / fmtPct", () => {
  assert.equal(clampRatio(-0.5), 0);
  assert.equal(clampRatio(0.4), 0.4);
  assert.equal(clampRatio(1.7), 1);
  assert.equal(gaugeWidth(48, 0.5), 24);
  assert.equal(gaugeWidth(48, 1), 48);
  assert.equal(gaugeWidth(48, 0), 0);
  assert.equal(fmtPct(5), "5%"); // 앞쪽 공백으로 폭을 맞추지 않는다
  assert.equal(fmtPct(89.6), "90%");
  assert.equal(fmtPct(100), "100%");
});

const VM = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               1000.
Pages purgeable:                          100.
Pages wired down:                         200.
Pages occupied by compressor:             300.
`;

test("parseMem: 사용량 = (internal - purgeable + wired + compressed) * page", () => {
  const out = `${17179869184}\n16384\n1000\n1\n${VM}`;
  const m = parseMem(out);
  assert.equal(m.total, 17179869184);
  assert.equal(m.used, (1000 - 100 + 200 + 300) * 16384);
  assert.equal(m.pressure, "normal");
  assert.equal(parseMem(`1\n1\n0\n2\n`).pressure, "warning");
  assert.equal(parseMem(`${17179869184}\n16384\n1000\n4\n${VM}`).pressure, "critical");
  assert.equal(parseMem(`${17179869184}\n16384\n1000\n9\n${VM}`).pressure, "unknown");
});

test("parseMem: 잘못된 출력은 null", () => {
  assert.equal(parseMem(""), null);
  assert.equal(parseMem("0\n16384\n1\n1\n"), null); // total 0
  assert.equal(parseMem("100\n0\n1\n1\n"), null); // page 0
  assert.equal(parseMem("abc\n16384\n1\n1\n"), null); // NaN
});

test("fmtGb / memLabel / pressureLabel", () => {
  assert.equal(fmtGb(1024 ** 3), " 1.0");
  assert.equal(fmtGb(12.34 * 1024 ** 3), "12.3");
  assert.equal(memLabel({ used: 8 * 1024 ** 3, total: 16 * 1024 ** 3 }), "RAM  8.0 / 16.0 GB (50%)");
  assert.equal(memLabel({ used: 20 * 1024 ** 3, total: 16 * 1024 ** 3 }), "RAM 20.0 / 16.0 GB (100%)"); // 비율은 100%로 제한
  assert.equal(memLabel({ used: 0, total: 16 * 1024 ** 3 }), "RAM  0.0 / 16.0 GB ( 0%)");
  assert.equal(pressureLabel("normal"), "Pressure normal  ");
  assert.equal(pressureLabel("critical"), "Pressure critical");
});

test("fmtAge: 초/분/시간/일 경계", () => {
  assert.equal(fmtAge(0), "0초 전");
  assert.equal(fmtAge(1), "1초 전");
  assert.equal(fmtAge(59), "59초 전");
  assert.equal(fmtAge(59.9), "59초 전"); // 초는 내림
  assert.equal(fmtAge(60), "1분 전");
  assert.equal(fmtAge(3599), "59분 전");
  assert.equal(fmtAge(3600), "1시간 전");
  assert.equal(fmtAge(86399), "23시간 전");
  assert.equal(fmtAge(86400), "1일 전");
  assert.equal(fmtAge(3 * 86400 + 5), "3일 전");
});

test("fmtAge: null/비유한수는 빈 문자열, 음수는 0으로 취급", () => {
  assert.equal(fmtAge(null), "");
  assert.equal(fmtAge(undefined), "");
  assert.equal(fmtAge(NaN), "");
  assert.equal(fmtAge(Infinity), "");
  assert.equal(fmtAge(-5), "0초 전");
});
