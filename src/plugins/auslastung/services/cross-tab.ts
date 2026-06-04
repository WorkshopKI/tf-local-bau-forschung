/**
 * Cross-Tab-Sync fuer das Auslastungs-Modul (v2.25).
 *
 * Unter `file://` ist `BroadcastChannel` nicht nutzbar (Pitfall #3) — cross-tab-
 * Signale laufen ueber das localStorage-`storage`-Event, das in ALLEN ANDEREN
 * gleich-Origin-Tabs feuert (alle file://-Builds = ein Origin). Schreibt ein
 * pl-Tab `auslastung.json`, pingt er die anderen Tabs; die laden daraufhin frisch
 * vom Share nach. Das verhindert Lost-Updates beim Arbeiten mit zwei parallelen
 * pl-Tabs (geteilte IndexedDB + Datei-Handle, kein nativer Cross-Tab-Abgleich):
 * sonst ueberschreibt der spaeter speichernde Tab mit seiner veralteten Kopie
 * still die Aenderungen des anderen.
 */
const PING_KEY = 'tf-auslastung-write-ping';

/** Pro Tab/Document eindeutig — um eigene Pings zu ignorieren. */
const TAB_ID: string = (() => {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`; }
})();

/** Signalisiert allen anderen Tabs: `auslastung.json` wurde gerade geschrieben. */
export function pingAuslastungWrite(): void {
  try {
    localStorage.setItem(PING_KEY, `${Date.now()}:${TAB_ID}`);
  } catch {
    /* localStorage evtl. nicht verfuegbar — best-effort, Sync entfaellt dann */
  }
}

/**
 * Registriert einen Listener fuer Schreib-Pings aus ANDEREN Tabs. Liefert eine
 * Cleanup-Funktion. Eigene Pings werden ignoriert (das storage-Event feuert
 * zwar ohnehin nur in fremden Tabs — Guertel + Hosentraeger).
 */
export function onAuslastungWrite(cb: () => void): () => void {
  const handler = (e: StorageEvent): void => {
    if (e.key !== PING_KEY || !e.newValue) return;
    if (e.newValue.endsWith(`:${TAB_ID}`)) return;
    cb();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
