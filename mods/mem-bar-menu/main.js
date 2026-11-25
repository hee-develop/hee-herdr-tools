// Right-click popup for mem-bar's Claude usage area: "새로고침".
// Popup props { updatedAt } (seconds, from the rate-limits cache file).
// Nothing is read here: clicking sets shared("mem-bar.refresh", { nonce }), and mem-bar re-reads its data.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, setShared, theme } from "herdr";
import { fmtAge } from "./logic.js";

export default class MemBarMenu extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    // 열려 있는 동안 1초마다 다시 그려 "갱신 N초 전"이 올라가게 한다.
    this.tick = cx.timer.every(1000, (cx) => cx.notify());
  }

  // 팝업이 닫힐 때 1초 타이머(Task)를 취소한다.
  async close(_cx) { this.tick?.cancel(); }

  dismiss() { closeOverlay(props().overlay); }

  refresh() {
    this.dismiss();
    setShared("mem-bar.refresh", { nonce: Date.now() + Math.random() });
  }

  render(_cx) {
    const t = theme(), p = props() ?? {};
    const onKey = (e, cx) => {
      if (e.key === "enter") this.refresh();
      else if (e.key === "escape") this.dismiss();
      else return;
      cx.stop_propagation();
    };
    const age = p.updatedAt ? fmtAge(Date.now() / 1000 - p.updatedAt) : "";
    return v_flex().id("mem-bar-menu").track_focus(this.handle).on_key_down(onKey)
      .p(6).rounded(8).bg(t.popover).text_size(12)
      .child(h_flex().id("account").h(20).px(8).items_center().text_size(11).text_color(t.dim).truncate().child(p.account ?? "계정 정보 없음"))
      .child(h_flex().id("refresh").h(28).px(8).gap(12).items_center().rounded(6).cursor_pointer().text_color(t.foreground).hover((s) => s.bg(t.hover)).on_click(() => this.refresh())
        .child(div().flex_1().child("새로고침"))
        // "갱신"과 값 사이: 공백 문자(약 3px)의 절반 수준인 1.5px.
        .when(age !== "", (e) => e.child(h_flex().gap(1.5).text_size(10).text_color(t.dim).child("갱신").child(age))));
  }
}
