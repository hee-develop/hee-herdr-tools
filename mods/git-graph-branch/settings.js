// The gear's popup, opened with props { role: "settings" }: which columns show,
// where file diffs open, Manygit's scan depth and whether rows show their newest
// tag. Each applies at once.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme, shared, setShared } from "herdr";
import { DEPTH, depthOf } from "./repos.js";
import { icon } from "./menu.js";
import { COLUMN_KEYS, columnsVisible, DIFF_TARGETS, diffTargetOf } from "./git.js";

const COLUMN_TITLES = { graph: "Graph", description: "Description", date: "Date", author: "Author", hash: "Commit" };
const TARGET_TITLES = { inline: "In the panel", right: "Split right", down: "Split down", tab: "New tab", window: "Window" };
// 30px rows, 22px headings, 12px padding, and the 9px divider before the last two rows.
export const settingsHeight = () => 24 + 2 * 22 + (COLUMN_KEYS.length + DIFF_TARGETS.length + 2) * 30 + 9;

export class Settings {
  init(cx) {
    this.state = InputState.new({ value: String(depthOf(shared("git-graph.depth"))) });
    this.valid = true;
    // A number from 1 to 5 applies as it's typed; anything else only turns the box red.
    this.state.on("change", (_e, cx) => {
      const text = this.state.value().trim(), n = Number(text);
      this.valid = /^\d+$/.test(text) && n >= DEPTH.min && n <= DEPTH.max;
      if (this.valid) setShared("git-graph.depth", n);
      cx.notify();
    });
    this.state.on("submit", () => { if (this.valid) closeOverlay(props().overlay); });
    this.state.set_selected_range({ start: 0, end: this.state.value().length });
    this.state.focus();
    cx.timer.after(300, () => this.state.focus());
  }

  render() {
    const t = theme(), tags = shared("git-graph.tags") === true;
    const vis = columnsVisible(shared("git-graph-branch.visible")), target = diffTargetOf(shared("git-graph-branch.diffTarget"));
    const heading = (text) => div().h(22).flex_none().pt(6).text_size(11).text_color(t.dim).child(text);
    const row = (id, label, action) => h_flex().id(id).h(30).flex_none().gap(10).items_center().cursor_pointer().on_click(action).child(div().flex_1().font_medium().child(label));
    const mark = (on, round) => div().size(15).mr(4).flex_none().rounded(round ? 8 : 4).border_1().border_color(on ? t.accent : t.input).when(on, (e) => e.bg(t.accent))
      .flex().items_center().justify_center().when(on, (e) => e.child(svg(icon("check")).size(11).text_color(t.accent_foreground)));
    const only = COLUMN_KEYS.filter((k) => vis[k]).length === 1;
    return v_flex().id("git-graph-settings").size_full().p(12).bg(t.popover).text_size(12.8).text_color(t.foreground)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); } })
      .child(heading("Columns"))
      .children(COLUMN_KEYS.map((k) => row(`gs-col-${k}`, COLUMN_TITLES[k], (_e, cx) => {
        // The last visible column stays: a table with none has nothing to show.
        if (vis[k] && only) return;
        setShared("git-graph-branch.visible", { ...vis, [k]: !vis[k] }); cx.notify();
      }).child(mark(vis[k], false))))
      .child(heading("Open file diffs in"))
      .children(DIFF_TARGETS.map((k) => row(`gs-target-${k}`, TARGET_TITLES[k], (_e, cx) => { setShared("git-graph-branch.diffTarget", k); cx.notify(); }).child(mark(target === k, true))))
      .child(div().h(1).flex_none().mt(4).mb(4).bg(t.border))
      .child(h_flex().h(30).flex_none().gap(10).items_center()
        .child(div().flex_1().font_medium().child("Scan depth"))
        .child(Input.new(this.state).w(56).h(30).px(8).rounded(7).border_1().border_color(this.valid ? t.input : t.ansi1)
          .bg(t.background).text_size(12.8).text_color(t.foreground)))
      .child(row("gs-tags", "Show tags", (_e, cx) => { setShared("git-graph.tags", !tags); cx.notify(); }).child(mark(tags, false)));
  }
}
