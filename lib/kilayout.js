// Gemeinsames Layout für alle KI-Seiten (KI-Studio, Recht & Formulare):
// links die Arbeitsfläche, rechts eine Seitenleiste mit aktivem Modell, Tagesbudget, Schnellstart und Tipps.
// Auf Tablet/Handy rutscht die Seitenleiste unter die Arbeitsfläche.
import { nx, aiModel } from "./api.js";
import { h, icon } from "./ui.js";

const LABELS = {
  auto: "Automatisch", "local:auto": "Mein PC (lokale KI)",
  "gemini:gemini-flash-lite-latest": "Gemini Flash Lite", "gemini:gemini-flash-latest": "Gemini Flash", "gemini:gemini-2.5-pro": "Gemini Pro",
  "groq:llama-3.3-70b-versatile": "Llama 3.3 70B (Groq)", "groq:openai/gpt-oss-120b": "GPT-OSS 120B (Groq)", "openai:gpt-4.1-mini": "GPT-4.1 mini",
  "nvidia:meta/llama-3.3-70b-instruct": "Llama 3.3 70B (NVIDIA)", "nvidia:nvidia/llama-3.3-nemotron-super-49b-v1.5": "Nemotron Super 49B (NVIDIA)",
  "nvidia:openai/gpt-oss-120b": "GPT-OSS 120B (NVIDIA)", "nvidia:qwen/qwen3-next-80b-a3b-instruct": "Qwen3 Next 80B (NVIDIA)",
};
export const modelLabel = (id = aiModel()) => LABELS[id] || String(id).split(":").pop() || "Automatisch";

export function kiLayout(main, ...side) {
  return h("div.ki-layout", h("div.ki-main", main), h("aside.ki-side", { "aria-label": "KI-Infos" }, ...side.filter(Boolean)));
}

export function sideCard(title, ic, ...body) {
  return h("section.card.ki-card", h("div.card-head", h("h3", ic ? icon(ic) : null, title)), h("div.card-body", ...body));
}

// Aktives Modell + Tagesbudget (eine kleine Abfrage, Fehler werden still ignoriert)
export function modelCard() {
  const id = aiModel();
  const local = id === "local:auto";
  const use = h("div.ki-use", h("span.faint", "Tagesbudget wird geladen …"));
  nx("usage").then((u) => {
    if (u.limit == null) return use.replaceChildren(h("span.faint", `Heute ${u.requests_today} Anfragen · ohne Limit`));
    const pct = Math.min(100, Math.round((u.requests_today / u.limit) * 100));
    use.replaceChildren(h("div.row.between", h("span.faint", "Heute genutzt"), h("b", `${u.requests_today} / ${u.limit}`)),
      h("div.ki-bar", h("i", { style: { width: `${pct}%` }, class: pct >= 90 ? "hot" : "" })));
  }).catch(() => use.replaceChildren());
  return sideCard("Aktive KI", "sparkles",
    h("div.ki-model", h("span.ki-dot", { class: local ? "local" : "" }), h("div", h("b", modelLabel(id)),
      h("small.faint", local ? "läuft auf deinem PC – Daten bleiben bei dir" : id === "auto" ? "schnellstes verfügbares Modell" : "Cloud-KI"))),
    use,
    h("a.btn.sm.ki-full", { href: "#/studio/ki" }, icon("settings"), "Modell & Stil ändern"));
}

// Liste mit Häkchen-Punkten
export function tipsCard(title, items, ic = "info") {
  return sideCard(title, ic, h("ul.ki-tips", items.map((t) => h("li", t))));
}

// Schnellstart-Knöpfe: [[Text, onclick]]
export function quickCard(title, items, ic = "zap") {
  if (!items.length) return null;
  return sideCard(title, ic, h("div.ki-quick", items.map(([t, fn, sub]) => h("button.ki-q", { type: "button", onclick: fn }, h("span", t), sub ? h("small.faint", sub) : null, h("span.ki-arrow", { "aria-hidden": "true" }, "→")))));
}
