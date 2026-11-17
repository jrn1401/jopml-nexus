// Profi-Website-Generator: ein einziges HTML ohne Skripte (läuft heruntergeladen, bei Netlify & Co. und im Nexus-Link).
// Animationen nur per CSS (Einblenden, Scroll-Effekte, Farbverlauf), respektiert „Bewegung reduzieren“.
// Keine externen Schriften/Tracker/Cookies – passt zur mitgelieferten Datenschutzerklärung.

export const STYLES = {
  nacht: { name: "Nacht (Neon)", bg: "#0b0b12", fg: "#f2f2f7", mut: "#a3a3b8", card: "#15151f", line: "#26263a", a: "#8b5cf6", b: "#ec4899", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "18px" },
  clean: { name: "Clean (hell)", bg: "#ffffff", fg: "#0f172a", mut: "#526075", card: "#f5f7fb", line: "#e3e8f0", a: "#2563eb", b: "#06b6d4", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "14px" },
  warm: { name: "Warm (elegant)", bg: "#faf6f0", fg: "#2b2118", mut: "#6f6152", card: "#fffdf9", line: "#eadfce", a: "#b45309", b: "#d97706", font: "Georgia,'Times New Roman',serif", radius: "10px" },
  bold: { name: "Bold (groß & laut)", bg: "#111111", fg: "#ffffff", mut: "#bdbdbd", card: "#1c1c1c", line: "#333", a: "#facc15", b: "#ef4444", font: "'Arial Black',Impact,system-ui,sans-serif", radius: "4px" },
  glas: { name: "Glas (Verlauf)", bg: "#0f1029", fg: "#ffffff", mut: "#c7c9f0", card: "rgba(255,255,255,.08)", line: "rgba(255,255,255,.16)", a: "#22d3ee", b: "#a855f7", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "22px" },
  pastell: { name: "Pastell (soft)", bg: "#fdf7fb", fg: "#2d2433", mut: "#76687f", card: "#ffffff", line: "#f0e2ee", a: "#d946ef", b: "#60a5fa", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "24px" },
  retro: { name: "Retro (80er)", bg: "#1a0b2e", fg: "#fff4e6", mut: "#d8b4fe", card: "#2a1446", line: "#4c1d95", a: "#f97316", b: "#facc15", font: "'Trebuchet MS','Verdana',sans-serif", radius: "6px" },
  mono: { name: "Minimal (schwarz-weiß)", bg: "#ffffff", fg: "#0a0a0a", mut: "#555555", card: "#f4f4f4", line: "#e2e2e2", a: "#0a0a0a", b: "#404040", font: "'Helvetica Neue',Arial,sans-serif", radius: "0px" },
  ozean: { name: "Ozean (blau)", bg: "#04141f", fg: "#e6f6ff", mut: "#8fb7cc", card: "#0b2233", line: "#14394f", a: "#0ea5e9", b: "#14b8a6", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "16px" },
  natur: { name: "Natur (grün)", bg: "#f3f7f1", fg: "#1d2b1f", mut: "#5b6d5d", card: "#ffffff", line: "#dce7d7", a: "#15803d", b: "#65a30d", font: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", radius: "16px" },
};
export const FONTS = { auto: ["Passend zum Design", ""], modern: ["Modern", "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"], serif: ["Elegant (Serif)", "Georgia,'Times New Roman',serif"],
  rund: ["Rund & freundlich", "'Trebuchet MS','Segoe UI',sans-serif"], mono: ["Technisch (Mono)", "ui-monospace,'SF Mono',Menlo,Consolas,monospace"], kraeftig: ["Kräftig", "'Arial Black',Impact,system-ui,sans-serif"] };
export const LAYOUTS = { center: "Mittig", left: "Linksbündig", split: "Text + Bild" };
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

// Musik & Social: Spotify, YouTube, SoundCloud, Instagram, TikTok … als Karten; Einbetten (Player) nur in der heruntergeladenen Seite.
const MEDIA = [
  [/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/, "Spotify", "#1DB954", (m) => `https://open.spotify.com/embed/${m[1]}/${m[2]}`, 152],
  [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/, "YouTube", "#FF0033", (m) => `https://www.youtube-nocookie.com/embed/${m[1]}`, 0],
  [/soundcloud\.com\/[\w-]+(?:\/[\w-]+)?/, "SoundCloud", "#FF5500", (m, u) => `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&visual=false`, 166],
  [/instagram\.com/, "Instagram", "#E1306C", null], [/tiktok\.com/, "TikTok", "#25F4EE", null], [/music\.apple\.com/, "Apple Music", "#FA2D48", null],
  [/(chat\.)?whatsapp\.com|wa\.me/, "WhatsApp", "#25D366", null], [/eventfrog|eventbrite|ticket/, "Tickets", "#8b5cf6", null], [/mixcloud\.com/, "Mixcloud", "#5000FF", null], [/discord\.(gg|com)/, "Discord", "#5865F2", null],
];
export function mediaInfo(u) { for (const [re, name, color, emb, hgt] of MEDIA) { const m = re.exec(u); if (m) return { name, color, embed: emb ? emb(m, u) : null, height: hgt }; } return { name: (u.replace(/^https:\/\/(www\.)?/, "").split("/")[0]), color: "#888", embed: null }; }

export const DEFAULTS = {
  name: "", tagline: "", kind: "Event / Party", style: "nacht", anim: "sanft", accent: "",
  cta1: "", cta1url: "", cta2: "", cta2url: "",
  about: "", servicesTitle: "Was dich erwartet", services: "", eventsTitle: "Termine", events: "", gallery: "",
  reviewsTitle: "Das sagen andere", reviews: "", faq: "", mediaTitle: "Musik & Social", media: "", embed: false, email: "", phone: "", whatsapp: "", address: "", social: "",
  legal: { name: "", street: "", city: "", email: "", phone: "", responsible: "", business: false, vat: "", register: "" },
  host: "netlify", sections: { about: true, services: true, events: true, media: true, gallery: false, reviews: false, faq: true, contact: true, pricing: false, team: false, hours: false, partners: false, video: false, form: false },
  announce: "", announceUrl: "", badge: "", heroImg: "", heroLayout: "center", font: "auto", btnShape: "rund",
  pricingTitle: "Tickets & Preise", pricing: "", teamTitle: "Team", team: "", hours: "", partnersTitle: "Partner & Sponsoren", partners: "", video: "", mapEmbed: false,
  formTitle: "Schreib uns", seoDesc: "", ogImage: "", favicon: "", keywords: "", lang: "de",
};

export function legalMissing(s) {
  const l = s.legal || {};
  return [["name", "Name"], ["street", "Straße"], ["city", "PLZ und Ort"], ["email", "E-Mail"]].filter(([k]) => !String(l[k] || "").trim()).map((x) => x[1]);
}

export function buildPro(s0, { hosted = false } = {}) {
  const s = { ...DEFAULTS, ...s0, legal: { ...DEFAULTS.legal, ...(s0.legal || {}) }, sections: { ...DEFAULTS.sections, ...(s0.sections || {}) } };
  const t0 = STYLES[s.style] || STYLES.nacht;
  const t = { ...t0, font: (FONTS[s.font] && FONTS[s.font][1]) || t0.font };
  const a = /^#[0-9a-f]{6}$/i.test(s.accent || "") ? s.accent : t.a;
  const L = s.legal, H = HOSTS[s.host] || HOSTS.netlify;
  const sec = s.sections;
  const year = new Date().getFullYear();
  const nav = [sec.about && s.about && ["about", "Über uns"], sec.services && s.services && ["services", s.servicesTitle], sec.events && s.events && ["events", s.eventsTitle], sec.media && s.media && ["media", s.mediaTitle], sec.gallery && s.gallery && ["gallery", "Galerie"], sec.reviews && s.reviews && ["reviews", "Stimmen"], sec.pricing && s.pricing && ["pricing", s.pricingTitle], sec.team && s.team && ["team", s.teamTitle], sec.faq && s.faq && ["faq", "FAQ"], sec.contact && ["contact", "Kontakt"]].filter(Boolean);
  const btn = (txt, u, cls) => (txt && url(u) ? `<a class="btn ${cls}" href="${esc(url(u))}" target="_blank" rel="noopener">${esc(txt)}</a>` : txt && /^#/.test(u || "") ? `<a class="btn ${cls}" href="${esc(u)}">${esc(txt)}</a>` : "");
  const card = (r) => `<article class="card rv"><h3>${esc(r[0])}</h3>${r[1] ? `<p>${esc(r[1])}</p>` : ""}${r[2] ? `<div class="price">${esc(r[2])}</div>` : ""}</article>`;
  const ev = (r) => `<li class="ev rv"><div class="d">${esc(r[0])}</div><div><b>${esc(r[1] || "")}</b>${r[2] ? `<div class="m">${esc(r[2])}</div>` : ""}</div>${url(r[3]) ? `<a class="btn sm" href="${esc(url(r[3]))}" target="_blank" rel="noopener">${esc(r[4] || "Tickets")}</a>` : ""}</li>`;
  const imgs = rows(s.gallery).map((r) => url(r[0]) ? `<figure class="rv"><img src="${esc(url(r[0]))}" alt="${esc(r[1] || s.name)}" loading="lazy">${r[1] ? `<figcaption>${esc(r[1])}</figcaption>` : ""}</figure>` : "").join("");
  const rev = rows(s.reviews).map((r) => `<blockquote class="card rv">${stars(r[1])}<p>„${esc(r[2] || "")}“</p><cite>– ${esc(r[0])}</cite></blockquote>`).join("");
  const avg = (() => { const v = rows(s.reviews).map((r) => Number(r[1]) || 0).filter(Boolean); return v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(1).replace(".", ",") : ""; })();
  const mediaRows = rows(s.media).filter((r) => url(r[1] || r[0]));
  const embedOn = s.embed && !hosted;
  const media = mediaRows.map((r) => { const u = url(r[1] || r[0]); const mi = mediaInfo(u); const label = r[1] ? r[0] : mi.name;
    return embedOn && mi.embed ? `<div class="emb rv">${mi.height ? `<iframe src="${esc(mi.embed)}" height="${mi.height}" loading="lazy" allow="encrypted-media; fullscreen" title="${esc(label)}"></iframe>` : `<div class="vid"><iframe src="${esc(mi.embed)}" loading="lazy" allow="encrypted-media; fullscreen" allowfullscreen title="${esc(label)}"></iframe></div>`}</div>`
      : `<a class="mc rv" href="${esc(u)}" target="_blank" rel="noopener" style="--mc:${mi.color}"><span class="dot"></span><span><b>${esc(label)}</b><small>${esc(mi.name)} öffnen ↗</small></span></a>`; }).join("");
  const faq = rows(s.faq).map((r) => `<details class="rv"><summary>${esc(r[0])}</summary><p>${esc(r[1] || "")}</p></details>`).join("");
  const soc = rows(s.social).map((r) => url(r[1] || r[0]) ? `<a href="${esc(url(r[1] || r[0]))}" target="_blank" rel="noopener">${esc(r[1] ? r[0] : r[0].replace(/^https:\/\/(www\.)?/, "").split("/")[0])}</a>` : "").join("");
  const wa = String(s.whatsapp || "").replace(/[^\d]/g, "");
  const pricing = rows(s.pricing).map((r) => `<article class="card pc rv"><h3>${esc(r[0])}</h3><div class="amt">${esc(r[1] || "")}</div>${r[2] ? `<p>${esc(r[2])}</p>` : ""}${url(r[3]) ? `<a class="btn sm" href="${esc(url(r[3]))}" target="_blank" rel="noopener">${esc(r[4] || "Jetzt sichern")}</a>` : ""}</article>`).join("");
  const team = rows(s.team).map((r) => `<div class="card tm rv">${url(r[2]) ? `<img src="${esc(url(r[2]))}" alt="${esc(r[0])}" loading="lazy">` : `<div class="av">${esc(String(r[0]).trim().charAt(0).toUpperCase())}</div>`}<b>${esc(r[0])}</b>${r[1] ? `<small>${esc(r[1])}</small>` : ""}</div>`).join("");
  const hours = rows(s.hours).map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1] || "geschlossen")}</td></tr>`).join("");
  const partners = rows(s.partners).map((r) => { const u = url(r[1]); const img = url(r[2]) ? `<img src="${esc(url(r[2]))}" alt="" loading="lazy">` : ""; return u ? `<a class="rv" href="${esc(u)}" target="_blank" rel="noopener">${img}${esc(r[0])}</a>` : `<span class="rv">${img}${esc(r[0])}</span>`; }).join("");
  const vInfo = url(s.video) ? mediaInfo(url(s.video)) : null;
  const videoHtml = vInfo ? (!hosted && vInfo.embed ? `<div class="vid rv"><iframe src="${esc(vInfo.embed)}" loading="lazy" allow="encrypted-media; fullscreen" allowfullscreen title="Video"></iframe></div>` : `<a class="mc rv" href="${esc(url(s.video))}" target="_blank" rel="noopener" style="--mc:${vInfo.color}"><span class="dot"></span><span><b>Video ansehen</b><small>${esc(vInfo.name)} öffnen ↗</small></span></a>`) : "";
  const mapHtml = s.mapEmbed && !hosted && s.address ? `<div class="map"><iframe loading="lazy" title="Karte" src="https://www.openstreetmap.org/export/embed.html?layer=mapnik&amp;query=${encodeURIComponent(s.address)}"></iframe></div>` : "";
  const formHtml = sec.form && s.email ? `<form class="cf rv" action="mailto:${esc(s.email)}" method="post" enctype="text/plain"><input name="Name" placeholder="Dein Name" required aria-label="Name"><input name="E-Mail" type="email" placeholder="Deine E-Mail" required aria-label="E-Mail"><textarea name="Nachricht" rows="5" placeholder="Deine Nachricht" required aria-label="Nachricht"></textarea><button class="btn" type="submit">Absenden</button><small style="color:${t.mut}">Öffnet dein E-Mail-Programm. Deine Angaben verwenden wir nur zur Beantwortung.</small></form>` : "";
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
.cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:30px}.btn{display:inline-block;padding:13px 24px;border-radius:${s.btnShape === "eckig" ? "6px" : s.btnShape === "kantig" ? "0" : "999px"};background:linear-gradient(135deg,${a},${t.b});color:#fff;font-weight:700;text-decoration:none}.btn.ghost{background:transparent;color:${t.fg};border:1.5px solid ${t.line}}.btn.sm{padding:8px 16px;font-size:14px}
section{padding:72px 0}section h2{font-size:clamp(28px,4vw,42px);margin:0 0 26px;letter-spacing:-.01em}.alt{background:${t.card}}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.card{background:${t.card};border:1px solid ${t.line};border-radius:${t.radius};padding:22px}.alt .card{background:${t.bg}}.card h3{margin:0 0 6px}.card p{margin:0;color:${t.mut}}.price{margin-top:12px;font-weight:700;color:${a}}
.lead{font-size:18px;max-width:760px;color:${t.mut}}
ul.evs{list-style:none;padding:0;margin:0;display:grid;gap:12px}.ev{display:flex;gap:18px;align-items:center;background:${t.card};border:1px solid ${t.line};border-radius:${t.radius};padding:16px 18px}.ev .d{font-weight:800;color:${a};min-width:110px}.ev .m{color:${t.mut};font-size:14px}.ev .btn{margin-left:auto}
.gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}figure{margin:0;overflow:hidden;border-radius:${t.radius}}figure img{width:100%;aspect-ratio:4/3;object-fit:cover}figcaption{font-size:13px;color:${t.mut};padding:6px 2px}
blockquote{margin:0}.st{color:#f5b301;letter-spacing:2px;font-size:18px}cite{display:block;margin-top:10px;color:${t.mut};font-style:normal;font-size:14px}.avg{color:${t.mut};margin:-14px 0 22px}
.media{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.mc{display:flex;gap:14px;align-items:center;padding:18px;border-radius:${t.radius};background:${t.card};border:1px solid ${t.line};text-decoration:none;color:${t.fg};position:relative;overflow:hidden}.mc::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,var(--mc),transparent 60%);opacity:.14}.mc .dot{width:42px;height:42px;border-radius:50%;background:var(--mc);flex:none;box-shadow:0 0 24px var(--mc)}.mc small{display:block;color:${t.mut}}.emb iframe{width:100%;border:0;border-radius:12px}.vid{position:relative;aspect-ratio:16/9}.vid iframe{position:absolute;inset:0;height:100%}
details{border-bottom:1px solid ${t.line};padding:14px 0}summary{cursor:pointer;font-weight:700;font-size:17px}details p{color:${t.mut};margin:10px 0 0}
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.contact a,.contact div{display:block;background:${t.card};border:1px solid ${t.line};border-radius:${t.radius};padding:18px;text-decoration:none;color:${t.fg}}.contact small{display:block;color:${t.mut}}
.soc{display:flex;gap:14px;flex-wrap:wrap;margin-top:18px}
footer{border-top:1px solid ${t.line};padding:34px 0 46px;color:${t.mut};font-size:14px}footer .w{display:flex;gap:16px;flex-wrap:wrap;align-items:center}footer a{color:${t.mut}}
.legal{display:none;position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.6);padding:4vh 16px;overflow:auto}.legal:target{display:block}.legal .box{max-width:780px;margin:0 auto;background:${t.bg};color:${t.fg};border-radius:${t.radius};padding:28px 26px;border:1px solid ${t.line}}.legal h2{margin-top:0}.legal h3{margin:22px 0 6px;font-size:17px}.legal p{color:${t.mut};margin:6px 0}.x{float:right;text-decoration:none;font-size:26px;line-height:1;color:${t.mut}}
.ann{display:block;text-align:center;padding:9px 16px;background:linear-gradient(90deg,${a},${t.b});color:#fff;font-weight:700;font-size:14px;text-decoration:none}
.badge{display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid ${t.line};background:${t.card};color:${t.fg};font-size:14px;font-weight:600;margin-bottom:18px}
.hero.left{text-align:left}.hero.left .tag{margin:0}.hero.left .cta{justify-content:flex-start}
.hero.img{background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.7)),var(--hi) center/cover no-repeat;color:#fff}.hero.img .tag{color:#e8e8ee}
.hero.split .w{display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:center;text-align:left}.hero.split .cta{justify-content:flex-start}.hero.split .tag{margin:0}.hero.split img{border-radius:${t.radius};box-shadow:0 30px 60px -30px ${a}88;width:100%;aspect-ratio:4/3;object-fit:cover}
.prices{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.pc{display:flex;flex-direction:column;gap:8px}.pc .amt{font-size:30px;font-weight:800;color:${a}}.pc .btn{align-self:flex-start;margin-top:auto}
.team{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}.tm{text-align:center}.tm img,.tm .av{width:110px;height:110px;border-radius:50%;object-fit:cover;margin:0 auto 10px;background:linear-gradient(135deg,${a},${t.b});display:grid;place-items:center;color:#fff;font-size:38px;font-weight:800}.tm small{display:block;color:${t.mut}}
.hours{max-width:520px;border-collapse:collapse;width:100%}.hours td{padding:10px 4px;border-bottom:1px solid ${t.line}}.hours td:last-child{text-align:right;font-weight:600}
.partners{display:flex;flex-wrap:wrap;gap:14px;align-items:center}.partners a,.partners span{display:flex;align-items:center;gap:10px;padding:12px 18px;border:1px solid ${t.line};border-radius:${t.radius};background:${t.card};color:${t.fg};text-decoration:none;font-weight:600}.partners img{height:34px;width:auto}
.map iframe{width:100%;height:320px;border:0;border-radius:${t.radius};margin-top:14px}
form.cf{display:grid;gap:12px;max-width:620px}form.cf input,form.cf textarea{width:100%;padding:12px 14px;border-radius:10px;border:1px solid ${t.line};background:${t.card};color:${t.fg};font:inherit}form.cf button{border:0;cursor:pointer;justify-self:start}
@media(max-width:760px){.hero.split .w{grid-template-columns:1fr}}
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
${embedOn && mediaRows.some((r) => mediaInfo(url(r[1] || r[0])).embed) ? `<h3>5a. Eingebettete Player</h3><p>Auf dieser Seite sind Player von ${esc([...new Set(mediaRows.map((r) => mediaInfo(url(r[1] || r[0]))).filter((m) => m.embed).map((m) => m.name))].join(", "))} eingebunden. Beim Laden der Seite werden dabei Daten (u. a. deine IP-Adresse) an den jeweiligen Anbieter übertragen; dieser kann Cookies setzen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO bzw. – soweit Cookies gesetzt werden – deine Einwilligung (§ 25 TDDDG).</p>` : ""}
<h3>6. Deine Rechte</h3><p>Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO).</p>
<p><small>Stand: ${new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</small></p></div></div>`;
  const body = `${s.announce ? (url(s.announceUrl) ? `<a class="ann" href="${esc(url(s.announceUrl))}" target="_blank" rel="noopener">${esc(s.announce)} →</a>` : `<div class="ann">${esc(s.announce)}</div>`) : ""}<nav><div class="w"><b>${esc(s.name || "Deine Seite")}</b>${nav.map(([id, n]) => `<a href="#${id}">${esc(n)}</a>`).join("")}</div></nav>
<header class="hero ${s.heroLayout === "left" ? "left" : s.heroLayout === "split" && url(s.heroImg) ? "split" : ""} ${s.heroLayout !== "split" && url(s.heroImg) ? "img" : ""}" ${s.heroLayout !== "split" && url(s.heroImg) ? `style="--hi:url('${esc(url(s.heroImg))}')"` : ""}><div class="orb o1"></div><div class="orb o2"></div><div class="w"><div>${s.badge ? `<span class="badge">${esc(s.badge)}</span>` : ""}<h1>${esc(s.name || "Dein Name")}</h1>${s.tagline ? `<p class="tag">${esc(s.tagline)}</p>` : ""}<div class="cta">${btn(s.cta1, s.cta1url, "")}${btn(s.cta2, s.cta2url, "ghost")}</div></div>${s.heroLayout === "split" && url(s.heroImg) ? `<img src="${esc(url(s.heroImg))}" alt="${esc(s.name)}">` : ""}</div></header>
${sec.about && s.about ? `<section id="about"><div class="w"><h2 class="rv">Über uns</h2><div class="lead rv">${paras(s.about)}</div></div></section>` : ""}
${sec.services && s.services ? `<section id="services" class="alt"><div class="w"><h2 class="rv">${esc(s.servicesTitle)}</h2><div class="grid">${rows(s.services).map(card).join("")}</div></div></section>` : ""}
${sec.events && s.events ? `<section id="events"><div class="w"><h2 class="rv">${esc(s.eventsTitle)}</h2><ul class="evs">${rows(s.events).map(ev).join("")}</ul></div></section>` : ""}
${sec.media && media ? `<section id="media" class="alt"><div class="w"><h2 class="rv">${esc(s.mediaTitle)}</h2><div class="media">${media}</div></div></section>` : ""}
${sec.gallery && imgs ? `<section id="gallery" class="alt"><div class="w"><h2 class="rv">Galerie</h2><div class="gal">${imgs}</div></div></section>` : ""}
${sec.reviews && rev ? `<section id="reviews"><div class="w"><h2 class="rv">${esc(s.reviewsTitle)}</h2>${avg ? `<p class="avg">${stars(Number(avg.replace(",", ".")))} ${avg} von 5 · ${rows(s.reviews).length} Bewertungen</p>` : ""}<div class="grid">${rev}</div></div></section>` : ""}
${sec.pricing && pricing ? `<section id="pricing"><div class="w"><h2 class="rv">${esc(s.pricingTitle)}</h2><div class="prices">${pricing}</div></div></section>` : ""}
${sec.team && team ? `<section id="team" class="alt"><div class="w"><h2 class="rv">${esc(s.teamTitle)}</h2><div class="team">${team}</div></div></section>` : ""}
${sec.hours && hours ? `<section id="hours"><div class="w"><h2 class="rv">Öffnungszeiten</h2><table class="hours rv">${hours}</table></div></section>` : ""}
${sec.video && videoHtml ? `<section id="video" class="alt"><div class="w"><h2 class="rv">Video</h2>${videoHtml}</div></section>` : ""}
${sec.partners && partners ? `<section id="partners"><div class="w"><h2 class="rv">${esc(s.partnersTitle)}</h2><div class="partners">${partners}</div></div></section>` : ""}
${sec.faq && faq ? `<section id="faq" class="alt"><div class="w"><h2 class="rv">Häufige Fragen</h2>${faq}</div></section>` : ""}
${sec.contact ? `<section id="contact"><div class="w"><h2 class="rv">Kontakt</h2><div class="contact">
${s.email ? `<a class="rv" href="mailto:${esc(s.email)}"><small>E-Mail</small>${esc(s.email)}</a>` : ""}${s.phone ? `<a class="rv" href="tel:${esc(String(s.phone).replace(/\s/g, ""))}"><small>Telefon</small>${esc(s.phone)}</a>` : ""}
${wa ? `<a class="rv" href="https://wa.me/${wa}" target="_blank" rel="noopener"><small>WhatsApp</small>Nachricht schreiben</a>` : ""}${s.address ? `<a class="rv" href="https://www.openstreetmap.org/search?query=${encodeURIComponent(s.address)}" target="_blank" rel="noopener"><small>Adresse</small>${esc(s.address)}</a>` : ""}</div>
${soc ? `<div class="soc">${soc}</div>` : ""}${mapHtml}${formHtml ? `<h3 style="margin-top:34px">${esc(s.formTitle)}</h3>${formHtml}` : ""}</div></section>` : ""}
<footer><div class="w"><span>© ${year} ${esc(s.name || "")}</span><a href="#impressum">Impressum</a><a href="#datenschutz">Datenschutz</a></div></footer>${impressum}${datenschutz}`;
  const desc = (s.seoDesc || s.tagline || s.about || "").replace(/\s+/g, " ").slice(0, 160);
  const ev1 = rows(s.events)[0];
  const ld = /Event/.test(s.kind) && ev1 ? { "@context": "https://schema.org", "@type": "Event", name: ev1[1] || s.name, startDate: ev1[0], location: { "@type": "Place", name: ev1[2] || s.address || "", address: s.address || ev1[2] || "" }, description: desc, ...(url(ev1[3]) ? { offers: { "@type": "Offer", url: url(ev1[3]) } } : {}) }
    : { "@context": "https://schema.org", "@type": /Café|Restaurant/.test(s.kind) ? "Restaurant" : /Firma|Dienstleister/.test(s.kind) ? "LocalBusiness" : "Organization", name: s.name, description: desc, ...(s.address ? { address: s.address } : {}), ...(s.email ? { email: s.email } : {}), ...(s.phone ? { telephone: s.phone } : {}) };
  const fav = s.favicon ? `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${String(s.favicon).slice(0, 4)}</text></svg>`)}">` : "";
  const og = `<meta property="og:title" content="${esc(s.name)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website">${url(s.ogImage || s.heroImg) ? `<meta property="og:image" content="${esc(url(s.ogImage || s.heroImg))}"><meta name="twitter:card" content="summary_large_image">` : ""}`;
  return `<!doctype html><html lang="${esc(s.lang || "de")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.name || "Website")}${s.tagline ? ` – ${esc(s.tagline).slice(0, 60)}` : ""}</title>
<meta name="description" content="${esc(desc)}">${s.keywords ? `<meta name="keywords" content="${esc(s.keywords)}">` : ""}<meta name="theme-color" content="${a}">${og}${fav}${hosted ? "" : `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`}<style>${css}</style></head><body>${body}</body></html>`;
}

// Projekt-Modul als eigene, schöne Seite (Kacheln: Text, Checkliste, Tabelle, Kennzahlen, Zeitleiste, Links, Diagramm-Werte)
export function buildModulePage({ title, subtitle = "", widgets = [], style = "nacht" }) {
  const t = STYLES[style] || STYLES.nacht;
  const md = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n/).map((l) => /^\s*[-*] /.test(l) ? `<li>${l.replace(/^\s*[-*] /, "")}</li>` : l.trim() ? `<p>${l}</p>` : "").join("").replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
  const w2h = (w) => {
    const head = w.title ? `<h2>${esc(w.title)}</h2>` : "";
    switch (w.type) {
      case "markdown": case "note": return head + `<div class="txt">${md(w.content || w.text || "")}</div>`;
      case "checklist": return head + `<ul class="chk">${(w.items || []).map((i) => `<li class="${i.done ? "d" : ""}"><span>${i.done ? "✓" : ""}</span>${esc(i.text || i.title)}</li>`).join("")}</ul>`;
      case "timeline": return head + `<ol class="tl">${(w.items || []).map((i) => `<li class="${i.done ? "d" : ""}"><b>${esc(i.date || "")}</b> ${esc(i.title || i.text || "")}</li>`).join("")}</ol>`;
      case "table": return head + `<div class="tw"><table><tr>${(w.columns || []).map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${(w.rows || []).map((r) => `<tr>${(Array.isArray(r) ? r : Object.values(r)).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
      case "stats": return head + `<div class="stats">${(w.items || []).map((i) => `<div><small>${esc(i.label)}</small><b>${esc(i.value)}${i.unit ? ` <i>${esc(i.unit)}</i>` : ""}</b></div>`).join("")}</div>`;
      case "links": return head + `<div class="lk">${(w.items || []).filter((i) => url(i.url)).map((i) => `<a href="${esc(url(i.url))}" target="_blank" rel="noopener">${esc(i.title || i.url)} ↗</a>`).join("")}</div>`;
      case "chart": { const all = (w.series || []).flatMap((x) => x.values || []).map(Number).filter(Number.isFinite); const mx = Math.max(1, ...all.map(Math.abs));
        return head + (w.series || []).map((se) => `<div class="bars">${se.name ? `<small>${esc(se.name)}</small>` : ""}${(w.labels || []).map((l, i) => `<div class="bar"><span>${esc(l)}</span><i style="width:${Math.round(Math.abs(se.values?.[i] || 0) / mx * 100)}%"></i><b>${esc(se.values?.[i])}${w.unit ? ` ${esc(w.unit)}` : ""}</b></div>`).join("")}</div>`).join(""); }
      default: return "";
    }
  };
  const css = `*{box-sizing:border-box}body{margin:0;background:${t.bg};color:${t.fg};font-family:${t.font};line-height:1.6}.w{max-width:900px;margin:0 auto;padding:0 20px}
header{padding:70px 0 40px;position:relative;overflow:hidden}header::before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,${t.a}33,transparent 50%,${t.b}2b);z-index:-1;background-size:300% 300%;animation:g 14s ease infinite}h1{font-size:clamp(32px,6vw,56px);margin:0;line-height:1.05;animation:up .8s both}header p{color:${t.mut};animation:up .8s .1s both}
section{background:${t.card};border:1px solid ${t.line};border-radius:${t.radius};padding:22px;margin:0 0 16px;animation:up .7s .2s both}h2{margin:0 0 12px;font-size:21px}.txt p{margin:6px 0}a{color:${t.a}}
ul.chk{list-style:none;padding:0;margin:0}ul.chk li{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid ${t.line}}ul.chk span{width:20px;height:20px;border-radius:6px;border:1.5px solid ${t.line};display:grid;place-items:center;font-size:13px;color:#fff;flex:none}ul.chk li.d span{background:${t.a};border-color:${t.a}}ul.chk li.d{color:${t.mut};text-decoration:line-through}
ol.tl{list-style:none;padding:0;margin:0;border-left:2px solid ${t.a};padding-left:16px}ol.tl li{margin:8px 0}ol.tl li.d{color:${t.mut}}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14.5px}td,th{padding:7px 9px;border-bottom:1px solid ${t.line};text-align:left}th{color:${t.mut};font-weight:600}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.stats div{background:${t.bg};border:1px solid ${t.line};border-radius:12px;padding:12px}.stats small{display:block;color:${t.mut}}.stats b{font-size:22px}.stats i{font-style:normal;font-size:14px;color:${t.mut}}
.lk{display:flex;flex-wrap:wrap;gap:8px}.lk a{padding:9px 14px;border-radius:99px;border:1px solid ${t.line};text-decoration:none}
.bars{margin:8px 0}.bar{display:grid;grid-template-columns:130px 1fr auto;gap:10px;align-items:center;margin:6px 0;font-size:14px}.bar i{height:12px;border-radius:6px;background:linear-gradient(90deg,${t.a},${t.b})}
footer{color:${t.mut};font-size:13px;padding:20px 0 40px}
@keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes g{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body>
<header><div class="w"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div></header><main class="w">${widgets.map(w2h).filter(Boolean).map((x) => `<section>${x}</section>`).join("")}</main>
<footer><div class="w">Stand ${new Date().toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} · geteilt über JOPML Nexus</div></footer></body></html>`;
}
