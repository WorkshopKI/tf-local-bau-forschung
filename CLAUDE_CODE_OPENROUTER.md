# Prompt: OpenRouter anbinden + API-Key UI + alle AI-Funktionen verbinden

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Ziel: Das Modell gpt-oss120B über OpenRouter (https://openrouter.ai/api/v1) für alle
AI-Funktionen nutzbar machen. Der User gibt seinen API-Key in den Einstellungen ein,
wählt den Provider, und Chat + Artefakt-Generierung nutzen automatisch diesen Provider.

Aktuell gibt es 3 Lücken:
1. Kein API-Key-Feld in der Einstellungen AI-Tab
2. AIBridge wird beim App-Start nicht aus gespeicherter Config geladen
3. Der "Testen" Button ist ein alert('Nicht implementiert')

═══════════════════════════════════════════════════
TEIL 1: Einstellungen AI-Tab erweitern
═══════════════════════════════════════════════════

Datei: src/plugins/einstellungen/EinstellungenPage.tsx

1a. Provider-Liste erweitern — füge 'openrouter' als vierten Provider-Typ hinzu:
   Die Radio-Buttons sollen sein:
   - streamlit → "Streamlit Bridge"
   - llama-local → "llama.cpp (lokal)"
   - openrouter → "OpenRouter"
   - cloud → "Cloud API (OpenAI-kompatibel)"

1b. API-Key-Feld hinzufügen — UNTER dem Model-Feld:
   - Label: "API Key"
   - Type: password (mit Augen-Icon zum Anzeigen/Verbergen)
   - Placeholder: "sk-or-... (OpenRouter) oder sk-... (OpenAI)"
   - Gleicher Style wie die anderen Inputs
   - Wird in aiConfig.apiKey gespeichert

1c. Preset-Autofill für OpenRouter:
   - Wenn User "OpenRouter" Radio-Button wählt:
     → endpoint automatisch auf "https://openrouter.ai/api/v1" setzen
     → model auf "gpt-oss120B" setzen
     → Felder bleiben editierbar (User kann überschreiben)
   - Wenn User "llama.cpp" wählt:
     → endpoint auf "http://localhost:8080" setzen
     → model leeren
   - Wenn User "Streamlit Bridge" wählt:
     → endpoint auf "http://localhost:8501" setzen

1d. "Verbindung testen" Button — FUNKTIONAL machen:
   - Erstellt temporär einen DirectLLMTransport mit den aktuellen Werten
   - Ruft transport.ping() auf
   - Zeigt Ergebnis:
     Erfolg → Grüner Badge "✓ Verbunden" der nach 3s verschwindet
     Fehler → Roter Badge "✗ Nicht erreichbar" + Fehlerdetails
   - Loading-State auf dem Button während des Tests

1e. "Speichern & Aktivieren" Button:
   - Speichert aiConfig in IDB ('ai-provider')
   - Ruft aiBridge.switchProvider(aiConfig) auf
   - Zeigt Bestätigung "Provider aktiviert ✓"
   - Bisher werden Änderungen sofort bei jedem Keystroke gespeichert —
     das ist für den API-Key ungünstig. Ändere das:
     - Endpoint, Model, Key werden NICHT bei jedem Keystroke gespeichert
     - Nur beim Klick auf [Speichern & Aktivieren]
     - Provider-Typ (Radio) darf weiterhin sofort switchen (setzt Presets)

═══════════════════════════════════════════════════
TEIL 2: Config-Typ erweitern
═══════════════════════════════════════════════════

Datei: src/core/types/config.ts

2a. AIProviderConfig type erweitern:
   type: 'streamlit' | 'llama-local' | 'openrouter' | 'cloud'
   (füge 'openrouter' hinzu)

═══════════════════════════════════════════════════
TEIL 3: AIBridge beim App-Start initialisieren
═══════════════════════════════════════════════════

Datei: src/core/App.tsx

3a. In AppInner, nach storage.init():
   - Lade gespeicherte AI-Config: storage.idb.get<AIProviderConfig>('ai-provider')
   - Wenn vorhanden UND type !== 'streamlit':
     → aiBridge.switchProvider(config)
   - So startet die App mit dem zuletzt gewählten Provider

   Aktuell (Zeile 16): const aiBridge = useMemo(() => new AIBridge(), []);
   Das bleibt, aber nach init() wird switchProvider aufgerufen:

   useEffect(() => {
     storage.init().then(async () => {
       // ... existing profile/theme logic ...
       
       // AI Provider aus Config laden
       const aiConfig = await storage.idb.get<AIProviderConfig>('ai-provider');
       if (aiConfig && aiConfig.type !== 'streamlit' && aiConfig.endpoint) {
         aiBridge.switchProvider(aiConfig);
       }
       
       setReady(true);
     });
   }, [storage, aiBridge]);

═══════════════════════════════════════════════════
TEIL 4: DirectLLMTransport für OpenRouter optimieren
═══════════════════════════════════════════════════

Datei: src/core/services/ai/transports/direct-llm.ts

4a. Name-Erkennung verbessern:
   - Aktuell: this.name = endpoint.includes('localhost') ? 'llama.cpp' : 'Cloud API'
   - Neu:
     if (endpoint.includes('localhost')) this.name = 'llama.cpp';
     else if (endpoint.includes('openrouter')) this.name = 'OpenRouter';
     else this.name = 'Cloud API';

4b. OpenRouter-spezifische Headers:
   OpenRouter empfiehlt/erwartet zusätzliche Headers:
   - 'HTTP-Referer': window.location.origin || 'https://teamflow.local'
   - 'X-Title': 'TeamFlow'
   
   Füge diese in submitMessage() und ping() hinzu wenn endpoint 'openrouter' enthält:
   
   private getHeaders(): Record<string, string> {
     const headers: Record<string, string> = { 'Content-Type': 'application/json' };
     if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
     if (this.endpoint.includes('openrouter')) {
       headers['HTTP-Referer'] = window.location.origin || 'https://teamflow.local';
       headers['X-Title'] = 'TeamFlow';
     }
     return headers;
   }

4c. submitMessage erweitern — System-Prompt unterstützen:
   Aktuell sendet submitMessage nur eine User-Message.
   Erweitere die Methode um einen optionalen System-Prompt:
   
   async submitMessage(message: string, systemPrompt?: string): Promise<string> {
     const messages: Array<{ role: string; content: string }> = [];
     if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
     messages.push({ role: 'user', content: message });
     // ... rest bleibt gleich, nutze messages statt hardcoded array
   }
   
   Und aktualisiere das AITransport Interface in streamlit.ts entsprechend
   (optionaler systemPrompt Parameter).

═══════════════════════════════════════════════════
TEIL 5: AIBridge switchProvider anpassen
═══════════════════════════════════════════════════

Datei: src/core/services/ai/bridge.ts

5a. 'openrouter' als Typ behandeln — identisch wie 'cloud',
    beides geht an DirectLLMTransport:
    
    switchProvider(config: AIProviderConfig): void {
      this.activeType = config.type;
      if (config.type === 'streamlit') {
        if (!this.transports.has('streamlit')) {
          this.transports.set('streamlit', new StreamlitBridgeTransport(config.endpoint));
        }
      } else {
        // llama-local, openrouter, cloud — alle OpenAI-kompatibel
        this.transports.set(config.type, new DirectLLMTransport(
          config.endpoint,
          config.model,
          config.apiKey || undefined,
        ));
      }
    }

═══════════════════════════════════════════════════
TEIL 6: useAIBridge Hook — Provider-Zugriff in Einstellungen
═══════════════════════════════════════════════════

Datei: src/core/hooks/useAIBridge.ts

6a. Prüfe ob der Hook den aiBridge-Kontext korrekt bereitstellt.
    Die Einstellungen-Seite braucht Zugriff auf aiBridge.switchProvider().
    Falls der Hook nur das Bridge-Objekt zurückgibt, reicht das.
    
    Falls nicht: Exportiere den AIBridgeContext so dass
    EinstellungenPage.tsx ihn importieren und nutzen kann.

═══════════════════════════════════════════════════
TEIL 7: Chat und Artefakte verifizieren
═══════════════════════════════════════════════════

Diese Dateien sollten BEREITS funktionieren, prüfe nur:

7a. src/plugins/chat/ChatView.tsx:
   - Nutzt bridge.getActiveTransport().submitMessage(msg) → OK
   - Zeigt bridge.getActiveProviderName() als Badge → OK
   - Nach Provider-Wechsel in Einstellungen: Badge sollte "OpenRouter" zeigen
   - Falls die ChatView schon mounted ist wenn der Provider wechselt:
     Prüfe ob der providerName reaktiv aktualisiert wird.
     Falls nicht: Badge-Text könnte stale sein bis zum nächsten Render.
     Quick-Fix: providerName via useEffect oder Key-Prop aktualisieren.

7b. src/plugins/bauantraege/ArtefakteTab.tsx:
   - Nutzt aiBridge.getActiveTransport().submitMessage() via ArtifactService → OK
   - Wenn AI-Aufruf fehlschlägt, fällt es auf Template-Fallback zurück → OK
   - Nach Provider-Wechsel: Nächste Generierung nutzt automatisch den neuen Provider

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

Starte die App-Preview und teste:

1. Einstellungen → AI-Provider Tab:
   - [ ] 4 Radio-Buttons sichtbar (Streamlit, llama.cpp, OpenRouter, Cloud API)
   - [ ] "OpenRouter" auswählen → Endpoint wird "https://openrouter.ai/api/v1", Model wird "gpt-oss120B"
   - [ ] API-Key-Feld sichtbar (password type)
   - [ ] API-Key eingeben: Einen Test-Key (oder Platzhalter "sk-or-test123")
   - [ ] [Verbindung testen] → Zeigt Ergebnis (Fehler wenn Key ungültig — das ist OK)
   - [ ] [Speichern & Aktivieren] → Bestätigung erscheint

2. Chat-Plugin:
   - [ ] Badge zeigt "OpenRouter" (nicht mehr "Streamlit Bridge")
   - [ ] Nachricht senden → Loading-Animation → Antwort ODER verständlicher Fehler
     (Wenn Key ungültig: "API error: 401" — das ist korrekt)

3. Bauantrag → Artefakte-Tab:
   - [ ] [Mit AI generieren] → Loading → Ergebnis ODER Template-Fallback
   - [ ] Wenn AI antwortet: Generiertes Artefakt im Editor sichtbar

4. Persistenz:
   - [ ] Seite neu laden → Einstellungen öffnen → OpenRouter ist noch ausgewählt
   - [ ] Chat öffnen → Badge zeigt immer noch "OpenRouter"
   - [ ] API-Key ist gespeichert (Feld zeigt ●●●●●●●● weil password)

5. Console:
   - [ ] Keine Errors (außer 401 wenn Key ungültig)
   - [ ] Kein API-Key in Console-Logs sichtbar (Sicherheit!)

Committe: "feat: OpenRouter integration with API key UI, provider persistence, all AI functions connected"
```
