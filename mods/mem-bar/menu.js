// mem-bar 사용량 영역의 우클릭 팝업 화면: 계정, 갱신 경과 시간, "새로고침".
// props { menu: true, updatedAt, account }. updatedAt은 rate-limits 캐시의 갱신 시각(초).
// 여기서는 아무것도 읽지 않는다: 클릭하면 shared("mem-bar.refresh", { nonce })를 쓰고, 바 인스턴스가 데이터를 다시 읽는다.

import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, setShared, theme } from "herdr";
import { fmtAge } from "./logic.js";

export function dismissMenu() { closeOverlay(props().overlay); }

export function requestRefresh() {
  dismissMenu();
  setShared("mem-bar.refresh", { nonce: Date.now() + Math.random() });
}

// handle: 메뉴 인스턴스의 focus handle(Enter/Esc 키를 받는다).
export function renderMenu(handle) {
  const t = theme(), p = props() ?? {};
  const onKey = (e, cx) => {
    if (e.key === "enter") requestRefresh();
    else if (e.key === "escape") dismissMenu();
    else return;
    cx.stop_propagation();
  };
  const age = p.updatedAt ? fmtAge(Date.now() / 1000 - p.updatedAt) : "";
  return v_flex().id("mem-bar-popup").track_focus(handle).on_key_down(onKey)
    .p(6).rounded(8).bg(t.popover).text_size(12)
    .child(h_flex().id("account").h(20).px(8).items_center().text_size(11).text_color(t.dim).truncate().child(p.account ?? "계정 정보 없음"))
    .child(h_flex().id("refresh").h(28).px(8).gap(12).items_center().rounded(6).cursor_pointer().text_color(t.foreground).hover((s) => s.bg(t.hover)).on_click(() => requestRefresh())
      .child(div().flex_1().child("새로고침"))
      // "갱신"과 값 사이: 공백 문자(약 3px)의 절반 수준인 1.5px.
      .when(age !== "", (e) => e.child(h_flex().gap(1.5).text_size(10).text_color(t.dim).child("갱신").child(age))));
}
