#!/usr/bin/env python3
"""nexus-sync – holt Daten aus externen Diensten und trägt sie ins JOPML Nexus Control Center ein.

Befehle:
  check                         Konfiguration und Verbindung prüfen
  netlify [--dry-run]           alle Netlify-Websites als Projekte (Kategorie „website“) eintragen/aktualisieren
  eventfrog DATEI --event NAME  Eventfrog-Export (xlsx/csv) einlesen und Ticketverkäufe melden (nur Summen, keine Käuferdaten)
  eventfrog --latest ORDNER --event NAME   neueste Export-Datei im Ordner verwenden
  all [--dry-run]               alle in sources.json eingetragenen Quellen nacheinander

Konfiguration: ~/.config/jopml-cc/config.json  {"api_url": "...", "api_key": "cck_...", "netlify_token": "...", "sources": {...}}
(alternativ Umgebungsvariablen CC_API_URL, CC_API_KEY, NETLIFY_TOKEN). Die Datei nie in Git einchecken.
Nur Python-Standardbibliothek; für .xlsx wird openpyxl genutzt, falls installiert (sonst den Export als CSV speichern).
"""
import csv, glob, io, json, os, re, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone

CFG_PATH = os.path.expanduser("~/.config/jopml-cc/config.json")


def load_cfg():
    cfg = {}
    if os.path.exists(CFG_PATH):
        with open(CFG_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
    cfg["api_url"] = os.environ.get("CC_API_URL") or cfg.get("api_url")
    cfg["api_key"] = os.environ.get("CC_API_KEY") or cfg.get("api_key")
    cfg["netlify_token"] = os.environ.get("NETLIFY_TOKEN") or cfg.get("netlify_token")
    if not cfg["api_url"] or not cfg["api_key"]:
        sys.exit(f"Konfiguration fehlt: {CFG_PATH} mit api_url und api_key anlegen (Schlüssel in Nexus › Einstellungen › API-Schlüssel, Rechte „Projekte“).")
    if not re.fullmatch(r"cck_[0-9a-f]{48}", cfg["api_key"]):
        sys.exit("api_key hat ein unerwartetes Format (erwartet cck_…).")
    return cfg


def http(method, url, headers=None, body=None, retries=2):
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", "User-Agent": "nexus-sync/1.0", **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503) and attempt < retries:
                time.sleep(2 * (attempt + 1)); continue
            raise RuntimeError(f"HTTP {e.code} bei {url.split('?')[0]}: {msg}")
        except urllib.error.URLError as e:
            if attempt < retries:
                time.sleep(2); continue
            raise RuntimeError(f"Keine Verbindung zu {url.split('?')[0]}: {e.reason}")


def nexus(cfg, route, body):
    return http("POST", cfg["api_url"].rstrip("/") + "/" + route, {"x-cc-key": cfg["api_key"]}, body)


def slugify(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9-]", "-", s)).strip("-")[:60] or "projekt"


# ---------------- Netlify ----------------
def netlify(cfg, dry=False):
    tok = cfg.get("netlify_token")
    if not tok:
        sys.exit("netlify_token fehlt: Netlify › User settings › Applications › Personal access tokens › New access token, dann in config.json eintragen.")
    auth = {"Authorization": f"Bearer {tok}"}
    sites, page = [], 1
    while True:
        batch = http("GET", f"https://api.netlify.com/api/v1/sites?filter=all&per_page=100&page={page}", auth)
        sites += batch or []
        if not batch or len(batch) < 100: break
        page += 1
    out = []
    for s in sites:
        dep = s.get("published_deploy") or {}
        last = None
        try:
            deps = http("GET", f"https://api.netlify.com/api/v1/sites/{s['id']}/deploys?per_page=1", auth) or []
            last = deps[0] if deps else None
        except RuntimeError as e:
            print(f"  ! Deploys für {s.get('name')} nicht lesbar: {e}")
        state = (last or {}).get("state") or dep.get("state") or "unbekannt"
        url = s.get("ssl_url") or s.get("url")
        repo = ((s.get("build_settings") or {}).get("repo_url")) or ""
        status = "active" if state == "ready" else "error" if state == "error" else "development"
        when = (last or {}).get("published_at") or (last or {}).get("created_at") or dep.get("published_at") or s.get("updated_at")
        body = {
            "slug": slugify("web-" + s.get("name", s["id"])), "name": s.get("name") or url, "category": "website", "status": status,
            "project_type": "website", "tags": ["website", "netlify"],
            "description": f"Website auf Netlify: {url}" + (f"\nRepository: {repo}" if repo else "") + f"\nLetzter Deploy: {state}" + (f" ({when})" if when else ""),
            "metadata": {"provider": "netlify", "site_id": s["id"], "url": url, "admin_url": s.get("admin_url"), "repo": repo,
                         "deploy_state": state, "last_deploy": when, "custom_domain": s.get("custom_domain"), "synced_at": datetime.now(timezone.utc).isoformat()},
            "modules": [
                {"name": "Website", "module_type": "metrics", "config": {"items": [
                    {"label": "Status", "value": {"ready": "Online", "error": "Fehler", "building": "Baut gerade"}.get(state, state)},
                    {"label": "Letzter Deploy", "value": (when or "–")[:16].replace("T", " ")},
                    {"label": "Domain", "value": s.get("custom_domain") or url.replace("https://", "")},
                    {"label": "Anbieter", "value": "Netlify"}]}},
                {"name": "Links", "module_type": "links", "config": {"items": [x for x in [
                    {"title": "Website öffnen", "url": url}, {"title": "Netlify-Verwaltung", "url": s.get("admin_url")},
                    {"title": "Repository", "url": repo} if repo.startswith("http") else None] if x and x.get("url")]}},
            ],
        }
        out.append(body)
        print(f"  • {body['name']}: {state} · {url}")
    if dry:
        print(f"[Probelauf] {len(out)} Websites gefunden, nichts gesendet."); return {"netlify": len(out)}
    for b in out:
        nexus(cfg, "projects/upsert", b)
    nexus(cfg, "activity", {"kind": "sync", "description": f"Netlify synchronisiert: {len(out)} Website(s)", "status": "ok"})
    print(f"✓ {len(out)} Netlify-Websites eingetragen/aktualisiert."); return {"netlify": len(out)}


# ---------------- Eventfrog-Export ----------------
COLS = {
    "category": ["ticketkategorie", "ticket category", "ticketart", "ticket type", "kategorie", "category", "ticket", "preisstufe", "price category"],
    "price": ["ticketpreis", "ticket price", "preis", "price", "betrag", "amount", "total"],
    "qty": ["anzahl", "quantity", "menge", "qty"],
    "status": ["status", "bestellstatus", "order status"],
    "order": ["bestellnummer", "order number", "order id", "bestell-id", "bestellung", "order"],
    "checkin": ["eingecheckt", "checked in", "check-in", "checkin", "eingelöst", "redeemed", "entwertet"],
    "date": ["bestelldatum", "order date", "kaufdatum", "datum", "date", "purchase date"],
}


def read_rows(path):
    if path.lower().endswith((".xlsx", ".xlsm")):
        try:
            import openpyxl  # noqa
        except ImportError:
            sys.exit("Für .xlsx wird openpyxl benötigt (pip install openpyxl) – oder den Export in Excel als CSV speichern.")
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = [["" if c is None else c for c in r] for r in ws.iter_rows(values_only=True)]
    else:
        raw = open(path, "rb").read()
        text = raw.decode("utf-8-sig", errors="replace")
        dialect = csv.Sniffer().sniff(text[:4000], delimiters=";,\t") if text.strip() else csv.excel
        rows = list(csv.reader(io.StringIO(text), dialect))
    # Kopfzeile = erste Zeile mit mind. 3 nicht-leeren Zellen
    for i, r in enumerate(rows[:15]):
        if sum(1 for c in r if str(c).strip()) >= 3:
            return [str(c).strip() for c in r], rows[i + 1:]
    sys.exit("Keine Kopfzeile gefunden.")


def find_col(header, key, override=None):
    low = [h.lower() for h in header]
    if override:
        if override.lower() in low: return low.index(override.lower())
        sys.exit(f"Spalte „{override}“ nicht gefunden. Vorhanden: {', '.join(header)}")
    for name in COLS[key]:
        for i, h in enumerate(low):
            if h == name: return i
    for name in COLS[key]:
        for i, h in enumerate(low):
            if name in h: return i
    return None


def num(v):
    if isinstance(v, (int, float)): return float(v)
    s = re.sub(r"[^\d,.\-]", "", str(v or ""))
    if not s: return 0.0
    if "," in s and "." in s: s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s: s = s.replace(",", ".")
    try: return float(s)
    except ValueError: return 0.0


def eventfrog(cfg, path, event, dry=False, create=False, project_slug=None, cols=None, capacity=None):
    cols = cols or {}
    header, rows = read_rows(path)
    ix = {k: find_col(header, k, cols.get(k)) for k in COLS}
    print(f"  Datei: {os.path.basename(path)} · {len(rows)} Zeilen")
    print("  Erkannte Spalten: " + ", ".join(f"{k}={header[i]!r}" for k, i in ix.items() if i is not None))
    if ix["category"] is None:
        sys.exit("Ticketkategorie-Spalte nicht erkannt. Mit --col-category \"Spaltenname\" angeben. Vorhanden: " + ", ".join(header))
    tiers, orders, cancelled, checked = {}, set(), 0, 0
    for r in rows:
        if not any(str(c).strip() for c in r): continue
        g = lambda k: r[ix[k]] if ix[k] is not None and ix[k] < len(r) else ""
        st = str(g("status")).lower()
        if re.search(r"storn|cancel|refund|erstatt|abgelehnt|declined", st):
            cancelled += 1; continue
        cat = str(g("category")).strip() or "Ticket"
        q = int(num(g("qty"))) if ix["qty"] is not None else 1
        q = q if q > 0 else 1
        price = num(g("price"))
        is_total = bool(re.search(r"total|gesamt|summe|betrag|amount", header[ix["price"]].lower())) if ix["price"] is not None else False
        row_total, unit = (price, price / q) if is_total else (price * q, price)
        t = tiers.setdefault(cat, {"name": cat, "sold": 0, "revenue": 0.0, "price": None})
        t["sold"] += q; t["revenue"] += row_total
        if unit: t["price"] = round(unit, 2)
        if ix["order"] is not None and str(g("order")).strip(): orders.add(str(g("order")).strip())
        cv = str(g("checkin")).strip().lower()
        if cv and cv not in ("0", "nein", "no", "false", "-", "none"): checked += q
    tiers = sorted(tiers.values(), key=lambda t: (t["price"] or 0, t["name"]))
    for t in tiers: t["revenue"] = round(t["revenue"], 2)
    sold = sum(t["sold"] for t in tiers)
    body = {"event": event, "source": "eventfrog", "tiers": tiers, "orders": len(orders) or None, "cancelled": cancelled, "checked_in": checked,
            "as_of": datetime.fromtimestamp(os.path.getmtime(path), timezone.utc).isoformat(), "create": create}
    if project_slug: body["project_slug"] = project_slug
    if capacity: body["capacity"] = capacity
    for t in tiers: print(f"  • {t['name']}: {t['sold']} × · {t['revenue']:.2f} €")
    print(f"  Summe: {sold} Tickets · {sum(t['revenue'] for t in tiers):.2f} € · {cancelled} storniert · {checked} eingecheckt")
    if dry:
        print("[Probelauf] nichts gesendet."); return {"eventfrog": sold}
    r = nexus(cfg, "events/tickets", body)
    print(f"✓ {r['event']}: {r['sold']} Tickets ({r['new_since_last']:+d} seit letztem Abruf), {r['revenue']} €")
    return {"eventfrog": sold, "new": r["new_since_last"]}


def latest(folder, pattern):
    files = [f for f in glob.glob(os.path.join(os.path.expanduser(folder), pattern)) if os.path.isfile(f)]
    if not files: sys.exit(f"Keine Datei „{pattern}“ in {folder} gefunden.")
    return max(files, key=os.path.getmtime)


def run_all(cfg, dry=False):
    src = cfg.get("sources") or {}
    done = {}
    if src.get("netlify", bool(cfg.get("netlify_token"))):
        print("Netlify …"); done.update(netlify(cfg, dry))
    for ef in src.get("eventfrog", []):
        print(f"Eventfrog – {ef['event']} …")
        try:
            done.update(eventfrog(cfg, latest(ef.get("folder", "~/Downloads"), ef.get("pattern", "*.xlsx")), ef["event"], dry, ef.get("create", False), ef.get("project_slug"), ef.get("columns"), ef.get("capacity")))
        except SystemExit as e:
            print(f"  ! übersprungen: {e}")
    if not done: print("Keine Quellen eingerichtet – siehe references/sources.md.")
    return done


def main(argv):
    if not argv or argv[0] in ("-h", "--help"): print(__doc__); return
    cmd, args = argv[0], argv[1:]
    dry = "--dry-run" in args
    def opt(name):
        return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else None
    cfg = load_cfg()
    if cmd == "check":
        r = nexus(cfg, "activity", {"kind": "sync", "description": "nexus-sync: Verbindung geprüft", "status": "info"})
        print("✓ Verbindung zum Control Center ok." if r else "?")
        print("Netlify-Token:", "vorhanden" if cfg.get("netlify_token") else "fehlt")
        print("Eventfrog-Quellen:", len((cfg.get("sources") or {}).get("eventfrog", [])))
    elif cmd == "netlify":
        netlify(cfg, dry)
    elif cmd == "eventfrog":
        event = opt("--event") or sys.exit("--event \"Eventname\" fehlt (so wie im Control Center).")
        path = latest(opt("--latest"), opt("--pattern") or "*.xlsx") if opt("--latest") else next((a for a in args if not a.startswith("--") and a not in (event, opt("--latest"), opt("--project"), opt("--capacity")) and os.path.exists(a)), None)
        if not path: sys.exit("Export-Datei angeben oder --latest ORDNER.")
        cols = {k: opt(f"--col-{k}") for k in COLS if opt(f"--col-{k}")}
        eventfrog(cfg, path, event, dry, "--create" in args, opt("--project"), cols, int(opt("--capacity")) if opt("--capacity") else None)
    elif cmd == "all":
        run_all(cfg, dry)
    else:
        sys.exit(f"Unbekannter Befehl: {cmd}\n{__doc__}")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except RuntimeError as e:
        sys.exit(f"Fehler: {e}")
