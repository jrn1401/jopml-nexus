// Design-Optionen (pro Gerät): Hell/Dunkel, Akzentfarbe, Dichte, Schriftgröße, weniger Bewegung.
import { local } from "./api.js";
import { h, toast } from "./ui.js";

const ACCENTS = [["", "#8b8cff", "Violett"], ["blue", "#4f9dff", "Blau"], ["teal", "#2ec4c4", "Türkis"], ["green", "#34c77b", "Grün"], ["orange", "#ff9a3d", "Orange"], ["pink", "#ff5fa2", "Pink"], ["red", "#ff5c5c", "Rot"]];

export function applyDesign() {
  const r = document.documentElement;
  const t = local.get("theme", "dark");
  r.dataset.theme = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
  const a = local.get("accent", ""); if (a) r.dataset.accent = a; else delete r.dataset.accent;
  const d = local.get("density", ""); if (d) r.dataset.density = d; else delete r.dataset.density;
  const f = local.get("fontscale", ""); r.style.fontSize = f ? `${f}%` : "";
  if (local.get("reducemotion", false)) r.dataset.motion = "reduce"; else delete r.dataset.motion;
}

export function designPanel() {
  const seg = (key, opts, def) => {
    const cur = local.get(key, def);
    const box = h("div.seg", opts.map(([v, t]) => h("button", { class: String(v) === String(cur) ? "on" : "", onclick: (e) => {
      local.set(key, v); box.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); applyDesign(); toast("Gespeichert");
    } }, t)));
    return box;
  };
  const cur = local.get("accent", "");
  const sw = h("div.swatches", ACCENTS.map(([v, c, n]) => h("button.swatch", { class: v === cur ? "on" : "", title: n, "aria-label": `Akzentfarbe ${n}`, style: { background: c }, onclick: (e) => {
    local.set("accent", v); sw.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); applyDesign();
  } })));
  const row = (label, el, sub) => h("div.list-item", h("div.li-main", h("div.li-title", label), sub ? h("div.li-sub", sub) : null), el);
  const motion = h("input", { type: "checkbox", checked: local.get("reducemotion", false), onchange: (e) => { local.set("reducemotion", e.target.checked); applyDesign(); } });
  return h("div.list",
    row("Darstellung", seg("theme", [["dark", "Dunkel"], ["light", "Hell"], ["system", "System"]], "dark")),
    row("Akzentfarbe", sw),
    row("Dichte", seg("density", [["", "Normal"], ["compact", "Kompakt"]], "")),
    row("Schriftgröße", seg("fontscale", [["90", "Klein"], ["", "Normal"], ["110", "Groß"], ["120", "Sehr groß"]], "")),
    row("Weniger Bewegung", h("label.switch", motion, h("span")), "Animationen ausschalten"));
}
