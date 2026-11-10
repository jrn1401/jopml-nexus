// Verbinden-Assistent: Schlüssel (oder ganzen Text) einfügen → Dienst wird erkannt, geprüft, verschlüsselt gespeichert und importiert.
import { sb, q, nx } from "./api.js";
import { h, icon, modal, toast, toastErr, fmtAgo, confirmDialog, empty } from "./ui.js";

export const PROVIDERS = [
  ["netlify", "Netlify", "Websites & Deploys", "https://app.netlify.com/user/applications#personal-access-tokens", "nfp_…"],
  ["github", "GitHub", "Repositories", "https://github.com/settings/personal-access-tokens/new", "ghp_… / github_pat_…"],
  ["vercel", "Vercel", "Websites & Deploys", "https://vercel.com/account/settings/tokens", "Token"],
  ["supabase", "Supabase", "Datenbanken", "https://supabase.com/dashboard/account/tokens", "sbp_…"],
  ["eventfrog", "Eventfrog", "Events & Tickets", "https://eventfrog.de/de/help/organizer/settings/api/api-keys.html", "Organizer-Key (Lesen)"],
  ["groq", "Groq", "Eigene KI (ohne Limit)", "https://console.groq.com/keys", "gsk_…"],
  ["gemini", "Google Gemini", "Eigene KI (ohne Limit)", "https://aistudio.google.com/apikey", "AIza…"],
  ["openai", "OpenAI", "Eigene KI (ohne Limit)", "https://platform.openai.com/api-keys", "sk-…"],
  ["anthropic", "Anthropic Claude", "Modelle / Verbrauch", "https://console.anthropic.com/settings/keys", "sk-ant-…"],
];
const PL = Object.fromEntries(PROVIDERS.map((p) => [p[0], p]));

export function connectDialog(onDone) {
  const ta = h("textarea.input", { rows: 3, placeholder: "API-Schlüssel hier einfügen – oder einfach einen Text, in dem der Schlüssel steht.", autocomplete: "off", spellcheck: false, style: { fontFamily: "var(--mono, monospace)" } });
  const manual = h("select.input", { style: { width: "auto" } }, h("option", { value: "" }, "Automatisch erkennen"), PROVIDERS.map(([k, n]) => h("option", { value: k }, n)));
  const out = h("div.stack");
  const detectBtn = h("button.btn", { onclick: detect }, icon("search"), "Erkennen & prüfen");
  const goBtn = h("button.btn.primary", { onclick: go }, icon("link"), "Verbinden & importieren");
  async function detect() {
    if (!ta.value.trim()) return toast("Bitte Schlüssel einfügen", "err");
    detectBtn.disabled = true; out.replaceChildren(h("div.spinner"));
    try {
      const r = await nx("detect", { text: ta.value });
      out.replaceChildren(...(r.found?.length ? r.found.map((f) => h("div.list-item",
        h("span.dot", { class: f.valid ? "ok" : "bad" }), h("div.li-main", h("div.li-title", `${f.label} ${f.hint}`), h("div.li-sub", f.valid ? `gültig · ${f.account}` : f.error)))) : [h("div.na-note", icon("info"), h("div", r.hint))]));
    } catch (e) { out.replaceChildren(h("div.login-err", e.message)); } finally { detectBtn.disabled = false; }
  }
  async function go() {
    if (!ta.value.trim()) return toast("Bitte Schlüssel einfügen", "err");
    goBtn.disabled = true; out.replaceChildren(h("div.row", h("div.spinner"), h("span.faint", "Prüfe und importiere …")));
    try {
      const r = await nx("connect", { text: ta.value, provider: manual.value || undefined });
      ta.value = "";
      out.replaceChildren(...r.results.map((x) => h("div.list-item", h("span.dot", { class: x.ok && !x.error ? "ok" : "bad" }),
        h("div.li-main", h("div.li-title", x.ok ? `${x.label} verbunden${x.duplicate ? " (war schon verbunden – aktualisiert)" : ""}` : `Nicht verbunden ${x.hint ?? ""}`),
          h("div.li-sub", x.ok ? [x.account, x.items !== undefined ? `${x.items} Einträge importiert` : null, x.error ? `Import: ${x.error}` : null].filter(Boolean).join(" · ") : x.error)))));
      if (r.results.some((x) => x.ok)) { toast("Verbunden"); onDone?.(); }
    } catch (e) { out.replaceChildren(h("div.login-err", e.message)); } finally { goBtn.disabled = false; }
  }
  modal("Dienst verbinden", h("div.stack",
    h("div.faint", { style: { fontSize: "13px" } }, "Füge einen API-Schlüssel ein. Der Dienst wird automatisch erkannt und geprüft, danach erscheinen alle Websites, Repositories, Events oder KI-Zugänge in deiner Übersicht – und werden stündlich aktualisiert."),
    ta, h("div.row.wrap", { style: { gap: "8px" } }, manual, detectBtn, goBtn), out,
    h("div.na-note", icon("lock"), h("div", "Schlüssel werden verschlüsselt auf dem Server gespeichert (Supabase Vault), nie im Browser angezeigt und nur zum Lesen deiner Daten verwendet. Du kannst jede Verbindung jederzeit trennen – dann wird der Schlüssel gelöscht.")),
    h("div", h("div.k.faint", { style: { fontSize: "12px", margin: "6px 0" } }, "Wo bekomme ich einen Schlüssel?"),
      h("div.prov-grid", PROVIDERS.map(([, n, what, url, fmt]) => h("a.prov", { href: url, target: "_blank", rel: "noopener noreferrer" }, h("strong", n), h("span", what), h("small", fmt)))))), { wide: true });
}

// Liste der eigenen Verbindungen (RLS: nur eigene Zeilen; Schlüssel selbst sind nie lesbar)
export async function connectionsList(onChange) {
  const rows = await q(sb.from("cc_connections").select("id,provider,label,account,hint,status,last_sync,last_error,meta,created_at").order("created_at"));
  if (!rows.length) return empty("link", "Noch nichts verbunden", "Füge einen API-Schlüssel ein – der Rest passiert automatisch.", h("button.btn.primary", { onclick: () => connectDialog(onChange) }, icon("plus"), "Verbinden"));
  return h("div.list", rows.map((c) => h("div.list-item",
    h("span.dot", { class: c.status === "connected" ? "ok" : c.status === "error" ? "bad" : "idle" }),
    h("div.li-main", h("div.li-title", `${PL[c.provider]?.[1] ?? c.provider} · ${c.account || c.label}`),
      h("div.li-sub", [PL[c.provider]?.[2], `Schlüssel ${c.hint}`, c.meta?.items !== undefined ? `${c.meta.items} Einträge` : null, c.last_sync ? `abgerufen ${fmtAgo(c.last_sync)}` : "noch nicht abgerufen", c.last_error].filter(Boolean).join(" · "))),
    h("button.btn.sm", { onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await nx("sync", { connection_id: c.id }); const x = r.results[0]; x?.error ? toast(x.error, "err") : toast(`${x?.items ?? 0} Einträge aktualisiert`); onChange?.(); } catch (er) { toastErr(er); } } }, icon("refresh"), "Abrufen"),
    h("button.icon-btn", { title: "Trennen", "aria-label": "Verbindung trennen", onclick: async () => {
      if (!(await confirmDialog("Verbindung trennen?", "Der gespeicherte Schlüssel wird gelöscht. Importierte Projekte bleiben erhalten, werden aber nicht mehr aktualisiert.", { ok: "Trennen" }))) return;
      try { await q(sb.from("cc_connections").delete().eq("id", c.id)); toast("Getrennt – Schlüssel gelöscht"); onChange?.(); } catch (e) { toastErr(e); }
    } }, icon("x")))));
}
