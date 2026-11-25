import test from "node:test";
import assert from "node:assert/strict";
import { fmtAge } from "../mods/mem-bar-menu/logic.js";

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
