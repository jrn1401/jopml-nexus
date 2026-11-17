// Profi-Website-Generator: ein einziges HTML ohne Skripte (läuft heruntergeladen, bei Netlify & Co. und im Nexus-Link).
// Animationen nur per CSS (Einblenden, Scroll-Effekte, Farbverlauf), respektiert „Bewegung reduzieren“.
// Keine externen Schriften/Tracker/Cookies – passt zur mitgelieferten Datenschutzerklärung.

export const STYLES = {
  nacht: { name: "Nacht (Neon)", bg: "#0b0b12", fg: "#f2f2f7", mut: "#a3a3b8", card: "#15151f", line: "#26263a", a: "#8b5cf6", b: "#ec4899", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "18px" },
  clean: { name: "Clean (hell)", bg: "#ffffff", fg: "#0f172a", mut: "#526075", card: "#f5f7fb", line: "#e3e8f0", a: "#2563eb", b: "#06b6d4", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "14px" },
  warm: { name: "Warm (elegant)", bg: "#faf6f0", fg: "#2b2118", mut: "#6f6152", card: "#fffdf9", line: "#eadfce", a: "#b45309", b: "#d97706", font: "Georgia,'Times New Roman',serif", radius: "10px" },
  bold: { name: "Bold (groß & laut)", bg: "#111111", fg: "#ffffff", mut: "#bdbdbd", card: "#1c1c1c", line: "#333", a: "#facc15", b: "#ef4444", font: "'Arial Black',Impact,system-ui,sans-serif", radius: "4px" },
  glas: { name: "Glas (Verlauf)", bg: "#0f1029", fg: "#ffffff", mut: "#c7c9f0", card: "rgba(255,255,255,.08)", line: "rgba(255,255,255,.16)", a: "#22d3ee", b: "#a855f7", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "22px" },
  natur: { name: "Natur (grün)", bg: "#f3f7f1", fg: "#1d2b1f", mut: "#5b6d5d", card: "#ffffff", line: "#dce7d7", a: "#15803d", b: "#65a30d", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "16px" },
};
export const ANIMS = { aus: "Keine", sanft: "Sanft einblenden", dynamisch: "Dynamisch (Scroll-Effekte)" };
export const HOSTS = {
  netlify: { name: "Netlify", who: "Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, USA", note: "Netlify ist nach dem EU-US Data Privacy Framework zertifiziert." },
  cloudflare: { name: "Cloudflare Pages", who: "Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA", note: "Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert." },
  github: { name: "GitHub Pages", who: "GitHub B.V., Prins Bernhardplein 200, 1097 JB Amsterdam, Niederlande (Mutter: GitHub, Inc., USA)", note: "Daten können in die USA übermittelt werden; GitHub ist nach dem EU-US Data Privacy Framework zertifiziert." },
  nexus: { name: "JOPML Nexus (über Supabase)", who: "die Seite wird über den Dienst JOPML Nexus bereitgestellt (Datenbank: Supabase, Rechenzentrum in der EU)", note: "" },
  de: { name: "Deutscher Hoster (z. B. IONOS, Strato, All-Inkl)", who: "[Name und Anschrift deines Hosters]", note: "" },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const url = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
const rows = (t) => String(t || "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((r) => r[0]);
const paras = (t) => String(t || "").split(/\n{1,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
const stars = (n) => { const k = Math.max(1, Math.min(5, Math.round(Number(n) || 5))); return `<span class="st" aria-label="${k} von 5 Sternen">${"★".repeat(k)}${"☆".repeat(5 - k)}</span>`; };

export const DEFAULTS = {
  name: "", tagline: "", kind: "Event / Party", style: "nacht", anim: "sanft", accent: "",
  cta1: "", cta1url: "", cta2: "", cta2url: "",
  about: "", servicesTitle: "Was dich erwartet", services: "", eventsTitle: "Termine", events: "", gallery: "",
  reviewsTitle: "Das sagen andere", reviews: "", faq: "", email: "", phone: "", whatsapp: "", address: "", social: "",
  legal: { name: "", street: "", city: "", email: "", phone: "", responsible: "", business: false, vat: "", register: "" },
  host: "netlify", sections: { about: true, services: true, events: true, gallery: false, reviews: false, faq: true, contact: true },
};

export function legalMissing(s) {
  const l = s.legal || {};
  return [["name", "Name"], ["street", "Straße"], ["city", "PLZ und Ort"], ["email", "E-Mail"]].filter(([k]) => !String(l[k] || "").trim()).map((x) => x[1]);
}

export function buildPro(s0) {
  const s = { ...DEFAULTS, ...s0, legal: { ...DEFAULTS.legal, ...(s0.legal || {}) }, sections: { ...DEFAULTS.sections, ...(s0.sections || {}) } };
  const t = STYLES[s.style] || STYLES.nacht;
  const a = /^#[0-9a-f]{6}$/i.test(s.accent || "") ? s.accent : t.a;
  const L = s.legal, H = HOSTS[s.host] || HOSTS.netlify;
  const sec = s.sections;
  const year = new Date().getFullYear();
  const nav = [sec.about && s.about && ["about", "Über uns"], sec.services && s.services && ["services", s.servicesTitle], sec.events && s.events && ["events", s.eventsTitle], sec.gallery && s.gallery && ["gallery", "Galerie"], sec.reviews && s.reviews && ["reviews", "Stimmen"], sec.faq && s.faq && ["faq", "FAQ"], sec.contact && ["contact", "Kontakt"]].filter(Boolean);
  const btn = (txt, u, cls) => (txt && url(u) ? `<a class="btn ${cls}" href="${esc(url(u))}" target="_blank" rel="noopener">${esc(txt)}</a>` : txt && /^#/.test(u || "") ? `<a class="btn ${cls}" href="${esc(u)}">${esc(txt)}</a>` : "");
  const card = (r) => `<article class="card rv"><h3>${esc(r[0])}</h3>${r[1] ? `<p>${esc(r[1])}</p>` : ""}${r[2] ? `<div class="price">${esc(r[2])}</div>` : ""}</article>`;
  const ev = (r) => `<li class="ev rv"><div class="d">${esc(r[0])}</div><div><b>${esc(r[1] || "")}</b>${r[2] ? `<div class="m">${esc(r[2])}</div>` : ""}</div>${url(r[3]) ? `<a class="btn sm" href="${esc(url(r[3]))}" target="_blank" rel="noopener">${esc(r[4] || "Tickets")}</a>` : ""}</li>`;
  const imgs = rows(s.gallery).map((r) => url(r[0]) ? `<figure class="rv"><img src="${esc(url(r[0]))}" alt="${esc(r[1] || s.name)}" loading="lazy">${r[1] ? `<figcaption>${esc(r[1])}</figcaption>` : ""}</figure>` : "").join("");
  const rev = rows(s.reviews).map((r) => `<blockquote class="card rv">${stars(r[1])}<p>„${esc(r[2] || "")}“</p><cite>– ${esc(r[0])}</cite></blockquote>`).join("");
  const avg = (() => { const v = rows(s.reviews).map((r) => Number(r[1]) || 0).filter(Boolean); return v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(1).replace(".", ",") : ""; })();
  const faq = rows(s.faq).map((r) => `<details class="rv"><summary>${esc(r[0])}</summary><p>${esc(r[1] || "")}</p></details>`).join("");
  const soc = rows(s.social).map((r) => url(r[1] || r[0]) ? `<a href="${esc(url(r[1] || r[0]))}" target="_blank" rel="noopener">${esc(r[1] ? r[0] : r[0].replace(/^https:\/\/(www\.)?/, "").split("/")[0])}</a>` : "").join("");
  const wa = String(s.whatsapp || "").replace(/[^\d]/g, "");
  const anim = s.anim === "aus" ? "" : `
@keyframes up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes grad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
.hero h1,.hero .tag,.hero .cta{animation:up .9s cubic-bezier(.2,.7,.2,1) both}.hero .tag{animation-delay:.12s}.hero .cta{animation-delay:.24s}
.hero::before{animation:grad 14s ease infinite;background-size:300% 300%}.orb{animation:float 9s ease-in-out infinite}
${s.anim === "dynamisch" ? `@supports (animation-timeline: view()){.rv{animation:up linear both;animation-timeline:view();animation-range:entry 0% cover 28%}}` : `.rv{animation:up .8s .35s both}`}
.card,.btn,figure img{transition:transform .25s,box-shadow .25s}.card:hover{transform:translateY(-4px);box-shadow:0 18px 40px -18px ${a}66}.btn:hover{transform:translateY(-2px)}figure:hover img{transform:scale(1.04)}
@media (prefers-reduced-motion:reduce){*,*::before{animation:none!important;transition:none!important}}`;
  const css = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:${t.bg};color:${t.fg};font-family:${t.font};line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:${a}}img{max-width:100%;display:block}.w{max-width:1080px;margin:0 auto;padding:0 22px}
nav{position:sticky;top:0;z-index:5;backdrop-filter:blur(12px);background:color-mix(in srgb,${t.bg} 78%,transparent);border-bottom:1px solid ${t.line}}
nav .w{display:flex;align-items:center;gap:18px;height:62px;overflow-x:auto}nav b{font-size:17px;white-space:nowrap;margin-right:auto}nav a{color:${t.mut};text-decoration:none;font-size:14.5px;white-space:nowrap}nav a:hover{color:${t.fg}}
.hero{position:relative;overflow:hidden;padding:110px 0 96px;text-align:center}.hero::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,${a}33,transparent 40%,${t.b}2e 70%,${a}22);z-index:-1}
.orb{position:absolute;width:420px;height:420px;border-radius:50%;filter:blur(70px);opacity:.35;z-index:-1}.o1{background:${a};top:-120px;left:-80px}.o2{background:${t.b};bottom:-160px;right:-60px;animation-delay:-4s}
.hero h1{font-size:clamp(38px,7vw,78px);line-height:1.04;margin:0 0 14px;letter-spacing:-.02em}.hero .tag{font-size:clamp(17px,2.4vw,22px);color:${t.mut};max-width:680px;margin:0 auto}
.cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:30px}.btn{display:inline-block;padding:13px 24px;border-radius:999px;background:linear-gradient(135deg,${a},${t.b});color:#fff;font-weight:700;text-decoration:none}.btn.ghost{background:transparent;color:${t.fg};border:1.5px solid ${t.line}}.btn.sm{padding:8px 16px;font-size:14px}
section{padding:72px 0}section h2{font-size:clamp(28px,4vw,42px);margin:0 0 26px;letter-spacing:-.01em}.alt{background:${t.card}}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.card{background:${t.card};border:1px solid ${t.line};border-radius:${t.radius};padding:22px}.alt .card{background:${t.bg}}.card h3{margin:0 0 6px}.card p{margin:0;color:${t.mut}}.price{margin-top:12px;font-weight:700;color:${a}}
.lead{font-size:18px;max-width:760px;color:${t.mut}}
ul.evs{list-style:none;padding:0;margin:0;display:grid;gap:12px}.ev{display:flex;gap:18px;align-items:center;background:${t.card};border:1px solid ${t.line};border-radius:${t.radius};padding:16px 18px}.ev .d{font-weight:800;color:${a};min-width:110px}.ev .m{color:${t.mut};font-size:14px}.ev .btn{margin-left:auto}
.gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}figure{margin:0;overflow:hidden;border-radius:${t.radius}}figure img{width:100%;aspect-ratio:4/3;object-fit:cover}figcaption{font-size:13px;color:${t.mut};padding:6px 2px}
blockquote{margin:0}.st{color:#f5b301;letter-spacing:2px;font-size:18px}cite{display:block;margin-top:10px;color:${t.mut};font-style:normal;font-size:14px}.avg{color:${t.mut};margin:-14px 0 22px}
details{border-bottom:1px solid ${t.line};padding:14px 0}summary{cursor:pointer;font-weight:700;font-size:17px}details p{color:${t.mut};margin:10px 0 0}
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.contact a,.contact div{display:block;background:${t.card};border:1px solid ${t.line};border-radius:${t.radius};padding:18px;text-decoration:none;color:${t.fg}}.contact small{display:block;color:${t.mut}}
.soc{display:flex;gap:14px;flex-wrap:wrap;margin-top:18px}
footer{border-top:1px solid ${t.line};padding:34px 0 46px;color:${t.mut};font-size:14px}footer .w{display:flex;gap:16px;flex-wrap:wrap;align-items:center}footer a{color:${t.mut}}
.legal{display:none;position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.6);padding:4vh 16px;overflow:auto}.legal:target{display:block}.legal .box{max-width:780px;margin:0 auto;background:${t.bg};color:${t.fg};border-radius:${t.radius};padding:28px 26px;border:1px solid ${t.line}}.legal h2{margin-top:0}.legal h3{margin:22px 0 6px;font-size:17px}.legal p{color:${t.mut};margin:6px 0}.x{float:right;text-decoration:none;font-size:26px;line-height:1;color:${t.mut}}
@media(max-width:640px){.ev{flex-wrap:wrap}.ev .btn{margin-left:0}section{padding:54px 0}.hero{padding:80px 0 70px}}${anim}`;
  const impressum = `<div class="legal" id="impressum" role="dialog" aria-label="Impressum"><div class="box"><a class="x" href="#" aria-label="Schließen">×</a><h2>Impressum</h2>
<p><b>Angaben gemäß § 5 DDG</b></p><p>${esc(L.name || "[Vor- und Nachname / Firma]")}<br>${esc(L.street || "[Straße und Hausnummer]")}<br>${esc(L.city || "[PLZ Ort]")}</p>
<h3>Kontakt</h3><p>E-Mail: ${esc(L.email || "[E-Mail]")}${L.phone ? `<br>Telefon: ${esc(L.phone)}` : ""}</p>
${L.register ? `<h3>Registereintrag</h3><p>${esc(L.register)}</p>` : ""}${L.vat ? `<h3>Umsatzsteuer-ID</h3><p>${esc(L.vat)}</p>` : ""}
<h3>Verantwortlich für den Inhalt</h3><p>${esc(L.responsible || L.name || "[Name]")}, Anschrift wie oben</p>
<h3>Haftung für Links</h3><p>Diese Seite enthält Links zu externen Websites. Für deren Inhalte sind ausschließlich die jeweiligen Anbieter verantwortlich.</p></div></div>`;
  const datenschutz = `<div class="legal" id="datenschutz" role="dialog" aria-label="Datenschutzerklärung"><div class="box"><a class="x" href="#" aria-label="Schließen">×</a><h2>Datenschutzerklärung</h2>
<h3>1. Verantwortlicher</h3><p>${esc(L.name || "[Name]")}, ${esc(L.street || "[Straße]")}, ${esc(L.city || "[PLZ Ort]")}, E-Mail: ${esc(L.email || "[E-Mail]")}</p>
<h3>2. Hosting und Server-Logfiles</h3><p>Diese Website wird bereitgestellt von ${esc(H.who)}. Beim Aufruf verarbeitet der Hoster technisch notwendige Daten (z. B. IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser) in Server-Logfiles, um die Seite sicher auszuliefern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb). ${esc(H.note)}</p>
<h3>3. Keine Cookies, kein Tracking</h3><p>Diese Website setzt keine Cookies, nutzt keine Analyse- oder Werbedienste und lädt keine externen Schriftarten.</p>
<h3>4. Kontakt</h3><p>Wenn du uns per E-Mail, Telefon oder WhatsApp kontaktierst, verarbeiten wir deine Angaben zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b bzw. f DSGVO) und löschen sie, wenn sie nicht mehr benötigt werden. Bei WhatsApp gelten zusätzlich die Datenschutzbestimmungen von WhatsApp/Meta.</p>
<h3>5. Externe Links und Bilder</h3><p>Links zu anderen Seiten (z. B. Ticketshop, Social Media) öffnen erst nach deinem Klick die Seite des jeweiligen Anbieters; dort gelten deren Datenschutzbestimmungen.${s.gallery ? " Bilder in der Galerie werden ggf. von externen Servern geladen; dabei wird deine IP-Adresse an den jeweiligen Server übermittelt." : ""}</p>
<h3>6. Deine Rechte</h3><p>Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO).</p>
<p><small>Stand: ${new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</small></p></div></div>`;
  const body = `<nav><div class="w"><b>${esc(s.name || "Deine Seite")}</b>${nav.map(([id, n]) => `<a href="#${id}">${esc(n)}</a>`).join("")}</div></nav>
<header class="hero"><div class="orb o1"></div><div class="orb o2"></div><div class="w"><h1>${esc(s.name || "Dein Name")}</h1>${s.tagline ? `<p class="tag">${esc(s.tagline)}</p>` : ""}<div class="cta">${btn(s.cta1, s.cta1url, "")}${btn(s.cta2, s.cta2url, "ghost")}</div></div></header>
${sec.about && s.about ? `<section id="about"><div class="w"><h2 class="rv">Über uns</h2><div class="lead rv">${paras(s.about)}</div></div></section>` : ""}
${sec.services && s.services ? `<section id="services" class="alt"><div class="w"><h2 class="rv">${esc(s.servicesTitle)}</h2><div class="grid">${rows(s.services).map(card).join("")}</div></div></section>` : ""}
${sec.events && s.events ? `<section id="events"><div class="w"><h2 class="rv">${esc(s.eventsTitle)}</h2><ul class="evs">${rows(s.events).map(ev).join("")}</ul></div></section>` : ""}
${sec.gallery && imgs ? `<section id="gallery" class="alt"><div class="w"><h2 class="rv">Galerie</h2><div class="gal">${imgs}</div></div></section>` : ""}
${sec.reviews && rev ? `<section id="reviews"><div class="w"><h2 class="rv">${esc(s.reviewsTitle)}</h2>${avg ? `<p class="avg">${stars(Number(avg.replace(",", ".")))} ${avg} von 5 · ${rows(s.reviews).length} Bewertungen</p>` : ""}<div class="grid">${rev}</div></div></section>` : ""}
${sec.faq && faq ? `<section id="faq" class="alt"><div class="w"><h2 class="rv">Häufige Fragen</h2>${faq}</div></section>` : ""}
${sec.contact ? `<section id="contact"><div class="w"><h2 class="rv">Kontakt</h2><div class="contact">
${s.email ? `<a class="rv" href="mailto:${esc(s.email)}"><small>E-Mail</small>${esc(s.email)}</a>` : ""}${s.phone ? `<a class="rv" href="tel:${esc(String(s.phone).replace(/\s/g, ""))}"><small>Telefon</small>${esc(s.phone)}</a>` : ""}
${wa ? `<a class="rv" href="https://wa.me/${wa}" target="_blank" rel="noopener"><small>WhatsApp</small>Nachricht schreiben</a>` : ""}${s.address ? `<a class="rv" href="https://www.openstreetmap.org/search?query=${encodeURIComponent(s.address)}" target="_blank" rel="noopener"><small>Adresse</small>${esc(s.address)}</a>` : ""}</div>
${soc ? `<div class="soc">${soc}</div>` : ""}</div></section>` : ""}
<footer><div class="w"><span>© ${year} ${esc(s.name || "")}</span><a href="#impressum">Impressum</a><a href="#datenschutz">Datenschutz</a></div></footer>${impressum}${datenschutz}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.name || "Website")}</title>
<meta name="description" content="${esc((s.tagline || s.about || "").slice(0, 160))}"><style>${css}</style></head><body>${body}</body></html>`;
}
