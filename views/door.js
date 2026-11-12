// #/door/<eventId> – Abendkasse & Einlass: Barverkauf, Wechselgeld, Gästeliste, Live-Auslastung.
// Läuft auch für Helfer über einen Tür-Link (Freigabe mit Recht „Abendkasse“), dann mit token statt Anmeldung.
import { rpc } from "../lib/api.js";
import { h, icon, clear, fmtEUR, fmtNum, fmtAgo, meter, toast, toastErr, formModal, modal } from "../lib/ui.js";

const KIND = { sale: "Verkauf", entry: "Einlass", exit: "Gegangen", float: "Wechselgeld", payout: "Entnahme" };

export function doorPanel({ eventId = null, token = null }) {
  const root = h("div.door", h("div.skel", { style: { height: "200px" } }));
  let st = null, price = null, busy = false, q = "";
  const call = async (action = null) => {
    if (busy && action) return;
    busy = !!action;
    try { st = await rpc("cc_door", { p_event: eventId, p_token: token, p_action: action }); if (price === null) price = Number(st.event?.door_price) || 0; draw(); }
    catch (e) { toastErr(e); } finally { busy = false; }
  };
  const big = (label, value, sub, cls = "") => h("div.card.stat", { class: cls }, h("div.k", label), h("div.v", value), sub ? h("div.d", sub) : null);

  function change() {
    const given = h("input.input", { type: "number", inputmode: "decimal", min: 0, step: "0.5", placeholder: "Gegeben (€)", style: { fontSize: "20px", height: "52px" } });
    const n = h("input.input", { type: "number", inputmode: "numeric", min: 1, value: 1, style: { fontSize: "20px", height: "52px" } });
    const out = h("div", { style: { fontSize: "30px", fontWeight: 700, textAlign: "center", padding: "10px 0" } }, "–");
    const calc = () => { const due = (Number(n.value) || 1) * price, g = Number(given.value); out.textContent = !g ? `Zu zahlen: ${fmtEUR(due)}` : g < due ? `Es fehlen ${fmtEUR(due - g)}` : `Rückgeld: ${fmtEUR(g - due)}`; out.style.color = g && g < due ? "var(--bad)" : ""; };
    given.oninput = n.oninput = calc;
    const quick = h("div.row.wrap", { style: { gap: "6px" } }, [5, 10, 20, 50, 100].map((v) => h("button.btn", { type: "button", onclick: () => { given.value = v; calc(); } }, `${v} €`)));
    const m = modal("Wechselgeld-Rechner", h("div.stack", h("div.two", h("div.field", h("label", "Anzahl Tickets"), n), h("div.field", h("label", "Gegeben"), given)), quick, out), {
      foot: [h("button.btn.primary", { onclick: async () => { const k = Number(n.value) || 1; m.close(); await call({ kind: "sale", qty: k, amount: k * price }); toast(`${k} × verkauft`); } }, icon("check"), "Verkauf buchen")] });
    calc();
  }

  function draw() {
    const e = st.event || {};
    const inside = Math.max(0, st.entries + (e.checked_in || 0) - st.exits);
    const cap = e.capacity || null;
    const left = cap ? cap - (e.presale || 0) - st.sold : null;
    const cashbox = st.float + st.cash - st.payout;
    const guests = (st.guests || []).filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase()));
    const search = h("input.input", { placeholder: "Name suchen …", value: q, "aria-label": "Gast suchen", oninput: (ev) => { q = ev.target.value; clear(listBox, ...guestRows()); } });
    const guestRows = () => (st.guests || []).filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase())).map((g) => h("div.list-item",
      h("div.li-main", h("div.li-title", g.name), g.note ? h("div.li-sub", g.note) : null),
      g.in ? h("button.btn.sm", { onclick: () => call({ kind: "guest", id: g.id, in: false }) }, icon("check"), "Drin") : h("button.btn.sm.primary", { onclick: () => call({ kind: "guest", id: g.id, in: true }) }, "Einlassen")));
    const listBox = h("div.list", guestRows());
    clear(root, 
      h("div.page-head", h("div", h("h1", "Abendkasse"), h("p", [e.name, e.date ? new Date(e.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) : null].filter(Boolean).join(" · "))),
        h("div.actions", h("button.btn", { onclick: () => call() }, icon("refresh"), "Aktualisieren"))),
      cap && inside >= cap ? h("div.banner.bad", icon("alert"), h("div", h("strong", "Voll. "), `Die Höchstzahl von ${cap} Personen ist erreicht – niemanden mehr einlassen.`)) : cap && inside >= cap * 0.9 ? h("div.banner.warn", icon("alert"), h("div", `Fast voll: noch ${cap - inside} Plätze.`)) : null,
      h("div.grid.g-4", { style: { marginBottom: "16px" } },
        h("div.card.stat", h("div.k", "Jetzt drin"), h("div.v", fmtNum(inside), cap ? h("small", ` / ${fmtNum(cap)}`) : null), cap ? meter((inside / cap) * 100, [85, 100]) : null,
          h("div.d", `${fmtNum(st.entries)} hier eingelassen${e.checked_in ? ` + ${e.checked_in} per Eventfrog-Scan` : ""} · ${fmtNum(st.exits)} gegangen`)),
        big("Abendkasse verkauft", fmtNum(st.sold), left !== null ? `noch ${fmtNum(Math.max(0, left))} Tickets frei (Vorverkauf ${fmtNum(e.presale || 0)})` : `Vorverkauf ${fmtNum(e.presale || 0)}`),
        big("Bar eingenommen", fmtEUR(st.cash), price ? `${fmtEUR(price)} pro Ticket` : "Preis unten einstellen"),
        big("Soll in der Kasse", fmtEUR(cashbox), `${fmtEUR(st.float)} Wechselgeld + ${fmtEUR(st.cash)} Verkauf${st.payout ? ` − ${fmtEUR(st.payout)} Entnahme` : ""}`)),
      h("div.grid.g-2", { style: { alignItems: "start" } },
        h("section.card", h("div.card-head", h("h3", "Verkauf & Einlass"), h("button.btn.sm.ghost", { onclick: () => formModal("Preis an der Abendkasse", [{ name: "p", label: "Preis pro Ticket (€)", type: "number", step: "0.5", min: 0, value: price }], async (v) => { price = Number(v.p) || 0; draw(); }) }, icon("edit"), price ? fmtEUR(price) : "Preis")),
          h("div.card-body.stack",
            h("div.door-btns",
              h("button.door-btn.primary", { onclick: () => call({ kind: "sale", qty: 1, amount: price }) }, h("b", "+1 Ticket"), h("span", price ? fmtEUR(price) : "bar")),
              h("button.door-btn", { onclick: () => call({ kind: "sale", qty: 2, amount: 2 * price }) }, h("b", "+2 Tickets"), h("span", price ? fmtEUR(2 * price) : "bar")),
              h("button.door-btn", { onclick: change }, h("b", "Wechselgeld"), h("span", "Rechner")),
              h("button.door-btn", { onclick: () => call({ kind: "entry", qty: 1, note: "Vorverkauf" }) }, h("b", "+1 Einlass"), h("span", "hat schon Ticket")),
              h("button.door-btn", { onclick: () => call({ kind: "exit", qty: 1 }) }, h("b", "−1 gegangen"), h("span", "verlässt die Party")),
              h("button.door-btn", { onclick: () => formModal("Kasse", [{ name: "kind", label: "Was?", type: "select", value: "float", options: [["float", "Wechselgeld in die Kasse gelegt"], ["payout", "Geld aus der Kasse genommen"]] }, { name: "amount", label: "Betrag (€)", type: "number", step: "0.01", min: 0, required: true }, { name: "note", label: "Notiz", max: 200 }],
                async (v) => { await call({ kind: v.kind, qty: 0, amount: Number(v.amount) || 0, note: v.note }); }) }, h("b", "Kasse"), h("span", "Wechselgeld / Entnahme"))),
            h("h4.sub-h", "Letzte Buchungen"),
            st.recent?.length ? h("div.list", st.recent.map((r) => h("div.list-item", h("div.li-main", h("div.li-title", `${KIND[r.kind] || r.kind}${r.qty > 1 ? ` × ${r.qty}` : ""}${Number(r.amount) ? ` · ${fmtEUR(r.amount)}` : ""}`),
              h("div.li-sub", [fmtAgo(r.ts), r.by_whom, r.note].filter(Boolean).join(" · "))),
              Date.now() - new Date(r.ts) < 15 * 60_000 ? h("button.btn.sm.ghost", { onclick: () => call({ kind: "undo", id: r.id }) }, "Rückgängig") : null))) : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Buchungen."))),
        h("section.card", h("div.card-head", h("h3", "Gästeliste"), h("span.sub", `${(st.guests || []).filter((g) => g.in).length} / ${(st.guests || []).length} da`)),
          h("div.card-body.stack", (st.guests || []).length ? [search, guests.length ? listBox : h("div.faint", "Kein Treffer.")] : h("div.faint", { style: { fontSize: "13px" } }, "Keine Gästeliste hinterlegt. Gäste trägst du im Event unter „Gästeliste“ ein.")))));
  }
  call();
  const t = setInterval(() => { if (!root.isConnected) return clearInterval(t); if (document.visibilityState === "visible" && !document.querySelector(".overlay") && document.activeElement?.tagName !== "INPUT") call(); }, 15000);
  return root;
}

export default async function doorView({ args: [id] }) {
  return h("div", h("div.crumb", h("a", { href: "#/events" }, "Events"), icon("chevronR", ""), h("a", { href: `#/events/${id}` }, "Event"), icon("chevronR", ""), h("span", "Abendkasse")), doorPanel({ eventId: id }));
}
