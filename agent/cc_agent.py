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
Abhängigkeit: psutil empfohlen (pip install psutil). Ohne psutil funktioniert der Agent unter Linux über /proc.
"""
import json, os, platform, signal, socket, subprocess, sys, time, urllib.error, urllib.request
from collections import deque
from datetime import datetime, timezone

try:
    import psutil  # type: ignore
except ImportError:  # Linux-Rückfall über /proc
    psutil = None

VERSION = "1.0.0"
API = os.environ.get("CC_API_URL", "").rstrip("/")
KEY = os.environ.get("CC_AGENT_KEY", "")
INTERVAL = max(10, int(os.environ.get("CC_INTERVAL", "30")))
SERVICES = [s.strip() for s in os.environ.get("CC_SERVICES", "").split(",") if s.strip()][:60]
DISK = os.environ.get("CC_DISK_PATH") or ("C:\\" if os.name == "nt" else "/")
BUFFER = deque(maxlen=max(1, 86400 // INTERVAL))   # höchstens 24 h puffern
RUN = True


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
    if psutil:
        psutil.cpu_percent(interval=None)  # erste Messung initialisieren
    else:
        _proc_cpu()
    log(f"gestartet (Intervall {INTERVAL}s, psutil={'ja' if psutil else 'nein'}, Dienste={len(SERVICES)})")
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
    log("beendet")


if __name__ == "__main__":
    main()
