// KI-Erzeugung für Werkzeuge: nutzt die neue Route „gen“ (Modellwahl, Ton, Gedächtnis);
// solange sie noch nicht freigeschaltet ist, automatisch über den normalen KI-Chat.
import { nx } from "./api.js";

let genMissing = false;
export function parseJson(t) {
  if (!t) return null;
  try { return JSON.parse(t); } catch { /* weiter */ }
  const m = String(t).match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* weiter */ } }
  return null;
}

// { task, instructions, input, json, withContext } → { text, json, model }
export async function aiGen({ task = "", instructions, input, json = false, withContext = false, projectId } = {}) {
  if (!genMissing) {
    try {
      const r = await nx("gen", { task, instructions, input, json, with_context: withContext, project_id: projectId });
      return { text: r.text, json: r.json ?? (json ? parseJson(r.text) : null), model: r.model, remaining: r.remaining };
    } catch (e) {
      if (!/Unbekannter Endpunkt/.test(String(e?.message))) throw e;
      genMissing = true;
    }
  }
  const q = `${instructions}\n\n${json ? "Antworte im Feld answer NUR mit dem geforderten JSON (kein Markdown drumherum).\n\n" : ""}EINGABE:\n${input}`.slice(0, 2900);
  const r = await nx("ai", { history: [], question: q });
  const text = String(r.answer || "");
  return { text, json: json ? parseJson(text) : null, model: r.model, remaining: r.remaining };
}
