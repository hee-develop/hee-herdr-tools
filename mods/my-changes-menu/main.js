// Right-click menu for a Changes row, and its Discard confirmation.
// Popup props { mode: "menu", items: [{ path, status, fresh }] } -> "Discard" / "Discard N files".
// Dialog props { mode: "confirm", items } -> Cancel / Discard, with the file list.
// (The old single-file props { path, status, fresh } still work.)
// Nothing runs here: confirming sets shared("my-changes.discard", { nonce, items }), and
// my-changes (which knows the repo root and machine) runs git.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { itemsOf, confirmHeight, dialogWidth, confirmModel, menuLabel } from "./logic.js";
import { props, closeOverlay, openOverlay, setShared, theme } from "herdr";

export default class ChangesMenu extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  close() { closeOverlay(props().overlay); }

  discard() {
    const p = props();
    this.close();
    const items = itemsOf(p);
    openOverlay({ mod: "my-changes-menu", kind: "dialog", width: dialogWidth(items), height: confirmHeight(items), props: { mode: "confirm", items, overlay: undefined } });
  }

  confirm() {
    const items = itemsOf(props());
    this.close();
    if (items.length) setShared("my-changes.discard", { nonce: Date.now() + Math.random(), items });
  }

  render(cx) {
    const t = theme(), p = props() ?? {};
    const onKey = (enter) => (e, cx) => {
      if (e.key === "enter") enter();
      else if (e.key === "escape") this.close();
      else return;
      cx.stop_propagation();
    };
    if (p.mode === "confirm") {
      const items = itemsOf(p), m = confirmModel(items), { conflict } = m;
      let detail;
      if (m.detail !== undefined) detail = m.detail;
      else {
        detail = v_flex().gap(2)
          .child(div().h(20).child(m.summary))
          .when(m.newNote !== null, (e) => e.child(div().h(20).text_color(t.ansi1).child(m.newNote)))
          .when(m.conflictNote !== null, (e) => e.child(div().h(20).child(m.conflictNote)))
          .child(v_flex().pt(4).children(m.listed.map((i) => h_flex().h(18).gap(8).child(div().w(12).flex_none().text_color(t.dim).child(i.status ?? "")).child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(i.path)))))
          .when(m.more !== null, (e) => e.child(div().h(18).pl(20).text_color(t.dim).child(m.more)));
      }
      const button = (id, label, bg, fg, onClick) =>
        h_flex().id(id).h(32).px(14).items_center().rounded(8).border_1().border_color(id === "no" ? t.input : bg).bg(bg).text_color(fg).cursor_pointer().hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
      return v_flex().id("my-changes-confirm").track_focus(this.handle).on_key_down(onKey(() => (conflict ? this.close() : this.confirm())))
        .size_full().min_h(0).p(18).gap(12).rounded(8).bg(t.popover).text_size(13)
        .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child(m.title)).child(div().text_size(11).text_color(t.dim).child("Esc")))
        .child(div().flex_1().min_h(0).overflow_y_scrollbar().text_color(t.muted).child(detail))
        .child(h_flex().justify_end().gap(8).text_size(12)
          .child(button("no", conflict ? "Close" : "Cancel", t.raised, t.foreground, () => this.close()))
          .when(!conflict, (e) => e.child(button("yes", "Discard", t.solid, t.solid_foreground, () => this.confirm()))));
    }
    return v_flex().id("my-changes-menu").track_focus(this.handle).on_key_down(onKey(() => this.discard()))
      .p(6).rounded(8).bg(t.popover).text_size(13)
      .child(h_flex().id("discard").h(28).px(8).items_center().rounded(6).cursor_pointer().text_color(t.foreground).hover((s) => s.bg(t.hover)).on_click(() => this.discard()).child(menuLabel(itemsOf(p))));
  }
}
