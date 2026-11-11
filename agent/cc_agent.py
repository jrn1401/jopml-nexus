#!/usr/bin/env python3
"""JOPML Control Center – ressourcenschonender Serveragent.

Sendet alle CC_INTERVAL Sekunden CPU, RAM, Speicher, Netzwerkzähler, Uptime und optional den Status
ausgewählter Dienste an die Edge Function cc-api. Bei Verbindungsproblemen werden Messwerte gepuffert
(max. 24 h) und später nachgeliefert. Keine Prozesslisten, keine Dateiinhalte, keine Nutzerdaten.

Umgebungsvariablen:
  CC_API_URL     https://<projekt>.supabase.co/functions/v1/cc-api   (Pflicht)
  CC_AGENT_KEY   cck_…  (Agent-Schlüssel aus „Server verbinden“; Pflicht)
  CC_INTERVAL    Sekunden zwischen Messungen (Standard 30, min. 10)
  CC_SERVICES    kommagetrennte Dienstnamen, z. B. nginx,postgresql (optional)
  CC_DISK_PATH   Pfad für die Speicherbelegung (Standard / bzw. C:\\)

Hosting (Apps über die Website auf diesem Gerät betreiben):
  CC_HOSTING         1 = Hosting einschalten (Standard aus)
  CC_ALLOW_COMMANDS  1 = auch eigene Startbefehle und Docker-Container erlauben (Standard aus – nur statische Seiten)
  CC_HOST_DIR        Arbeitsordner für Git-Repos und Projektdateien (Standard ~/.cc-agent/apps)
  CC_HOST_ROOTS      kommagetrennte Ordner, die als statische Seite freigegeben werden dürfen (Standard: Benutzerordner)
  CC_CLOUDFLARED     Pfad zu cloudflared für öffentliche Links (Standard: im PATH suchen)
Statische Seiten liefern nie versteckte Dateien (.env, .git …) oder Schlüsseldateien aus.
Abhängigkeit: psutil empfohlen (pip install psutil). Ohne psutil funktioniert der Agent unter Linux über /proc.
"""
import functools, hashlib, http.server, json, os, platform, re, shlex, shutil, signal, socket, subprocess, sys, threading, time
import urllib.error, urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

try:
    import psutil  # type: ignore
except ImportError:  # Linux-Rückfall über /proc
    psutil = None

VERSION = "2.0.0"
API = os.environ.get("CC_API_URL", "").rstrip("/")
KEY = os.environ.get("CC_AGENT_KEY", "")
INTERVAL = max(10, int(os.environ.get("CC_INTERVAL", "30")))
SERVICES = [s.strip() for s in os.environ.get("CC_SERVICES", "").split(",") if s.strip()][:60]
DISK = os.environ.get("CC_DISK_PATH") or ("C:\\" if os.name == "nt" else "/")
BUFFER = deque(maxlen=max(1, 86400 // INTERVAL))   # höchstens 24 h puffern
RUN = True
ON = ("1", "true", "yes", "ja", "on")
HOSTING = os.environ.get("CC_HOSTING", "").lower() in ON
ALLOW_CMD = os.environ.get("CC_ALLOW_COMMANDS", "").lower() in ON
HOME = Path.home()
HOST_DIR = Path(os.environ.get("CC_HOST_DIR") or HOME / ".cc-agent" / "apps").expanduser()
HOST_ROOTS = [Path(p.strip()).expanduser().resolve() for p in os.environ.get("CC_HOST_ROOTS", "").split(",") if p.strip()] or [HOME.resolve(), HOST_DIR.resolve()]
HOST_API = re.sub(r"/cc-api$", "/nx-host", API)


def log(msg):
    print(f"{datetime.now().isoformat(timespec='seconds')} cc-agent: {msg}", flush=True)


# ---------------------------------------------------------------- Messwerte
_prev_cpu = None


def _proc_cpu():
    global _prev_cpu
    with open("/proc/stat") as f:
        vals = [int(x) for x in f.readline().split()[1:]]
    idle, total = vals[3] + (vals[4] if len(vals) > 4 else 0), sum(vals)
    prev, _prev_cpu = _prev_cpu, (idle, total)
    if not prev or total == prev[1]:
        return None
    return round(100.0 * (1 - (idle - prev[0]) / (total - prev[1])), 1)


def _proc_mem():
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, v = line.split(":", 1)
            info[k] = int(v.split()[0]) * 1024
    total, avail = info.get("MemTotal", 0), info.get("MemAvailable", info.get("MemFree", 0))
    return (round(100.0 * (total - avail) / total, 1) if total else None), total


def _proc_net():
    rx = tx = 0
    with open("/proc/net/dev") as f:
        for line in f.readlines()[2:]:
            name, data = line.split(":", 1)
            if name.strip() == "lo":
                continue
            parts = data.split()
            rx, tx = rx + int(parts[0]), tx + int(parts[8])
    return rx, tx


def _disk():
    try:
        if psutil:
            d = psutil.disk_usage(DISK)
            return round(d.percent, 1), d.total
        st = os.statvfs(DISK)
        total, free = st.f_blocks * st.f_frsize, st.f_bavail * st.f_frsize
        return (round(100.0 * (total - free) / total, 1) if total else None), total
    except OSError:
        return None, None


def sample():
    ts = datetime.now(timezone.utc).isoformat()
    disk, _ = _disk()
    if psutil:
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().percent
        n = psutil.net_io_counters()
        rx, tx = n.bytes_recv, n.bytes_sent
    else:
        cpu = _proc_cpu()
        mem, _ = _proc_mem()
        rx, tx = _proc_net()
    return {"ts": ts, "cpu": cpu, "mem": mem, "disk": disk, "net_in": rx, "net_out": tx}


def static_info():
    disk_pct, disk_total = _disk()
    if psutil:
        mem_total, cores, uptime = psutil.virtual_memory().total, psutil.cpu_count(logical=True), int(time.time() - psutil.boot_time())
    else:
        _, mem_total = _proc_mem()
        cores = os.cpu_count()
        with open("/proc/uptime") as f:
            uptime = int(float(f.read().split()[0]))
    osname = f"{platform.system()} {platform.release()}"
    if platform.system() == "Linux":
        try:
            with open("/etc/os-release") as f:
                kv = dict(line.rstrip().split("=", 1) for line in f if "=" in line)
            osname = kv.get("PRETTY_NAME", osname).strip('"')
        except OSError:
            pass
    return {"hostname": socket.gethostname(), "os": osname, "cpu_cores": cores, "memory_total": mem_total, "disk_total": disk_total, "uptime": uptime}


def service_status(name):
    try:
        if os.name == "nt":
            out = subprocess.run(["sc", "query", name], capture_output=True, text=True, timeout=5).stdout
            return "running" if "RUNNING" in out else ("stopped" if "STOPPED" in out else "unknown")
        r = subprocess.run(["systemctl", "is-active", name], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        if psutil:
            return "running" if any(p.info["name"] == name for p in psutil.process_iter(["name"])) else "not running"
        return "unknown"


# ---------------------------------------------------------------- Hosting
SECRET_RE = re.compile(r"(^|/)(\.[^/]*|.*\.(pem|key|p12|pfx|kdbx|keystore|jks|ovpn)|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|credentials(\.json)?|secrets?\.(json|ya?ml|toml))$", re.I)
TUNNEL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com", re.I)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))   # sendet nichts, ermittelt nur die eigene Netzwerkadresse
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


class SafeHandler(http.server.SimpleHTTPRequestHandler):
    """Statische Dateien ohne Verzeichnislisten, ohne versteckte Dateien und ohne Schlüsseldateien."""
    app = None

    def send_head(self):
        rel = urllib.request.unquote(self.path.split("?", 1)[0].split("#", 1)[0]).lstrip("/")
        if any(SECRET_RE.search("/".join(Path(rel).parts[: i + 1])) for i in range(len(Path(rel).parts))):
            self.send_error(404)
            return None
        full = Path(self.translate_path(self.path))
        if full.is_dir() and not (full / "index.html").exists():
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.app:
            self.app.say(f"{self.address_string()} {fmt % args}")


class App:
    def __init__(self, cfg):
        self.id, self.cfg, self.rev = cfg["id"], cfg, -1
        self.state, self.error, self.pid = "stopped", None, None
        self.local_url = self.lan_url = self.public_url = None
        self.log = deque(maxlen=80)
        self.proc = self.httpd = self.tunnel = None
        self.started = 0.0
        self.fails = 0
        self.workdir = HOST_DIR / self.id[:8]

    # -- Hilfen
    def say(self, line):
        self.log.append(f"{datetime.now().strftime('%H:%M:%S')} {str(line).rstrip()[:300]}")

    def _pipe(self, stream, tunnel=False):
        for raw in iter(stream.readline, b""):
            line = raw.decode(errors="replace").rstrip()
            if tunnel:
                m = TUNNEL_RE.search(line)
                if m and not self.public_url:
                    self.public_url = m.group(0)
                    self.say(f"Öffentlicher Link: {self.public_url}")
                if "ERR" in line or "error" in line.lower():
                    self.say(f"[Tunnel] {line}")
            else:
                self.say(line)

    def _spawn(self, args, cwd, env=None, tunnel=False):
        kw = {"cwd": str(cwd), "stdout": subprocess.PIPE, "stderr": subprocess.STDOUT, "stdin": subprocess.DEVNULL, "env": env}
        if os.name == "nt":
            kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | getattr(subprocess, "CREATE_NO_WINDOW", 0)
        else:
            kw["start_new_session"] = True
        p = subprocess.Popen(args, **kw)
        threading.Thread(target=self._pipe, args=(p.stdout, tunnel), daemon=True).start()
        return p

    @staticmethod
    def _kill(p):
        if not p or p.poll() is not None:
            return
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True, timeout=10)
            else:
                os.killpg(p.pid, signal.SIGTERM)
            p.wait(timeout=10)
        except (OSError, subprocess.SubprocessError):
            try:
                p.kill()
            except OSError:
                pass

    def host(self):
        return "0.0.0.0" if self.cfg.get("bind") == "lan" else "127.0.0.1"

    # -- Quellen vorbereiten
    def _static_dir(self, path):
        d = Path(path).expanduser().resolve()
        if not d.is_dir():
            raise RuntimeError(f"Ordner nicht gefunden: {d}")
        if d in (Path(d.anchor), HOME.resolve()) or not any(d == r or r in d.parents for r in HOST_ROOTS):
            raise RuntimeError(f"Ordner nicht freigegeben: {d}. Erlaubt sind Unterordner von: {', '.join(map(str, HOST_ROOTS))} (CC_HOST_ROOTS)")
        if any(part.startswith(".") for part in d.parts[1:]):
            raise RuntimeError("Versteckte Ordner werden nicht ausgeliefert.")
        return d

    def _git(self):
        repo = str(self.cfg["config"].get("repo") or "")
        if not re.match(r"^https://[\w.-]+/[\w./~-]+$", repo):
            raise RuntimeError("Git-Repository muss eine https-Adresse sein.")
        git = shutil.which("git")
        if not git:
            raise RuntimeError("git ist auf diesem Gerät nicht installiert.")
        target = self.workdir / "repo"
        branch = str(self.cfg["config"].get("branch") or "")
        env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
        if (target / ".git").is_dir():
            self.say("Git: aktualisiere …")
            subprocess.run([git, "-C", str(target), "fetch", "--depth", "1", "origin"] + ([branch] if branch else []), check=True, capture_output=True, timeout=300, env=env)
            subprocess.run([git, "-C", str(target), "reset", "--hard", "FETCH_HEAD"], check=True, capture_output=True, timeout=60, env=env)
        else:
            self.say(f"Git: klone {repo} …")
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.rmtree(target, ignore_errors=True)
            subprocess.run([git, "clone", "--depth", "1"] + (["--branch", branch] if branch else []) + [repo, str(target)], check=True, capture_output=True, timeout=600, env=env)
        rev = subprocess.run([git, "-C", str(target), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
        self.say(f"Git: Stand {rev}")
        return target

    def _nexus(self, files):
        target = self.workdir / "site"
        target.mkdir(parents=True, exist_ok=True)
        idx_file = self.workdir / "index.json"
        try:
            idx = json.loads(idx_file.read_text())
        except (OSError, ValueError):
            idx = {}
        keep, got = set(), 0
        for f in files:
            rel = Path(f["path"])
            if rel.is_absolute() or ".." in rel.parts:
                continue
            dest = (target / rel).resolve()
            if target.resolve() not in dest.parents:
                continue
            keep.add(str(rel))
            if idx.get(str(rel)) == f["hash"] and dest.exists():
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(f["url"], timeout=120) as r:
                data = r.read()
            if hashlib.sha256(data).hexdigest() != f["hash"]:
                raise RuntimeError(f"Prüfsumme falsch: {rel}")
            dest.write_bytes(data)
            idx[str(rel)] = f["hash"]
            got += 1
        for rel in list(idx):
            if rel not in keep:
                try:
                    (target / rel).unlink()
                except OSError:
                    pass
                idx.pop(rel, None)
        idx_file.write_text(json.dumps(idx))
        self.say(f"Projektdateien: {len(keep)} Dateien, {got} neu geladen")
        return target

    # -- Start / Stopp
    def start(self, manifest=None):
        c, kind, port = self.cfg.get("config") or {}, self.cfg["kind"], int(self.cfg["port"])
        self.stop(quiet=True)
        self.error, self.public_url, self.state = None, None, "starting"
        self.started = time.time()
        self.say(f"Starte „{self.cfg['name']}“ ({kind}) auf Port {port}")
        try:
            if port_open(port):
                raise RuntimeError(f"Port {port} ist auf diesem Gerät schon belegt.")
            if kind in ("command", "docker") or (kind == "git" and c.get("cmd")):
                if not ALLOW_CMD:
                    self.state = "unsupported"
                    raise RuntimeError("Eigene Befehle/Docker sind auf diesem Gerät nicht freigeschaltet (CC_ALLOW_COMMANDS=1 setzen und Agent neu starten).")
            env = dict(os.environ, PORT=str(port), HOST=self.host())
            for k in ("CC_AGENT_KEY", "CC_API_URL"):
                env.pop(k, None)
            if kind == "static":
                self._serve(self._static_dir(c.get("path") or ""))
            elif kind == "nexus":
                if manifest is None:
                    raise RuntimeError("Projektdateien nicht erhalten.")
                if not manifest:
                    raise RuntimeError("Das Projekt hat keine Dateien" + (f" im Ordner „{c.get('root')}“" if c.get("root") else "") + ".")
                self._serve(self._nexus(manifest))
            elif kind == "git":
                repo = self._git()
                if c.get("cmd"):
                    if c.get("install"):
                        self.say(f"Installiere: {c['install']}")
                        r = subprocess.run(shlex.split(c["install"], posix=os.name != "nt"), cwd=repo, env=env, capture_output=True, text=True, timeout=900)
                        for line in (r.stdout + r.stderr).splitlines()[-20:]:
                            self.say(line)
                        if r.returncode:
                            raise RuntimeError(f"Installation fehlgeschlagen (Code {r.returncode}).")
                    self.proc = self._spawn(shlex.split(c["cmd"], posix=os.name != "nt"), repo, env)
                else:
                    sub = (repo / str(c.get("subdir") or "")).resolve()
                    if repo.resolve() not in sub.parents and sub != repo.resolve():
                        raise RuntimeError("Unterordner liegt außerhalb des Repos.")
                    self._serve(sub)
            elif kind == "command":
                cwd = Path(c.get("cwd") or HOST_DIR).expanduser()
                if not cwd.is_dir():
                    raise RuntimeError(f"Arbeitsordner nicht gefunden: {cwd}")
                self.proc = self._spawn(shlex.split(str(c.get("cmd") or ""), posix=os.name != "nt"), cwd, env)
            elif kind == "docker":
                docker = shutil.which("docker")
                if not docker:
                    raise RuntimeError("Docker ist auf diesem Gerät nicht installiert.")
                image = str(c.get("image") or "")
                if not re.match(r"^[\w./:@-]{1,200}$", image):
                    raise RuntimeError("Ungültiger Image-Name.")
                cport = int(c.get("container_port") or 80)
                name = f"nexus-{self.id[:8]}"
                subprocess.run([docker, "rm", "-f", name], capture_output=True, timeout=60)
                self.proc = self._spawn([docker, "run", "--rm", "--name", name, "-p", f"{'' if self.host() == '0.0.0.0' else '127.0.0.1:'}{port}:{cport}", image], HOST_DIR, env)
            else:
                raise RuntimeError(f"Unbekannte Art: {kind}")
            self.started = time.time()
            self.local_url = f"http://localhost:{port}"
            ip = lan_ip() if self.host() == "0.0.0.0" else None
            self.lan_url = f"http://{ip}:{port}" if ip else None
            if self.cfg.get("public"):
                cf = os.environ.get("CC_CLOUDFLARED") or shutil.which("cloudflared")
                if cf:
                    self.tunnel = self._spawn([cf, "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{port}"], HOST_DIR, tunnel=True)
                    self.say("Öffentlicher Link wird eingerichtet (Cloudflare) …")
                else:
                    self.error = "Für einen öffentlichen Link „cloudflared“ installieren (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/). Die App läuft lokal trotzdem."
                    self.say(self.error)
        except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as e:
            msg = e.stderr.decode(errors="replace")[-300:] if isinstance(e, subprocess.CalledProcessError) and e.stderr else str(e)
            self.stop(quiet=True)
            if self.state != "unsupported":
                self.state = "error"
            self.error = msg
            self.say(f"Fehler: {msg}")
            self.fails += 1

    def _serve(self, directory):
        HOST_DIR.mkdir(parents=True, exist_ok=True)
        handler = type("H", (SafeHandler,), {"app": self})
        self.httpd = http.server.ThreadingHTTPServer((self.host(), int(self.cfg["port"])), functools.partial(handler, directory=str(directory)))
        self.httpd.daemon_threads = True
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.say(f"Statische Seite aus {directory}")

    def stop(self, quiet=False):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
            self.httpd = None
        self._kill(self.proc)
        self._kill(self.tunnel)
        self.proc = self.tunnel = None
        self.pid = None
        self.local_url = self.lan_url = self.public_url = None
        if not quiet:
            self.state, self.error = "stopped", None
            self.say("Gestoppt")

    # -- laufend prüfen
    def tick(self):
        if self.state not in ("starting", "running"):
            return
        if self.proc and self.proc.poll() is not None:
            code = self.proc.returncode
            self.say(f"Prozess beendet (Code {code})")
            self.stop(quiet=True)
            self.state, self.error = "error", f"Prozess beendet (Code {code})"
            self.fails += 1
            return
        if self.tunnel and self.tunnel.poll() is not None:
            self.say("Tunnel beendet")
            self.tunnel, self.public_url = None, None
        up = bool(self.httpd) or port_open(int(self.cfg["port"]))
        if up:
            self.state = "running"
            self.fails = 0
            self.pid = self.proc.pid if self.proc else os.getpid()
        elif time.time() - self.started > 120:
            self.state, self.error = "error", f"Port {self.cfg['port']} antwortet nach 2 Minuten nicht."

    def report(self):
        return {"id": self.id, "rev": self.rev, "state": self.state, "pid": self.pid, "local_url": self.local_url,
                "lan_url": self.lan_url, "public_url": self.public_url, "error": self.error, "log": "\n".join(self.log)}


class Host:
    def __init__(self):
        self.apps, self.first, self.boot_rev = {}, True, {}

    def caps(self):
        return {"version": VERSION, "commands": ALLOW_CMD, "docker": bool(shutil.which("docker")), "git": bool(shutil.which("git")),
                "cloudflared": bool(os.environ.get("CC_CLOUDFLARED") or shutil.which("cloudflared")), "python": platform.python_version(),
                "os": f"{platform.system()} {platform.release()}", "lan_ip": lan_ip()}

    def call(self, payload):
        req = urllib.request.Request(f"{HOST_API}/sync", data=json.dumps(payload).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "x-cc-key": KEY, "User-Agent": f"cc-agent/{VERSION}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"{}")

    def loop(self):
        HOST_DIR.mkdir(parents=True, exist_ok=True)
        log(f"Hosting aktiv (Befehle {'erlaubt' if ALLOW_CMD else 'aus'}, Arbeitsordner {HOST_DIR})")
        need, wait, n = [], 5, 0
        while RUN:
            for a in self.apps.values():
                a.tick()
            payload = {"apps": [a.report() for a in self.apps.values()], "need_manifest": need}
            if n % 60 == 0:
                payload["caps"] = self.caps()
            try:
                res = self.call(payload)
                wait = int(res.get("poll") or 5) if res.get("apps") else 20
                need = self.apply(res.get("apps") or [], res.get("manifests") or {})
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    log(f"Hosting: Schlüssel abgelehnt ({e.code}) – Hosting pausiert 10 Min.")
                    wait = 600
                else:
                    wait = 30
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
                log(f"Hosting: Server nicht erreichbar ({e})")
                wait = 30
            n += 1
            for _ in range(wait):
                if not RUN:
                    break
                time.sleep(1)
        for a in self.apps.values():
            a.stop()

    def apply(self, desired, manifests):
        need = []
        ids = {d["id"] for d in desired}
        for gone in [i for i in self.apps if i not in ids]:
            self.apps.pop(gone).stop()
        for d in desired:
            a = self.apps.get(d["id"])
            if not a:
                a = self.apps[d["id"]] = App(d)
                self.boot_rev[d["id"]] = d["rev"] if self.first else -1
            a.cfg = d
            if a.rev == d["rev"]:
                # gleiche Version: abgestürzte Prozesse mit Pause neu starten (max. 5 Versuche)
                if d["desired"] == "running" and a.state == "error" and 0 < a.fails < 5 and time.time() - a.started > 15 * a.fails:
                    a.say(f"Neuer Versuch ({a.fails}/5)")
                    a.rev = -1
                else:
                    continue
            if d["desired"] == "stopped" or (not d.get("autostart") and self.boot_rev.get(d["id"]) == d["rev"]):
                a.stop()
                a.rev = d["rev"]
                continue
            if d["kind"] == "nexus" and d["id"] not in manifests:
                need.append(d["id"])
                a.state = "starting"
                continue
            a.rev = d["rev"]
            a.start(manifests.get(d["id"]))
        self.first = False
        return need


# ---------------------------------------------------------------- Versand
def post(payload):
    req = urllib.request.Request(f"{API}/heartbeat", data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-cc-key": KEY, "User-Agent": f"cc-agent/{VERSION}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"{}")


def main():
    local_test = API.startswith("http://127.0.0.1") or API.startswith("http://localhost")
    if not (API.startswith("https://") or local_test) or not KEY.startswith("cck_"):
        log("CC_API_URL (https://…) und CC_AGENT_KEY (cck_…) müssen gesetzt sein.")
        sys.exit(2)
    signal.signal(signal.SIGTERM, lambda *_: globals().__setitem__("RUN", False))
    if hasattr(signal, "SIGINT"):
        signal.signal(signal.SIGINT, lambda *_: globals().__setitem__("RUN", False))
    if psutil:
        psutil.cpu_percent(interval=None)  # erste Messung initialisieren
    else:
        _proc_cpu()
    log(f"gestartet v{VERSION} (Intervall {INTERVAL}s, psutil={'ja' if psutil else 'nein'}, Dienste={len(SERVICES)}, Hosting={'an' if HOSTING else 'aus'})")
    host_thread = None
    if HOSTING:
        host_thread = threading.Thread(target=Host().loop, name="hosting", daemon=True)
        host_thread.start()
    backoff, info_every, n = INTERVAL, max(1, 600 // INTERVAL), 0
    time.sleep(min(5, INTERVAL))
    while RUN:
        BUFFER.append(sample())
        payload = {"samples": list(BUFFER)[-500:]}
        if n % info_every == 0 or len(BUFFER) > 1:
            payload.update(static_info())
        if SERVICES:
            payload["services"] = [{"name": s, "status": service_status(s)} for s in SERVICES]
        try:
            res = post(payload)
            sent = len(payload["samples"])
            for _ in range(sent):
                BUFFER.popleft()
            if backoff != INTERVAL:
                log(f"Verbindung wieder da – {sent} Messwerte nachgeliefert (Status {res.get('status')})")
            backoff = INTERVAL
        except urllib.error.HTTPError as e:
            body = e.read()[:200].decode(errors="replace")
            if e.code in (401, 403):
                log(f"Schlüssel abgelehnt ({e.code}): {body} – Agent stoppt.")
                globals()["RUN"] = False
                if host_thread:
                    host_thread.join(timeout=20)
                sys.exit(1)
            log(f"HTTP {e.code}: {body} – {len(BUFFER)} Messwerte gepuffert")
            backoff = min(backoff * 2, 600)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            log(f"nicht erreichbar ({e}) – {len(BUFFER)} Messwerte gepuffert")
            backoff = min(backoff * 2, 600)
        n += 1
        slept = 0
        while RUN and slept < (INTERVAL if backoff == INTERVAL else min(backoff, INTERVAL * 4)):
            time.sleep(1)
            slept += 1
    if host_thread:
        host_thread.join(timeout=20)   # Apps sauber beenden
    log("beendet")


if __name__ == "__main__":
    main()
