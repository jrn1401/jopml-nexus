// KI-Assistent (für Admin und alle Nutzer, über nx-api/ai):
// • nutzt gelerntes Wissen, recherchiert bei Unbekanntem im Web und lernt die Lösung
// • 👍 „Hat geholfen“ → wird als bestätigte Lösung gelernt · 👎 „Nicht gelöst“ → neue Recherche im Web
// • API-Schlüssel im Chat werden automatisch erkannt, verbunden und aus dem Verlauf entfernt
// • kann auf Wunsch handeln: alle Verbindungen abrufen, Projekt anlegen, sich etwas merken
import { sb, q, nx, local } from "./api.js";
import { h, icon, md, copyText, errMsg, toast, toastErr, confirmDialog, fmtAgo, modal, empty } from "./ui.js";

const KEYISH = /\b(nfp_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sbp_[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,})\b/g;
const scrub = (t) => String(t).replace(KEYISH, (m) => `[Schlüssel …${m.slice(-4)}]`);
const SRC = { web: "aus Web-Recherche", feedback: "von dir bestätigt", user: "von dir gemerkt", ai: "von der KI gelernt" };

export function openAiDrawer({ prefill = "", projectId = null, admin = false, storeKey = "ws:chat", suggestions, onAction } = {}) {
  document.querySelector(".drawer.assistant")?.remove();
  let history = local.get(storeKey, []).map((m) => ({ ...m, text: scrub(m.text) }));
  const log = h("div.chat");
  const info = h("p.faint", { style: { fontSize: "12.5px", margin: "0 0 10px" } },
    "Ich kenne deine Projekte und Verbindungen, lerne aus gelösten Problemen und recherchiere im Web, wenn ich etwas nicht weiß. Du kannst mir auch einfach einen API-Schlüssel schicken – ich verbinde ihn.");
  const inp = h("textarea.input", { rows: 2, placeholder: "Frage, Problem oder API-Schlüssel … (Enter = senden)", maxlength: 3000, style: { minHeight: "58px" } });
  const SUG = suggestions || (admin
    ? ["Was steht diese Woche an?", "Wie läuft der Ticketverkauf?", "Sind alle Websites erreichbar?", "Was sollte ich als Nächstes erledigen?"]
    : ["Fasse meine Projekte zusammen", "Welche meiner Websites haben Probleme?", "Wie verbinde ich GitHub?", "Mein Netlify-Deploy schlägt fehl – was tun?"]);
  const chips = h("div.chips");
  const body = h("div.drawer-body", info, log, chips);

  const save = () => { history = history.slice(-40); local.set(storeKey, history); };
  const prevUser = (i) => { for (let j = i - 1; j >= 0; j--) if (history[j].role === "user") return history[j].text; return ""; };
  function bubble(m, i) {
    const b = h("div.bubble", { class: m.role === "user" ? "me" : "ai" }, m.role === "user" ? m.text : md(m.text));
    if (m.error) { b.style.color = "var(--bad)"; return b; }
    if (m.role !== "assistant") return b;
    if (m.actions?.length) b.prepend(h("div.ai-actions", m.actions.map((a) => h("span.badge", { class: a.ok ? "b-ok" : "b-bad" },
      a.type === "connect" ? (a.ok ? `${a.label} verbunden${a.items !== undefined ? ` · ${a.items} importiert` : ""}` : `Nicht verbunden: ${a.error}`) : (a.text || a.error || a.type)))));
    if (m.sources?.length) b.append(h("div.ai-sources", h("span.faint", "Quellen: "), m.sources.map((s, k) => h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.title || `Quelle ${k + 1}`))));
    const meta = h("div.bubble-meta",
      m.model ? h("span", m.model) : null,
      m.researched ? h("span.tag", icon("globe"), "Web-Recherche") : null,
      m.learned ? h("span.tag", icon("sparkles"), "gelernt") : null,
      m.memory ? h("span.tag", `${m.memory} Wissen genutzt`) : null,
      h("span.spacer"),
      m.feedback ? h("span.faint", m.feedback === "up" ? "Danke – gemerkt" : "Neu recherchiert") : [
        h("button.icon-btn.sm", { title: "Hat geholfen – merken", "aria-label": "Hat geholfen", onclick: () => feedback(i, true) }, icon("thumbUp")),
        h("button.icon-btn.sm", { title: "Nicht gelöst – im Web recherchieren", "aria-label": "Nicht gelöst, neu recherchieren", onclick: () => feedback(i, false) }, icon("thumbDown"))],
      h("button.icon-btn.sm", { title: "Kopieren", "aria-label": "Antwort kopieren", onclick: () => copyText(m.text) }, icon("copy")));
    b.append(meta);
    return b;
  }
  function redraw() {
    log.replaceChildren(...history.map(bubble));
    chips.replaceChildren(...(history.length ? [] : SUG.map((t) => h("button.chip", { onclick: () => { inp.value = t; send(); } }, t))));
    body.scrollTop = body.scrollHeight;
  }
  async function ask(question, extra = {}) {
    const prior = history.filter((m) => !m.error).slice(-10).map(({ role, text }) => ({ role, text }));
    const wait = h("div.bubble.ai", h("div.row", h("div.spinner", { style: { width: "16px", height: "16px" } }), h("span.faint", extra.research ? "recherchiere im Web …" : "denkt nach …")));
    log.append(wait); body.scrollTop = body.scrollHeight;
    try {
      const r = await nx("ai", { question, history: prior, project_id: projectId, ...extra });
      if (r.question_redacted) { for (let j = history.length - 1; j >= 0; j--) if (history[j].role === "user") { history[j].text = r.question_redacted; break; } }
      history.push({ role: "assistant", text: r.answer, model: `${r.provider} · ${r.model}${r.own_key ? " · eigener Schlüssel" : ""}`, sources: r.sources, researched: r.researched,
        learned: r.learned, memory: r.memory_used, actions: r.actions?.filter(Boolean) });
      if (r.remaining !== null && r.remaining !== undefined) info.textContent = `Noch ${r.remaining} kostenlose Fragen heute. Mit eigenem KI-Schlüssel (einfach hier einfügen) ohne Limit.`;
      if (r.actions?.some((a) => a?.ok)) onAction?.();
    } catch (e) { history.push({ role: "assistant", text: errMsg(e), error: true }); }
    save(); redraw();
  }
  async function send() {
    const raw = inp.value.trim(); if (!raw || sendBtn.disabled) return;
    inp.value = ""; sendBtn.disabled = true;
    history.push({ role: "user", text: scrub(raw) }); redraw();   // Schlüssel nie im Browser-Verlauf speichern
    await ask(raw);
    sendBtn.disabled = false; inp.focus();
  }
  async function feedback(i, up) {
    const m = history[i]; const question = prevUser(i);
    m.feedback = up ? "up" : "down"; save(); redraw();
    if (up) { try { const r = await nx("ai_feedback", { question, answer: m.text, helpful: true, sources: m.sources }); if (r.learned) toast("Gelernt – hilft beim nächsten Mal sofort"); } catch (e) { toastErr(e); } return; }
    sendBtn.disabled = true;
    await ask(question, { research: true, previous_answer: m.text });
    sendBtn.disabled = false;
  }
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  const sendBtn = h("button.btn.primary", { onclick: send, "aria-label": "Senden", style: { height: "58px" } }, icon("send"));
  const dr = h("aside.drawer.assistant", { role: "dialog", "aria-label": "KI-Assistent" },
    h("div.modal-head", h("h3.row", icon("bot"), "KI-Assistent"), h("div.row",
      h("button.icon-btn", { title: "Gelerntes Wissen", "aria-label": "Gelerntes Wissen", onclick: () => memoryDialog({ admin }) }, icon("sparkles")),
      h("button.icon-btn", { title: "Neues Gespräch", "aria-label": "Verlauf leeren", onclick: () => { history = []; save(); redraw(); } }, icon("refresh")),
      h("button.icon-btn", { onclick: () => dr.remove(), "aria-label": "Schließen" }, icon("x")))),
    body, h("div", { style: { padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--line)", display: "flex", gap: "8px", alignItems: "flex-end" } }, inp, sendBtn));
  document.body.append(dr); redraw(); inp.value = prefill; inp.focus();
  const esc = (e) => { if (e.key === "Escape" && !document.querySelector(".overlay")) { dr.remove(); document.removeEventListener("keydown", esc); } };
  document.addEventListener("keydown", esc);
}

// Gelerntes Wissen ansehen, selbst ergänzen, löschen (Admin: für alle Nutzer freigeben)
export async function memoryDialog({ admin = false } = {}) {
  const list = h("div.list");
  const prob = h("input.input", { placeholder: "Problem / Frage (z. B. „Netlify-Build: npm ERR! code ERESOLVE“)", maxlength: 500 });
  const sol = h("textarea.input", { rows: 3, placeholder: "Lösung", maxlength: 6000 });
  const { data: { session } } = await sb.auth.getSession();
  const uid = session?.user?.id;
  async function draw() {
    const rows = await q(sb.from("nx_ai_memory").select("id,owner_id,problem,solution,source,sources,global,uses,helpful,updated_at").order("updated_at", { ascending: false }).limit(200));
    list.replaceChildren(...(rows.length ? rows.map((m) => h("details.mem",
      h("summary", h("div.li-main", h("div.li-title", m.problem), h("div.li-sub", [SRC[m.source] ?? m.source, m.global ? "für alle" : null, m.uses ? `${m.uses}× genutzt` : null, m.helpful ? `${m.helpful}× hilfreich` : null, fmtAgo(m.updated_at)].filter(Boolean).join(" · ")))),
      h("div.mem-body", md(m.solution),
        m.sources?.length ? h("div.ai-sources", m.sources.map((s, k) => h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.title || `Quelle ${k + 1}`))) : null,
        m.owner_id === uid ? h("div.row", { style: { gap: "6px", marginTop: "8px" } },
          admin ? h("button.btn.sm", { onclick: async () => { try { await q(sb.from("nx_ai_memory").update({ global: !m.global }).eq("id", m.id)); toast(m.global ? "Nur noch für dich" : "Für alle Nutzer freigegeben"); draw(); } catch (e) { toastErr(e); } } }, icon("users"), m.global ? "Nicht mehr teilen" : "Für alle freigeben") : null,
          h("button.btn.sm.danger", { onclick: async () => { if (!(await confirmDialog("Wissen löschen?", "Die KI vergisst diese Lösung.", { ok: "Löschen" }))) return; try { await q(sb.from("nx_ai_memory").delete().eq("id", m.id)); draw(); } catch (e) { toastErr(e); } } }, "Vergessen")) : null)))
      : [empty("sparkles", "Noch nichts gelernt", "Die KI lernt automatisch aus Web-Recherchen und aus Antworten, die du mit 👍 bestätigst. Du kannst auch selbst Wissen eintragen.")]));
  }
  modal("Gelerntes Wissen der KI", h("div.stack",
    h("p.faint", { style: { margin: 0, fontSize: "13px" } }, "Wird bei passenden Fragen automatisch genutzt. Nur du siehst dein Wissen" + (admin ? " – außer du gibst einen Eintrag für alle frei." : ".")),
    h("div.stack", { style: { gap: "6px" } }, prob, sol, h("button.btn", { onclick: async () => {
      if (prob.value.trim().length < 3 || sol.value.trim().length < 3) return toast("Problem und Lösung eingeben", "err");
      if (KEYISH.test(prob.value + sol.value)) { KEYISH.lastIndex = 0; return toast("Bitte keine Schlüssel ins Wissen schreiben", "err"); }
      try { await q(sb.from("nx_ai_memory").insert({ problem: prob.value.trim(), solution: sol.value.trim(), source: "user", helpful: 1 })); prob.value = ""; sol.value = ""; toast("Gemerkt"); draw(); } catch (e) { toastErr(e); }
    } }, icon("plus"), "Wissen hinzufügen")),
    list), { wide: true });
  await draw();
}
