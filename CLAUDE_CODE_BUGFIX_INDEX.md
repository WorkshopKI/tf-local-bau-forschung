# Prompt: 3 kritische Bugs fixen (Indexierung startet nicht)

```
Lies CLAUDE.md.

Es gibt 3 Fehler die verhindern dass die Embedding-Indexierung funktioniert.
Fixe alle drei.

═══════════════════════════════════════════════════
BUG 1: Worker lädt nicht im Dev-Modus
═══════════════════════════════════════════════════

Datei: vite.config.ts

Problem: VITE_EMBED_MODE wird im Dev-Modus auf 'external' gesetzt.
Der worker-loader versucht dann ./embedding-worker.js per fetch() zu laden,
aber diese Datei existiert nur nach build:deploy. Vite gibt index.html zurück
→ "SyntaxError: Unexpected token '<'"

Fix: Dev-Modus und Single-Modus brauchen 'inline', nur Deploy braucht 'external':

  'import.meta.env.VITE_EMBED_MODE': JSON.stringify(isDeploy ? 'external' : 'inline'),

(Vorher war: isSingle ? 'inline' : 'external' — das ist falsch weil Dev auch
external bekommt)

═══════════════════════════════════════════════════
BUG 2+3: IDBStore not opened Race Condition
═══════════════════════════════════════════════════

Datei: src/core/App.tsx

Problem: useSearchProvider(storage) und useTagProvider(storage) werden sofort
bei Mount aufgerufen, aber storage.init() läuft erst im useEffect async.
Die Hooks versuchen auf IDB zuzugreifen bevor open() aufgerufen wurde.

Fix: Die Hooks dürfen erst NACH storage.init() laufen.
Einfachste Lösung: Die Provider erst rendern wenn ready=true ist.

Aktuell:
  function AppInner({ storage }) {
    const searchValue = useSearchProvider(storage);   // ← läuft sofort, IDB noch nicht offen
    const tagValue = useTagProvider(storage);          // ← läuft sofort, IDB noch nicht offen
    const [ready, setReady] = useState(false);
    ...
  }

Fix-Option A (empfohlen): Provider in eigene Komponente die erst nach ready rendert:

  function AppInner({ storage }) {
    const [ready, setReady] = useState(false);
    const aiBridge = useMemo(() => new AIBridge(), []);

    useEffect(() => {
      storage.init().then(async () => {
        // ... existing profile/theme logic ...
        setReady(true);
      });
    }, [storage]);

    if (!ready) return <div />;

    return (
      <AIBridgeContext.Provider value={aiBridge}>
        <AppProviders storage={storage} aiBridge={aiBridge} />
      </AIBridgeContext.Provider>
    );
  }

  function AppProviders({ storage, aiBridge }) {
    const searchValue = useSearchProvider(storage);   // ← IDB ist jetzt offen
    const tagValue = useTagProvider(storage);          // ← IDB ist jetzt offen
    // ... rest of the render with Shell/Onboarding
  }

Fix-Option B (simpler): Guard in den Hooks selbst — prüfe ob IDB offen ist
bevor du darauf zugreifst, und retry wenn nicht.

Wähle Option A — das ist sauberer.

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

1. npm run dev → App öffnen in Chrome
2. Console: KEINE der 3 Fehler mehr sichtbar
3. Admin → Testdaten generieren (falls nicht schon vorhanden)
4. Admin → Komplett neu indexieren
5. Console: Modell-Download-Progress sichtbar (initiate, download, done)
6. Console: "Embedding" Meldungen für jedes Dokument
7. Admin-Seite: Chunks-Zahl springt auf ~350-450
8. Suche → "Brandschutz" → Ergebnisse erscheinen

Committe: "fix: worker inline mode in dev, IDB race condition in App.tsx"
```
