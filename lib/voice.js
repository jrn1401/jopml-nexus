// Sprache: Diktieren (Spracherkennung des Browsers) und Vorlesen – für Barrierefreiheit und unterwegs.
// Läuft komplett im Browser/Betriebssystem, kein Server. Fehlt die Funktion, werden keine Knöpfe gezeigt.
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => !!Rec;
export const canSpeak = () => "speechSynthesis" in window;

// Diktieren in ein Eingabefeld; gibt eine Stop-Funktion zurück
export function dictate(input, { onEnd, onError } = {}) {
  if (!Rec) return null;
  const r = new Rec();
  r.lang = "de-DE"; r.interimResults = true; r.continuous = false;
  const start = input.value ? input.value.replace(/\s*$/, " ") : "";
  r.onresult = (e) => { let t = ""; for (const x of e.results) t += x[0].transcript; input.value = start + t; input.dispatchEvent(new Event("input")); };
  r.onerror = (e) => onError?.(e.error === "not-allowed" ? "Mikrofon nicht erlaubt – in den Browser-Einstellungen freigeben." : "Spracherkennung nicht verfügbar.");
  r.onend = () => onEnd?.();
  r.start();
  return () => r.stop();
}

// Text vorlesen (Markdown wird grob entfernt); erneuter Aufruf stoppt
export function speak(text) {
  if (!canSpeak()) return;
  if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return; }
  const u = new window.SpeechSynthesisUtterance(String(text).replace(/[#*_`>|[\]()]/g, " ").replace(/https?:\/\/\S+/g, "Link").slice(0, 4000));
  u.lang = "de-DE"; u.rate = 1.02;
  const de = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("de"));
  if (de) u.voice = de;
  window.speechSynthesis.speak(u);
}

// Mikrofon-Knopf für ein Eingabefeld (h = DOM-Helfer der App)
export function micButton(h, input, cls = "btn") {
  if (!canListen()) return null;
  let stop = null;
  const b = h(`button.${cls}`, { type: "button", title: "Diktieren", "aria-label": "Spracheingabe", onclick: () => {
    if (stop) { stop(); return; }
    b.classList.add("rec"); b.textContent = "● …";
    stop = dictate(input, { onEnd: () => { stop = null; b.classList.remove("rec"); b.textContent = "🎤"; }, onError: (m) => { input.placeholder = m; } });
  } }, "🎤");
  return b;
}
