# TeamFlow Local — Zukunftsplanung: AI SDK 5 & Agenten

Erstellt: 12.04.2026 · Für nächste Session

---

## Ausgangslage

TeamFlow Local hat eine stabile Such- und Indexing-Pipeline (Orama BM25+Vektor, EmbeddingGemma 300M, Nemotron Nano 4B für Metadata). Die nächsten großen Schritte sind:
1. CSV-Import von Antragsdaten aus dem Fachverfahren
2. PDF-Verarbeitung (OCR, Stempel-Extraktion)
3. Interaktiver KI-Assistent für Sachbearbeiter

Dieses Dokument beschreibt die Architektur für Schritt 3 und wie AI SDK 5 + Tool Calling die bestehende Infrastruktur zu einem Agent-System erweitern können.

---

## Vercel AI SDK 5 — Warum jetzt relevant

### Das Problem mit dem aktuellen Chat

TeamFlow hat einen handgebauten `DirectLLMTransport` und `useAIBridge` Hook. Funktioniert, aber: kein Streaming-State-Management, kein Tool Calling, keine Message-Persistenz, keine strukturierte Fehlerbehandlung. Jedes neue Feature (Streaming, Multi-Step, Tools) müsste von Hand gebaut werden.

### Was AI SDK 5 bringt

- **Custom Transport**: `DirectChatTransport` ersetzt den handgebauten Transport. Verbindet sich direkt mit llama.cpp auf localhost — kein Backend nötig. Passt perfekt auf `file://`-Constraint.
- **`useChat` Hook**: Zustand-kompatibel (State ist "decoupled"), ersetzt `useAIBridge`. Streaming, Message-History, Error-States out of the box.
- **Tool Calling**: LLM kann JavaScript-Funktionen aufrufen — die bestehenden Services (Orama-Suche, IDB-Zugriff, Vorgangsdaten) werden zu "Tools" die der Agent nutzt.
- **Structured Output**: `generateObject` mit Zod-Schema — robuster als die aktuelle JSON-Parsing-Logik in `parseMetadataJSON`.
- **Multi-Provider**: Gleiche API für llama.cpp (lokal), OpenRouter (Cloud), Chrome Built-in AI (Zukunft).

### Constraint-Kompatibilität

| Constraint | AI SDK 5 Kompatibel? |
|---|---|
| `file://` Protokoll | ✅ DirectChatTransport nutzt `fetch` zu localhost |
| Kein Backend | ✅ Client-only Transport, kein Server-Middleware nötig |
| Single-File Build | ✅ AI SDK ist tree-shakeable, wird gebundelt |
| Vertrauliche Daten | ✅ Alles lokal über llama.cpp |
| React 19 + Zustand | ✅ Decoupled State, React-native Hooks |

---

## Agent-Architektur: Der Sachbearbeiter-Assistent

### Konzept

Der Chat wird vom passiven Q&A zum aktiven Assistenten. Der User stellt eine Frage, das LLM entscheidet welche Tools es braucht, ruft sie auf, und formuliert eine Antwort aus den Ergebnissen.

### Tool-Definitionen

```
Tool: sucheIndex
  Beschreibung: Durchsucht den Dokumentenindex nach relevanten Textstellen
  Parameter: { query: string, maxResults?: number }
  Implementierung: oramaStore.search() → Top-5 Chunks mit Score

Tool: holeVorgang
  Beschreibung: Lädt strukturierte Daten eines Bauantrags/Forschungsantrags
  Parameter: { antragId: string }
  Implementierung: IDB-Lookup → Vorgangsobjekt (Status, Fristen, Dokumente, CSV-Felder)

Tool: holeDokument
  Beschreibung: Lädt den Volltext eines spezifischen Dokuments
  Parameter: { docId: string }
  Implementierung: IDB-Lookup → Markdown-Text + Metadata

Tool: erstelleEntwurf
  Beschreibung: Generiert einen Textentwurf basierend auf Template und Kontext
  Parameter: { typ: 'nachforderung' | 'stellungnahme' | 'bescheid', vorgangId: string }
  Implementierung: Template laden → Vorgangsdaten einfügen → LLM-Vervollständigung
```

### Beispiel-Interaktionen

**Ähnliche Fälle finden:**
```
User: "Hatten wir schon mal einen Bauantrag mit Holzrahmenbau im Denkmalschutzgebiet?"
Agent: → Tool: sucheIndex("Holzrahmenbau Denkmalschutz")
       → 3 Treffer gefunden
       → Tool: holeVorgang(BA-2024-087) für Details
       → "Ja, BA-2024-087 (Schulstraße 3) war ein vergleichbarer Fall.
          Dort wurde eine Ausnahme nach §7 DSchG erteilt unter der Auflage..."
```

**Vollständigkeit prüfen:**
```
User: "Was fehlt noch bei BA-2026-032?"
Agent: → Tool: holeVorgang(BA-2026-032)
       → Prüft Pflichtdokumente: Statik ✓, Brandschutz ✓, Schallschutz ✗
       → "Für BA-2026-032 fehlt der Schallschutznachweis.
          Die Frist läuft am 15.05.2026 ab (noch 33 Tage)."
```

**Dokumente vergleichen:**
```
User: "Vergleiche die Brandschutzkonzepte von BA-2026-012 und BA-2026-032"
Agent: → Tool: holeDokument(bau-013-brandschutz-ba012)
       → Tool: holeDokument(bau-015-brandschutz-ba032)
       → "Beide Konzepte behandeln Mehrfamilienhäuser, aber BA-032 hat zusätzlich
          eine Tiefgarage. Die wesentlichen Unterschiede: ..."
```

**Entwurf generieren:**
```
User: "Schreibe eine Nachforderung für fehlende Statik bei BA-2026-044"
Agent: → Tool: holeVorgang(BA-2026-044) für Adresse, Antragsteller
       → Tool: sucheIndex("Nachforderung Statik") für ähnliche Vorlagen
       → Tool: erstelleEntwurf({ typ: 'nachforderung', vorgangId: 'BA-2026-044' })
       → Generiert Nachforderungsschreiben mit korrekten Daten
```

### Datenfluss

```
User-Query
    ↓
AI SDK 5 useChat (DirectChatTransport → llama.cpp:8081)
    ↓
LLM entscheidet: Tool Call(s) nötig?
    ↓ ja                          ↓ nein
Tool-Funktion ausführen        Direkte Antwort
(JS im Browser)
    ↓
Ergebnisse zurück an LLM
    ↓
LLM formuliert Antwort (evtl. weitere Tool Calls)
    ↓
Streaming-Antwort im Chat UI
```

Alles im Browser. Alles lokal. Der einzige "Server" ist llama-server.exe auf localhost (Power-User-Notebook) oder der zentrale L40S-Server.

---

## Hardware-Strategie: Zwei Szenarien

### Szenario A: Power-User Notebook (6 GB VRAM)

Wie heute. Nemotron Nano 4B via llama.cpp für einfache Aufgaben. Für komplexe Agent-Tasks (Multi-Step, Vergleiche): Weiterleitung an internen API-Server oder OpenRouter.

- Metadata-Extraktion: Nemotron Nano 4B (Ø 100, 5s/Dok) ✓
- Einfacher Chat: Nemotron Nano 4B — reicht für 1-2 Tool Calls ⚠️
- Komplexer Agent: Zu limitiert für 3+ Steps, Vergleiche, Schlussfolgerungen ✗

### Szenario B: Zentraler L40S-Server (2× L40S, 96 GB VRAM)

Ein Server für alle Sachbearbeiter. TeamFlow-Clients connecten per `DirectChatTransport` auf `http://ki-server:8081`.

**Empfohlene Modell-Kombination:**

| Aufgabe | Modell | VRAM | Port |
|---|---|---|---|
| Interaktiver Agent | Qwen 3.5 122B-A10B (Q4) | ~65 GB | :8081 |
| PDF-Verarbeitung & OCR | Gemma 4 31B (Q8) | ~31 GB | :8082 |
| Batch-Metadata | Nemotron Nano 4B (Q4) | ~3 GB | :8083 |

Hinweis: Nicht alle gleichzeitig laden. Qwen 3.5 122B + Gemma 4 31B = ~96 GB → voll. Entweder sequenziell (Agent-Modus vs. PDF-Modus) oder Nemotron Nano + eines der großen Modelle.

**Warum diese Modelle:**

- **Qwen 3.5 122B-A10B**: Stärkstes Open-Source Tool Calling. Schlägt GPT-5 mini bei Function Calling um 30%. 201 Sprachen inkl. exzellentem Deutsch. MoE-Architektur → nur 10B aktive Parameter → schnelle Tokens trotz 122B Gesamtgröße.
- **Gemma 4 31B**: Natives Bild-Verständnis mit OCR, Stempel-Erkennung, Dokumenten-Parsing, Handschrift. Könnte den Stempel auf gescannten PDFs direkt lesen — kein separates Tesseract nötig. #3 auf Arena AI. Apache 2.0.
- **Nemotron Nano 4B**: Bleibt für Batch-Metadata. 5s/Dok, Ø 100/100. Bewährt, kein Grund zu wechseln.

### Alternativen (kleiner, schneller)

Falls 122B zu groß oder zu langsam für interaktive Nutzung:
- **Qwen 3.5 27B Dense** (Q8, ~27 GB) — schnellere Tokens, immer noch starkes Tool Calling
- **Qwen 3.5 35B-A3B** (MoE, nur 3B aktiv) — extrem schnell, ausreichend für einfache Agent-Tasks
- **Gemma 4 26B-A4B** (MoE, nur 4B aktiv) — schneller als 31B Dense, gutes Vision

---

## PDF-Verarbeitung mit Gemma 4 Vision

### Der Stempel-Use-Case

Dokumente auf dem Fileserver haben kryptische Dateinamen. Die Bauantragsnummer steht als maschineller Stempel oben auf dem PDF. Gemma 4 kann das Bild direkt lesen:

```
Prompt: "Lies den Stempel oben auf diesem Dokument.
         Extrahiere die Bauantragsnummer im Format BA-YYYY-NNN."
Input:  Erste Seite als Bild (gerendert aus PDF)
Output: "BA-2026-032"
```

Kein OCR-Tool, kein Tesseract, kein separater Prozess. Das Modell versteht Dokumenten-Layout nativ.

### Zweistufige Verarbeitung

1. **Stufe 1: Text extrahieren** (schnell) — PDF-Textlayer lesen. Wenn Text vorhanden → Volltext direkt verwenden. Stempel per Regex suchen.
2. **Stufe 2: Vision-Fallback** (langsamer) — Wenn kein Textlayer oder Stempel nicht per Regex gefunden: Erste Seite als Bild an Gemma 4 → Stempel lesen + OCR für Volltext.

---

## Implementierungs-Stufenplan

### Stufe 1: AI SDK 5 Integration (nächster Sprint)

- `@ai-sdk/react` v5 installieren (useChat mit DirectChatTransport)
- Bestehenden `useAIBridge` Hook durch `useChat` ersetzen
- `DirectChatTransport` implementieren der auf llama.cpp oder OpenRouter zeigt
- Chat-UI auf AI SDK Streaming umstellen
- Kein Tool Calling — nur besseres Chat-Erlebnis

### Stufe 2: Tool Calling aktivieren (nach CSV-Import)

- 3-4 Tools definieren (sucheIndex, holeVorgang, holeDokument, erstelleEntwurf)
- Tool-Funktionen implementieren (sind im Wesentlichen Wrapper um bestehende Services)
- Nemotron Nano 4B Tool-Calling-Fähigkeit testen
- Falls zu unzuverlässig: Größeres Modell via API (Qwen 3.5 27B auf L40S)

### Stufe 3: PDF-Pipeline mit Gemma 4 Vision

- Gemma 4 31B auf L40S-Server deployen
- Stempel-Extraktion testen (Bild → Antragsnummer)
- OCR für gescannte PDFs via Gemma 4 Vision
- Zuordnungs-Kaskade: Stempel → Dateiname-Regex → Dokumentinhalt → Manuell

### Stufe 4: Zentraler KI-Server

- L40S-Server mit llama-server für Qwen 3.5 + Gemma 4 + Nemotron Nano
- Alle TeamFlow-Clients verbinden sich per HTTP
- Nemotron Nano bleibt auf Power-User-Notebooks als Offline-Fallback

---

## Was NICHT funktioniert / nicht nötig ist

| Technologie | Status | Warum |
|---|---|---|
| MCP (Model Context Protocol) | Nicht nötig | Tool-Definitionen direkt in AI SDK reichen. MCP braucht Server. |
| Multi-Agent (A2A) | Overkill | Ein Agent mit 4-5 Tools ist effektiver als 3 koordinierte Agents |
| Chrome Built-in AI (Prompt API) | Beobachten | Noch experimental, braucht Chrome Flags. Wenn stabil → Zero-Setup LLM |
| WebLLM | Nicht nötig | Transformers.js v4 deckt Browser-LLM ab. WebLLM wäre redundant. |
| Nemotron Browser für Agent | Geparkt | 4B zu klein für Multi-Step Tool Calling. Nur für Metadata sinnvoll. |

---

## Offene Fragen für nächste Session

1. **L40S-Server Verfügbarkeit**: Wann ist die Hardware da? Das bestimmt ob Stufe 2 mit Nemotron Nano (limitiert) oder Qwen 3.5 (voll) startet.
2. **CSV-Format**: Beispiel-CSV für den Import benötigt. Welche Felder? Welches Fachverfahren exportiert?
3. **PDF-Stempel**: Beispiel-PDF mit Stempel zeigen. Ist der Stempel ein Text-Overlay oder eingebettetes Bild?
4. **Gleichzeitige Nutzer**: Wie viele Sachbearbeiter nutzen TeamFlow gleichzeitig? Bestimmt ob ein llama-server reicht oder vLLM/SGLang für Concurrency nötig ist.
5. **AI SDK 5 Stabilität**: Aktuell v5 — Release-Status prüfen. Ist es production-ready oder noch Beta?
