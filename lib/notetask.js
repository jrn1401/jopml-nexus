// Mitteilung → zugehörige Aufgabe finden und direkt bearbeiten (erledigt / in Bearbeitung / löschen).
// Neue Erinnerungen tragen den Verweis im Link (#/tasks?t=<id> bzw. #/events/<id>?i=<item>);
// ältere werden über den Titel „Fällig: …“ zugeordnet.
import { sb, q, rpc } from "./api.js";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const isTaskNote = (n) => /[?&](t|i)=/.test(n?.link || "") || /^Fällig: /.test(n?.title || "") || ["task", "task_due"].includes(n?.kind);

export async function resolveTask(n, admin) {
  const link = n.link || "";
  const t = link.match(new RegExp(`^#/tasks\\?t=(${UUID})`, "i"));
  const ev = link.match(new RegExp(`^#/events/(${UUID})\\?i=(${UUID})`, "i"));
  const name = (n.title || "").replace(/^Fällig: /, "").trim();
  if (admin) {
    if (t) { const r = await q(sb.from("cc_tasks").select("id,title,note,due,done,status").eq("id", t[1]).maybeSingle()); if (r) return { src: "task", ...r, route: `#/tasks?t=${r.id}` }; }
    if (ev) { const r = await q(sb.from("cc_event_items").select("id,title,note,at,done,status,event_id").eq("id", ev[2]).maybeSingle()); if (r) return { src: "event", ...r, due: r.at, status: r.status === "doing" ? "doing" : null, route: `#/events/${r.event_id}` }; }
    if (!name || t || ev) return null;
    const a = await q(sb.from("cc_tasks").select("id,title,note,due,done,status").eq("title", name).order("done").limit(1)).catch(() => []);
    if (a[0]) return { src: "task", ...a[0], route: `#/tasks?t=${a[0].id}` };
    const b = await q(sb.from("cc_event_items").select("id,title,note,at,done,status,event_id").eq("title", name).in("kind", ["task", "tech", "post"]).order("done").limit(1)).catch(() => []);
    return b[0] ? { src: "event", ...b[0], due: b[0].at, status: b[0].status === "doing" ? "doing" : null, route: `#/events/${b[0].event_id}` } : null;
  }
  if (t) { const r = await q(sb.from("nx_tasks").select("id,title,note,due,done,status").eq("id", t[1]).maybeSingle()); if (r) return { src: "nx", ...r, route: `#/aufgaben?t=${r.id}` }; }
  if (!name || t) return null;
  const a = await q(sb.from("nx_tasks").select("id,title,note,due,done,status").eq("title", name).order("done").limit(1)).catch(() => []);
  return a[0] ? { src: "nx", ...a[0], route: `#/aufgaben?t=${a[0].id}` } : null;
}

export async function setTaskDone(task, done) {
  if (task.src === "nx") await q(sb.from("nx_tasks").update({ done, done_at: done ? new Date().toISOString() : null, status: done ? null : task.status }).eq("id", task.id));
  else if (task.src === "event") await q(sb.from("cc_event_items").update({ done, ...(done && task.status === "doing" ? { status: null } : {}) }).eq("id", task.id));
  else await rpc("cc_task_set", { p_src: task.src, p_id: task.id, p_done: done });
  task.done = done; if (done) task.status = null;
}

export async function setTaskDoing(task, doing) {
  const status = doing ? "doing" : null;
  if (task.src === "nx") await q(sb.from("nx_tasks").update({ status, ...(doing ? { done: false, done_at: null } : {}) }).eq("id", task.id));
  else if (task.src === "task") await q(sb.from("cc_tasks").update({ status, ...(doing ? { done: false, done_at: null } : {}) }).eq("id", task.id));
  else await q(sb.from("cc_event_items").update({ status, ...(doing ? { done: false } : {}) }).eq("id", task.id));
  task.status = status; if (doing) task.done = false;
}

export async function deleteTask(task) {
  const tbl = task.src === "nx" ? "nx_tasks" : task.src === "task" ? "cc_tasks" : "cc_event_items";
  await q(sb.from(tbl).delete().eq("id", task.id));
}

export const taskState = (t) => t.done ? ["Erledigt", "ok"] : t.status === "doing" ? ["In Bearbeitung", "doing"] : t.due && new Date(t.due) < Date.now() ? ["Überfällig", "bad"] : ["Offen", "open"];
