import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, exec, settings, readTextFile, home } from "herdr";
import { parseRate, fmtLeft, parseMem, isHot, clampRatio, gaugeWidth, fmtPct, memLabel, pressureLabel } from "./logic.js";

// macOS memory, computed like Activity Monitor's "Memory Used":
// app memory (internal - purgeable) + wired + compressed.
const MEM_SCRIPT = "sysctl -n hw.memsize vm.pagesize vm.page_pageable_internal_count kern.memorystatus_vm_pressure_level; vm_stat";
// Orange family: light → deep as pressure rises.
const ORANGE = { fill: "#f97316", track: "#f9731633", normal: "#fdba74", warning: "#f97316", critical: "#c2410c" };
const GAUGE_W = 48;

// Claude Code usage limits, cached by ~/.claude/statusline-command.sh on each status line render.
const RATE_FILE = "/.claude/state/rate-limits.json";
// Blue family, so usage reads as a separate group from the orange RAM gauge.
const BLUE = { fill: "#60a5fa", track: "#60a5fa33", hot: "#ef4444" };
const RATE_GAUGE_W = 48;

export default class MemBar extends View {
  init(_props, cx) {
    this.mem = null;
    this.rate = null;
    this.refresh(cx);
    cx.timer.every(5000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await exec("/bin/sh", ["-c", MEM_SCRIPT], { timeout: 4000 });
        this.mem = parseMem(r.stdout);
      } catch (_e) {
        this.mem = null;
      }
      try {
        this.rate = parseRate(await readTextFile(home() + RATE_FILE), Date.now() / 1000);
      } catch (_e) {
        this.rate = null;
      }
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const m = this.mem;
    let bar = h_flex().size_full().px(14).gap(10).items_center().justify_end().bg(t.chrome).font_family(settings().font_family ?? "JetBrains Mono").text_size(11.5).text_color(t.muted);
    if (this.rate) bar = this.rateParts(bar, this.rate, t, !!m);
    if (m) bar = this.memParts(bar, m, t);
    return bar;
  }

  rateParts(bar, r, t, beforeMem) {
    // Divider + extra gap: Claude usage is a different group from machine memory.
    const item = (label, w) => {
      const pct = w?.pct;
      const row = h_flex().gap(3).items_center().child(div().text_color(t.dim).child(label));
      if (pct == null) return row.child(div().child("--"));
      const ratio = clampRatio(pct / 100);
      const hot = isHot(pct);
      return row
        .child(div().w(RATE_GAUGE_W).h(6).rounded(3).bg(BLUE.track)
          .child(div().h_full().w(gaugeWidth(RATE_GAUGE_W, ratio)).rounded(3).bg(hot ? BLUE.hot : BLUE.fill).transition("width", 400)))
        .child(div().text_color(hot ? BLUE.hot : t.muted).child(fmtPct(pct)))
        .child(div().text_color(t.dim).child(fmtLeft(w.left)));
    };
    // Wider gap between the two windows than inside one, so "36m" reads as 5h's, not 주간's.
    bar = bar.child(h_flex().gap(10).items_center().child(item("5시간", r.h5)).child(div().text_color(t.dim).child("·")).child(item("주간", r.d7)));
    return beforeMem ? bar.child(div().w(1).h(14).mx(4).bg(t.border)) : bar;
  }

  memParts(bar, m, t) {
    const ratio = clampRatio(m.used / m.total);
    const dot = ORANGE[m.pressure] ?? t.dim;
    return bar
      .child(div().w(GAUGE_W).h(6).rounded(3).bg(ORANGE.track)
        .child(div().h_full().w(gaugeWidth(GAUGE_W, ratio)).rounded(3).bg(ORANGE.fill).transition("width", 400)))
      .child(div().child(memLabel(m)))
      .child(h_flex().gap(6).items_center()
        .child(div().size(6).rounded(3).bg(dot))
        .child(div().text_color(m.pressure === "normal" ? t.muted : dot).child(pressureLabel(m.pressure))));
  }
}
