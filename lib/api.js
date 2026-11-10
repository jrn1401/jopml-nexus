// Datenzugriff: Supabase-Client (nur öffentlicher Schlüssel), RPC-Helfer, Edge-API, Uploads mit Fortschritt.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";
import { CONFIG } from "../config.js";

export const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "cc-auth" },
});

export async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function q(promise) {
  const { data, error, count } = await promise;
  if (error) throw new Error(error.message);
  return count !== undefined && count !== null ? { data, count } : data;
}

// Aufruf der Edge Function cc-api mit dem Admin-JWT
export async function api(route, body = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Nicht angemeldet.");
  const r = await fetch(`${CONFIG.supabaseUrl}/functions/v1/cc-api/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: CONFIG.supabaseKey },
    body: JSON.stringify(body),
  });
  let d = null; try { d = await r.json(); } catch { /* */ }
  if (!r.ok) throw new Error(d?.error || `API-Fehler (HTTP ${r.status})`);
  return d;
}

// Kleiner Cache für Listen, die viele Seiten brauchen (Projekte)
let projCache = null, projAt = 0;
export async function projects(force = false) {
  if (!force && projCache && Date.now() - projAt < 30_000) return projCache;
  projCache = await q(sb.from("cc_projects").select("id,slug,name,category,status,pinned,tags,updated_at").order("name"));
  projAt = Date.now();
  return projCache;
}
export const invalidateProjects = () => { projCache = null; };

export async function sha256(file) {
  const buf = await file.arrayBuffer();
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const MAX_UPLOAD = 50 * 1024 * 1024;
export function categoryFor(name, mime) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["js","ts","tsx","jsx","py","lua","luau","cs","cpp","c","h","go","rs","java","kt","php","rb","sh","ps1","sql","html","css","swift"].includes(ext)) return "code";
  if (["md","txt","pdf","doc","docx","odt","rtf"].includes(ext)) return "doku";
  if (["json","yml","yaml","toml","ini","cfg","conf","xml"].includes(ext)) return "konfiguration";
  if (["csv","xlsx","xls","db","sqlite","parquet"].includes(ext)) return "daten";
  if (/^image\//.test(mime) || ["png","jpg","jpeg","gif","svg","webp","psd","fig","ai"].includes(ext)) return "design";
  if (/^(audio|video)\//.test(mime)) return "medien";
  if (["zip","rar","7z","gz","tar","rbxl","rbxm","exe","msi"].includes(ext)) return "paket";
  return "sonstiges";
}
const SECRET_RE = /(^|\/)(\.env(?!\.(?:example|sample|template|dist)$)(\..*)?|\.npmrc|\.pypirc|\.netrc|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|credentials(\.json)?|secrets?\.(json|ya?ml|toml)|service[-_]?account.*\.json|.*\.(pem|key|p12|pfx|keystore|jks|ovpn|kdbx))$/i;
export const isSecretFile = (name) => SECRET_RE.test(name);

// Datei hochladen: Inhalt adressiert (blobs/<sha256>) → identische Dateien werden nie doppelt gespeichert.
export async function uploadFile(file, { projectId, moduleId = null, relPath, onProgress }) {
  if (file.size > MAX_UPLOAD) throw new Error(`${file.name}: größer als 50 MB`);
  if (isSecretFile(relPath || file.name)) throw new Error(`${file.name}: sieht nach Zugangsdaten aus und wird nicht hochgeladen`);
  onProgress?.(0, "Prüfsumme …");
  const hash = await sha256(file);
  const path = `blobs/${hash}`;
  const { count } = await sb.from("cc_files").select("id", { count: "exact", head: true }).eq("file_hash", hash);
  if (!count) {
    const { data: { session } } = await sb.auth.getSession();
    await new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open("POST", `${CONFIG.supabaseUrl}/storage/v1/object/cc-files/${path}`);
      x.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      x.setRequestHeader("apikey", CONFIG.supabaseKey);
      x.setRequestHeader("x-upsert", "false");
      x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total, "Lädt hoch …");
      x.onload = () => {
        // 409/400 "already exists": Inhalt liegt schon im Speicher → in Ordnung
        if (x.status < 300 || /exist|Duplicate/i.test(x.responseText)) res();
        else { let m = x.responseText; try { m = JSON.parse(m).message || m; } catch { /* */ } rej(new Error(`${file.name}: ${m}`)); }
      };
      x.onerror = () => rej(new Error(`${file.name}: Netzwerkfehler beim Upload`));
      x.send(file);
    });
  }
  onProgress?.(1, count ? "Bereits vorhanden – dedupliziert" : "Gespeichert");
  return rpc("cc_file_put", {
    p_project: projectId, p_module: moduleId, p_path: relPath || file.name, p_hash: hash, p_size: file.size,
    p_mime: file.type || "", p_category: categoryFor(file.name, file.type), p_source: "ui",
  });
}

export async function downloadFile(f) {
  const { data, error } = await sb.storage.from("cc-files").createSignedUrl(f.storage_path, 120, { download: f.file_name });
  if (error) throw new Error(error.message);
  const a = document.createElement("a"); a.href = data.signedUrl; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
}

export async function removeFile(projectId, relPath) {
  const orphans = await rpc("cc_file_remove", { p_project: projectId, p_path: relPath });
  if (orphans?.length) await sb.storage.from("cc-files").remove(orphans);
}

export async function logActivity(kind, description, project_id = null, status = "ok") {
  await sb.from("cc_activities").insert({ kind, description: description.slice(0, 500), project_id, status });
}

// Einstellungen (Server) + lokale Vorlieben
export async function getSetting(key, fallback) {
  const { data } = await sb.from("cc_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? fallback;
}
export async function setSetting(key, value) {
  await q(sb.from("cc_settings").upsert({ key, value, updated_at: new Date().toISOString() }));
}
export const local = {
  get(k, d) { try { const v = localStorage.getItem("cc:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("cc:" + k, JSON.stringify(v)); } catch { /* privat */ } },
};
