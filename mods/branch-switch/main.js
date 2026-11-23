// Branch switcher modelled on VS Code's "Checkout to..." quick pick.
// Open with `mod.open:branch-switch`. Local refs only: nothing is fetched.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar, v_virtual_list, VirtualListScrollHandle } from "gpui-base";
import { focused, spaces, panes, exec, notify, theme, props, closeOverlay } from "herdr";
import { ROW, PLACEHOLDER, parseRefs, buildRows, pickableRows, resolveChoice, createArgs, errorText, wrapIndex, scrollTarget, pickFolder, clampIndex, sanitizeBranchName } from "./logic.js";

async function git(cwd, args, on) {
  const r = await exec("git", args, { cwd, on, timeout: 120_000 });
  return { ok: r.code === 0, out: r.stdout ?? "", err: (r.stderr || r.stdout || "").trim() };
}

// Local branches (newest commit first), remote branches (minus HEAD) and tags.
async function readRefs(cwd, on) {
  const fmt = "%(refname)%09%(objectname:short=7)%09%(HEAD)%09%(contents:subject)";
  const r = await git(cwd, ["for-each-ref", "--sort=-committerdate", `--format=${fmt}`, "refs/heads", "refs/remotes", "refs/tags"], on);
  if (!r.ok) throw new Error(r.err || "git for-each-ref failed.");
  return parseRefs(r.out);
}

export default class BranchSwitch extends View {
  init(_props, cx) {
    this.modes = ["pick"]; // stack: the last one is shown
    this.base = null; // ref chosen in "from" mode
    this.filter = "";
    this.at = 0;
    this.error = "";
    this.busy = false;
    this.refs = undefined; // undefined: loading, null: not a repository
    this.fatal = "";
    this.scrollH = VirtualListScrollHandle.new();
    this.range = { start: 0, end: 10 };
    this.handle = cx.focus_handle();
    this.inputs = {};
    for (const mode of Object.keys(PLACEHOLDER)) {
      const input = InputState.new({ placeholder: PLACEHOLDER[mode] });
      input.on("change", (_e, cx) => {
        if (this.mode() !== mode) return;
        this.filter = input.value();
        this.at = 0;
        this.error = "";
        this.scrollH.scroll_to_item(0);
        cx.notify();
      });
      input.on("submit", (_e, cx) => this.submit(cx));
      this.inputs[mode] = input;
    }
    this.inputs.pick.focus();
    cx.timer.after(400, () => this.inputs[this.mode()].focus());

    const f = focused();
    const space = spaces().find((s) => s.id === f?.space);
    this.on = space?.machine ?? null;
    const folder = pickFolder(props()?.folder, f, space, panes());
    this.folder = folder;
    cx.spawn(async (cx) => {
      try {
        const top = folder ? await git(folder, ["rev-parse", "--show-toplevel"], this.on) : { ok: false };
        if (!top.ok) this.refs = null;
        else {
          this.top = top.out.trim();
          this.refs = await readRefs(this.top, this.on);
        }
      } catch (error) {
        this.refs = null;
        this.fatal = String(error?.message ?? error);
      }
      cx.notify();
    });
  }

  mode() { return this.modes[this.modes.length - 1]; }
  close() { closeOverlay(props().overlay); }

  enter(mode, cx) {
    this.modes.push(mode);
    this.resetInput(cx);
  }

  resetInput(cx) {
    this.filter = "";
    this.at = 0;
    this.error = "";
    const input = this.inputs[this.mode()];
    input.set_value("");
    input.focus();
    this.scrollH.scroll_to_item(0);
    cx.notify();
  }

  back(cx) {
    if (this.busy) return;
    if (this.modes.length > 1) {
      this.modes.pop();
      this.resetInput(cx);
    } else this.close();
  }

  // The rows for the current mode and filter: actions, separators and refs.
  rows() {
    return buildRows(this.refs, this.mode(), this.filter);
  }

  submit(cx) {
    if (this.busy || this.refs === undefined || this.refs === null) return;
    if (this.mode() === "name") return this.create(cx);
    const rows = this.rows();
    const pickable = pickableRows(rows);
    this.choose(pickable[this.at], cx);
  }

  choose(r, cx) {
    if (!r || this.busy) return;
    const mode = this.mode();
    const d = resolveChoice(r, mode, this.refs);
    if (d.do === "enter") {
      this.base = null;
      this.enter(d.mode, cx);
    } else if (d.do === "base") {
      this.base = r;
      this.enter("name", cx);
    } else if (d.do === "close") return this.close();
    else this.run(d.args, d.label, cx);
  }

  create(cx) {
    const c = createArgs(this.inputs.name.value(), this.base);
    if (!c) return;
    this.run(c.args, c.label, cx);
  }

  run(args, label, cx) {
    this.busy = true;
    this.error = "";
    cx.notify();
    cx.spawn(async (cx) => {
      let r;
      try { r = await git(this.top, args, this.on); }
      catch (error) { r = { ok: false, err: String(error?.message ?? error) }; }
      this.busy = false;
      if (r.ok) {
        notify({ title: `Switched to ${label}`, level: "success" });
        this.close();
      } else {
        this.error = errorText(r.err);
      }
      cx.notify();
    });
  }

  move(delta, count, rows) {
    if (!count) return;
    this.at = wrapIndex(this.at, delta, count);
    // Keep the selection on screen: the list reports which rows it drew.
    const pickable = pickableRows(rows);
    const idx = rows.indexOf(pickable[this.at]);
    const target = scrollTarget(this.at, idx, this.range);
    if (target !== null) this.scrollH.scroll_to_item(target);
  }

  render(cx) {
    const t = theme();
    const mode = this.mode();
    const rows = this.rows();
    const pickable = pickableRows(rows);
    this.at = clampIndex(this.at, pickable.length);
    const sel = pickable[this.at];
    const hint = {
      pick: "↑↓ choose · ↵ checkout · esc close",
      from: "↑↓ choose · ↵ select base · esc back",
      detach: "↑↓ choose · ↵ detach · esc back",
      name: "↵ create · esc back",
    }[mode];

    const label = (r) => {
      if (r.kind === "sep") {
        return h_flex().flex_none().h(ROW).px(10).items_end().pb(3).text_size(11).font_semibold().text_color(t.dim).child(r.label);
      }
      const on = r === sel;
      const base = h_flex().h(ROW).px(10).gap(8).items_center().rounded(6).cursor_pointer().when(on, (el) => el.bg(t.selected)).when(!on, (el) => el.hover((s) => s.bg(t.hover)));
      if (r.kind === "action") return base.child(div().flex_1().truncate().text_color(t.foreground).child(r.label));
      return base
        .child(div().w(14).flex_none().text_color(t.accent).child(r.current ? "✓" : ""))
        .child(div().flex_none().max_w(260).truncate().text_color(t.foreground).when(r.current, (d) => d.font_semibold()).child(r.name))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(`${r.hash}  ${r.subject}`));
    };

    let body;
    if (this.refs === undefined) body = div().p(10).text_color(t.muted).child("…");
    else if (this.refs === null) {
      body = div().p(10).text_color(t.muted).child(this.fatal || "Not a git repository");
    } else if (mode === "name") {
      const name = sanitizeBranchName(this.filter);
      body = div().p(10).text_color(t.muted).child(name ? `Press Enter to create branch "${name}" from ${this.base ? this.base.name : "HEAD"}` : "Please provide a new branch name");
    } else {
      body = v_flex().relative().flex_none().w_full().h(Math.max(ROW, Math.min(rows.length * ROW, 360)))
        .child(
          v_virtual_list("bs-list", rows.length, ROW, (i) => String(i), (range) => {
            this.range = { start: range.start, end: range.end };
            return rows.slice(range.start, range.end).map(label);
          }).id("bs-list").track_scroll(this.scrollH).size_full().on_item_click((key, cx) => this.choose(rows[Number(key)], cx)),
        )
        .child(Scrollbar.vertical("bs-list").absolute().inset_0())
        .when(rows.length === 0, (el) => el.child(div().absolute().top(0).left(0).p(10).text_color(t.dim).child("No matching branches or tags")));
    }

    return v_flex()
      .id("branch-switch")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(12)
      .gap(8)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "escape") { this.back(cx); cx.stop_propagation(); return; }
        if (mode === "name" || !this.refs) return;
        if (e.key === "down") this.move(1, pickable.length, rows);
        else if (e.key === "up") this.move(-1, pickable.length, rows);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .when(Boolean(this.refs) || this.refs === undefined, (el) =>
        el.child(Input.new(this.inputs[mode]).h(32).flex_none().px(10).items_center().rounded(6).border(1).border_color(t.accent).bg(t.background).text_color(t.foreground)),
      )
      .child(body)
      .when(Boolean(this.error), (el) => el.child(div().flex_none().text_size(12).text_color(t.blocked).child(this.error)))
      .child(h_flex().flex_none().justify_end().text_size(11).text_color(t.dim).child(this.busy ? "working…" : this.refs === null ? "esc close" : hint));
  }
}
