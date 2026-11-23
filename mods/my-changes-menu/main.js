// Right-click menu for a Changes row, and its Discard confirmation.
// Popup props { mode: "menu", items: [{ path, status, fresh }] } -> "Discard" / "Discard N files".
// Dialog props { mode: "confirm", items } -> Cancel / Discard, with the file list.
// (The old single-file props { path, status, fresh } still work.)
// Nothing runs here: confirming sets shared("my-changes.discard", { nonce, items }), and
// my-changes (which knows the repo root and machine) runs git.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, openOverlay, setShared, theme } from "herdr";

const MAX_LISTED = 8;
const itemsOf = (p) => (Array.isArray(p?.items) ? p.items : p?.path ? [{ path: p.path, status: p.status, fresh: p.fresh }] : []);
const isNewFile = (i) => i.fresh || i.status === "A";

// Dialog height for a file list: the overlay's size is fixed when it opens, so it is worked out from the count.
function confirmHeight(items) {
  if (items.length <= 1) return 190;
  const usable = items.filter((i) => i.status !== "U");
  if (!usable.length) return 190;
  const listed = Math.min(items.length, MAX_LISTED) + (items.length > MAX_LISTED ? 1 : 0);
  const notes = 1 + Number(usable.some(isNewFile)) + Number(usable.length < items.length);
  return 114 + 22 * notes + 4 + 18 * listed + 16;
}

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
    openOverlay({ mod: "my-changes-menu", kind: "dialog", width: items.length > 1 ? 480 : 420, height: confirmHeight(items), props: { mode: "confirm", items, overlay: undefined } });
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
      const items = itemsOf(p), multi = items.length > 1;
      const usable = items.filter((i) => i.status !== "U");
      const conflict = usable.length === 0;
      const newCount = usable.filter(isNewFile).length;
      const isNew = !multi && newCount === 1;
      const one = items[0] ?? {};
      let detail;
      if (conflict) detail = "충돌 상태의 파일은 Discard 할 수 없습니다. 먼저 충돌을 해결하세요.";
      else if (!multi) detail = isNew ? `${one.path} 파일을 삭제합니다. 되돌릴 수 없습니다.` : `${one.path} 의 변경을 되돌립니다. 되돌릴 수 없습니다.`;
      else {
        detail = v_flex().gap(2)
          .child(div().h(20).child(`${usable.length}개 파일의 변경을 되돌립니다. 되돌릴 수 없습니다.`))
          .when(newCount > 0, (e) => e.child(div().h(20).text_color(t.ansi1).child(`신규 파일 ${newCount}개는 삭제되며 되돌릴 수 없습니다.`)))
          .when(usable.length < items.length, (e) => e.child(div().h(20).child(`충돌 상태 ${items.length - usable.length}개는 건너뜁니다.`)))
          .child(v_flex().pt(4).children(items.slice(0, MAX_LISTED).map((i) => h_flex().h(18).gap(8).child(div().w(12).flex_none().text_color(t.dim).child(i.status ?? "")).child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(i.path)))))
          .when(items.length > MAX_LISTED, (e) => e.child(div().h(18).pl(20).text_color(t.dim).child(`외 ${items.length - MAX_LISTED}개`)));
      }
      const button = (id, label, bg, fg, onClick) =>
        h_flex().id(id).h(32).px(14).items_center().rounded(8).border_1().border_color(id === "no" ? t.input : bg).bg(bg).text_color(fg).cursor_pointer().hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
      return v_flex().id("my-changes-confirm").track_focus(this.handle).on_key_down(onKey(() => (conflict ? this.close() : this.confirm())))
        .size_full().min_h(0).p(18).gap(12).rounded(8).bg(t.popover).text_size(13)
        .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child(multi && !conflict ? `Discard ${items.length} files?` : isNew && !conflict ? "Delete file?" : "Discard changes?")).child(div().text_size(11).text_color(t.dim).child("Esc")))
        .child(div().flex_1().min_h(0).overflow_y_scrollbar().text_color(t.muted).child(detail))
        .child(h_flex().justify_end().gap(8).text_size(12)
          .child(button("no", conflict ? "Close" : "Cancel", t.raised, t.foreground, () => this.close()))
          .when(!conflict, (e) => e.child(button("yes", "Discard", t.solid, t.solid_foreground, () => this.confirm()))));
    }
    return v_flex().id("my-changes-menu").track_focus(this.handle).on_key_down(onKey(() => this.discard()))
      .p(6).rounded(8).bg(t.popover).text_size(13)
      .child(h_flex().id("discard").h(28).px(8).items_center().rounded(6).cursor_pointer().text_color(t.foreground).hover((s) => s.bg(t.hover)).on_click(() => this.discard()).child(itemsOf(p).length > 1 ? `Discard ${itemsOf(p).length} files` : "Discard"));
  }
}
