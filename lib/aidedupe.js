// KI-Aufräumen: findet doppelte, überholte oder widersprüchliche Einträge (Aufgaben, Ablauf, Kosten, Locations …)
// und schlägt Zusammenführungen vor. Nichts passiert ohne Bestätigung; behalten wird jeweils der aussagekräftigste Eintrag,
// fehlende Angaben (Datum, Betrag, Notiz) werden aus den entfernten übernommen.
import { sb, q, nx } from "./api.js";
import { h, icon, modal, toast, toastErr, errMsg, fmtEUR } from "./ui.js";

const KIND = { task: "Aufgabe", tech: "Technik", schedule: "Ablauf", cost: "Kosten", income: "Einnahme", guest: "Gast", location: "Location", shift: "Schicht", post: "Post" };

// Schnelle Vorprüfung ohne KI (gleicher Titel, Titel enthält den anderen, gleicher Zeitpunkt im Ablauf)
function quickGroups(items) {
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9äöüß ]/g, " ").replace(/\s+/g, " ").trim();
  const used = new Set(), groups = [];
  for (const a of items) {
    if (used.has(a.id)) continue;
    const same = items.filter((b) => b.id !== a.id && !used.has(b.id) && b.kind === a.kind && (norm(b.title) === norm(a.title)
      || (norm(a.title).length >= 4 && norm(b.title).startsWith(norm(a.title))) || (a.kind === "schedule" && a.at && a.at === b.at)));
    if (same.length) {
      const all = [a, ...same].sort((x, y) => y.title.length - x.title.length);
      all.forEach((x) => used.add(x.id));
      groups.push({ keep: all[0].id, remove: all.slice(1).map((x) => x.id), why: "gleicher oder enthaltener Titel / gleicher Zeitpunkt" });
    }
  }
  return groups;
}

export async function aiCleanup({ items, table, context = "", onDone }) {
  const live = items.filter((i) => i.kind !== "guest");
  const box = h("div.faint", "Die KI prüft die Einträge …");
  const m = modal("Aufräumen mit KI", box, { wide: true });
  let groups = quickGroups(live);
  try {
    const idx = live.map((it, i) => `${i}|${KIND[it.kind] || it.kind}|${it.title}${it.at ? `|${it.at.slice(0, 16)}` : ""}${it.amount ? `|${it.amount}€` : ""}${it.status ? `|${it.status}` : ""}`).join("\n").slice(0, 14000);
    const r = await nx("ai", { history: [], question: `${context ? `Kontext: ${context}\n` : ""}Hier sind Einträge einer Planung (Nummer|Art|Titel|Zeit|Betrag|Status):
${idx}
Finde Einträge, die dasselbe meinen (doppelt, nur anders formuliert), sowie Kosten/Einnahmen, die sich überschneiden und dadurch doppelt gezählt würden (z. B. netto + MwSt + brutto). Gruppiere NUR echte Doppelungen derselben Art; behalte jeweils den aussagekräftigsten Eintrag.
Antworte NUR mit JSON: {"groups":[{"keep":3,"remove":[7,9],"title":"optional besserer Titel","why":"kurz"}]}` });
    const mm = String(r.answer || "").match(/\{[\s\S]*\}/);
    const ai = (mm ? JSON.parse(mm[0]).groups || [] : []).map((g) => ({ keep: live[g.keep]?.id, remove: (g.remove || []).map((i) => live[i]?.id).filter(Boolean), title: g.title, why: g.why }))
      .filter((g) => g.keep && g.remove.length && !g.remove.includes(g.keep));
    // KI-Gruppen ergänzen die Schnellprüfung (keine doppelte Zuordnung)
    const taken = new Set(groups.flatMap((g) => [g.keep, ...g.remove]));
    for (const g of ai) if (![g.keep, ...g.remove].some((x) => taken.has(x))) { groups.push(g); [g.keep, ...g.remove].forEach((x) => taken.add(x)); }
  } catch (e) { if (!groups.length) { box.replaceChildren(h("div.banner.bad", errMsg(e))); return; } }
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  groups = groups.filter((g) => byId[g.keep] && g.remove.every((x) => byId[x]) && g.remove.every((x) => byId[x].kind === byId[g.keep].kind));
  if (!groups.length) { box.className = ""; box.replaceChildren(h("div.na-note", icon("check"), h("div", "Keine Doppelungen gefunden – alles sauber."))); return; }
  const pick = new Set(groups.map((_, i) => i));
  const line = (it, keep) => h("div.row", { style: { gap: "6px", fontSize: "13.5px", textDecoration: keep ? "none" : "line-through", color: keep ? "inherit" : "var(--text-3)" } },
    h("span.badge.b-idle", KIND[it.kind] || it.kind), h("span", it.title), it.amount ? h("span.faint", fmtEUR(it.amount)) : null);
  box.className = "";
  box.replaceChildren(
    h("p.faint", { style: { marginTop: 0 } }, `${groups.length} Vorschläge. Durchgestrichenes wird entfernt, fehlende Angaben gehen auf den behaltenen Eintrag über.`),
    h("div.list", groups.map((g, i) => h("label.list-item", { style: { alignItems: "flex-start" } },
      h("input", { type: "checkbox", checked: true, "aria-label": "Vorschlag übernehmen", onchange: (e) => (e.target.checked ? pick.add(i) : pick.delete(i)) }),
      h("div.li-main.stack", { style: { gap: "4px" } }, line({ ...byId[g.keep], title: g.title || byId[g.keep].title }, true), ...g.remove.map((x) => line(byId[x], false)),
        g.why ? h("div.li-sub", g.why) : null)))),
    h("div.row", { style: { justifyContent: "flex-end", gap: "8px", marginTop: "12px" } },
      h("button.btn.ghost", { onclick: () => m.close() }, "Abbrechen"),
      h("button.btn.primary", { onclick: async (e) => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
          let n = 0;
          for (const i of pick) {
            const g = groups[i], keep = byId[g.keep], rm = g.remove.map((x) => byId[x]);
            const patch = {};
            if (g.title && g.title.length <= 200) patch.title = g.title;
            for (const f of ["at", "amount", "assignee", "url"]) if ((keep[f] === null || keep[f] === undefined || keep[f] === "") && rm.some((r) => r[f])) patch[f] = rm.find((r) => r[f])[f];
            if (!keep.note && rm.some((r) => r.note)) patch.note = rm.find((r) => r.note).note.slice(0, 2000);
            if (Object.keys(patch).length) await q(sb.from(table).update(patch).eq("id", keep.id));
            await q(sb.from(table).delete().in("id", g.remove));
            n += g.remove.length;
          }
          toast(`${n} doppelte Einträge zusammengeführt`); m.close(); onDone?.();
        } catch (er) { toastErr(er); btn.disabled = false; }
      } }, icon("check"), "Ausgewählte zusammenführen")));
}
