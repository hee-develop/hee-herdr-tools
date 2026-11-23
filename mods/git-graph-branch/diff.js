// A file's diff, read here and drawn full size: loadDiff is shared with the
// graph's inline view; DiffView is the "diff" role (a split pane, a tab or a
// window), which reads git itself from props { root, on, commit, file }.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex, Scrollbar, v_virtual_list } from "gpui-base";
import { exec, readTextFile, theme, settings, props, closeOverlay, run, openOverlay, notify } from "herdr";
import { READ, diffArgs, diffRows } from "./git.js";
import { icon } from "./menu.js";

const ROW = 20, GUTTER = 44;

// Rows for one file of a commit (or of the working tree), or one row saying why there are none.
export async function loadDiff({ root, on, commit, file }) {
  try {
    if (commit.uncommitted && file.untracked) {
      const text = await readTextFile(`${root}/${file.path}`, { on }).catch(() => null);
      return text === null || text.includes("\0") ? [{ kind: "", text: "Binary or unreadable file" }]
        : diffRows(`@@ -0,0 +1 @@\n${text.slice(0, 400000).split("\n").slice(0, 3000).map((l) => `+${l}`).join("\n")}`);
    }
    const r = await exec("git", [...READ, ...diffArgs(commit, file.path)], { cwd: root, on });
    if (r.code !== 0) throw new Error(r.stderr.trim());
    return diffRows(r.stdout) ?? [{ kind: "", text: file.binary ? "Binary file changed" : "No text changes" }];
  } catch (e) { return [{ kind: "", text: `Can't show this diff: ${e?.message ?? e}` }]; }
}

// Opens a file's diff where the setting says (never "inline": the graph draws that itself).
// A split with no pane to split falls back to a window.
export function openDiffTarget(target, spec) {
  const viewProps = { role: "diff", ...spec }, name = spec.file.path.split("/").pop();
  const win = () => openOverlay({ mod: "git-graph-branch", kind: "window", key: "git-graph-branch-diff", width: 980, height: 680, props: viewProps });
  if (target === "window") return win();
  try {
    const r = target === "tab" ? run("tab.new", { name, mod: "git-graph-branch", props: viewProps })
      : run("pane.split", { direction: target === "down" ? "down" : "right", mod: "git-graph-branch", props: viewProps });
    if (r && typeof r === "object" && r.error) throw new Error(r.error);
  } catch (e) {
    notify({ title: "Couldn't open the diff here", body: `${e?.message ?? e} Opened in a window instead.`, level: "warning" });
    win();
  }
}

export class DiffView {
  init(cx) {
    this.listId = `graph-diff-view-${Math.random().toString(36).slice(2)}`;
    this.handle = cx.focus_handle();
    this.rows = null; this.width = 300; this.seq = 0;
    this.handle.focus();
    cx.timer.after(300, () => this.handle.focus());
    this.load(cx);
  }

  load(cx) {
    const { root, on, commit, file } = props(), id = ++this.seq;
    this.rows = null;
    cx.spawn(async (cx) => {
      const rows = await loadDiff({ root, on, commit, file });
      if (id !== this.seq) return;
      this.rows = rows; this.width = Math.max(300, ...rows.map((r) => r.text.length * 7.3 + GUTTER * 2 + 30));
      cx.notify();
    });
    cx.notify();
  }

  row(r, t) {
    if (r.kind === "@") return div().w_full().px(12).h(ROW).flex_none().truncate().bg(t.raised).text_color(t.dim).child(r.text);
    const gutter = (n) => div().w(GUTTER).flex_none().text_right().text_color(t.dim).child(n === undefined ? "" : String(n));
    return h_flex().w_full().h(ROW).flex_none().gap(10).when(r.kind === "+", (e) => e.bg(t.ansi2 + "18")).when(r.kind === "-", (e) => e.bg(t.ansi1 + "18"))
      .child(gutter(r.old)).child(gutter(r.new))
      .child(div().flex_1().min_w(0).truncate().child(r.text));
  }

  render(cx) {
    const t = theme(), mono = settings().font_family ?? "JetBrains Mono", { commit, file, overlay } = props();
    const parts = file.path.split("/"), name = parts.pop();
    const sc = file.status === "A" ? t.ansi2 : file.status === "D" || file.status === "U" ? t.ansi1 : t.blocked;
    // In a window a press the mod doesn't stop drags it: the header is the handle, buttons and body keep their clicks.
    const keep = (e) => e.on_mouse_down("left", (_e, cx) => cx.stop_propagation());
    const button = (id, child, action) => keep(div().id(id).h(24).px(7).flex_none().flex().items_center().justify_center().rounded(6).cursor_pointer().text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(action).child(child));
    const rows = this.rows;
    return v_flex().id("git-graph-diff").size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(12.5).track_focus(this.handle)
      .on_key_down((e, cx) => { if (overlay && e.key === "escape") { closeOverlay(overlay); cx.stop_propagation(); } })
      .child(h_flex().h(38).flex_none().px(12).gap(10).items_center().border_b(1).border_color(t.border)
        .child(div().w(12).flex_none().text_size(12).font_semibold().text_color(sc).child(file.status))
        .child(h_flex().flex_1().min_w(0).font_family(mono).text_size(12)
          .child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().min_w(0).truncate().child(name)))
        .when(file.add > 0, (e) => e.child(div().flex_none().text_size(11.5).text_color(t.ansi2).child(`+${file.add}`)))
        .when(file.del > 0, (e) => e.child(div().flex_none().text_size(11.5).text_color(t.ansi1).child(`−${file.del}`)))
        .child(div().flex_none().font_family(mono).text_size(11.5).text_color(t.dim).child(commit.uncommitted ? "Uncommitted" : commit.hash.slice(0, 8)))
        .child(button("graph-diff-refresh", svg(icon("refresh")).size(13).flex_none(), (_e, cx) => this.load(cx)))
        .when(Boolean(overlay), (e) => e.child(button("graph-diff-close", "×", () => closeOverlay(overlay)))))
      .child(keep(div().flex_1().min_h(0).relative().font_family(mono).text_size(12))
        .when(!rows, (e) => e.child(div().p(12).text_color(t.dim).child("Loading diff…")))
        .when(Boolean(rows), (e) => e.child(div().id(`${this.listId}-x`).size_full().overflow_x_scrollbar()
            .child(div().w_full().min_w(this.width).h_full().child(v_virtual_list(this.listId, rows.length, ROW, (i) => String(i),
              (range) => rows.slice(range.start, range.end).map((r) => this.row(r, t))).size_full())))
          .child(Scrollbar.vertical(this.listId).viewport_from_layout().absolute().inset_0())));
  }
}
