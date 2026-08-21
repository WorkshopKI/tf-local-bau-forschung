# TeamFlow Local

Lokale, serverlose Web-App für kollaboratives Aufgabenmanagement mit AI-Integration. Deployment ausschließlich über File Server — User öffnet `index.html` per Doppelklick, kein Backend, keine Chrome-Flags, kein IT-Support nötig.

## Quick Start

```bash
npm install
npm run dev          # Dev-Server auf http://localhost:5173
npm run build:pl     # Single-File Build → dist-single/zah-pl.html
```

## Deployment

1. `npm run build:pl` (oder `build:dev` / `build:prod`) ausführen
2. `dist-single/index.html` auf den File Server kopieren (z.B. `\\server\TeamFlow\app\index.html`)
3. User öffnet die Datei per Doppelklick — fertig

## AI-Setup (Streamlit Bridge)

Zugang zu einem internen LLM ohne API über eine Streamlit-Chat-App im parallelen Tab.
Einrichtung in der App unter **Einstellungen → KI-Assistent → Streamlit Bridge**:

1. Streamlit Chat-App starten und ihre URL (Standard `https://gpt.vdivde-it.de/`; lokaler Test z.B. `http://localhost:8501`) eintragen, **Speichern & Aktivieren**
2. Das Bookmarklet **„TF Streamlit Bridge"** in die Lesezeichenleiste ziehen (oder **Code kopieren** → Lesezeichen manuell anlegen)
3. **Streamlit-Tab öffnen**, dort das Lesezeichen anklicken — grünes „TF Connected"-Badge erscheint
4. **Verbindung testen** → danach läuft der KI-Chat über die Bridge

Detail: [docs/architecture/ki-bridge.md](docs/architecture/ki-bridge.md).
Alternativ: llama.cpp oder Cloud API unter Einstellungen → KI-Assistent (nur Dev-Build).

## Architektur

Siehe [ARCHITECTURE.md](ARCHITECTURE.md) für die vollständige technische Dokumentation.

## Status

### Funktioniert (v0.1.0)
- Plugin-basierte App Shell mit Sidebar-Navigation
- Theme System (7 Farben, Dark/Light Mode, persistiert)
- Onboarding-Wizard (3 Steps)
- Bauanträge CRUD (Create, Read, Update, Delete) mit Zustand Store
- Dokument-Import (.docx, .md, .txt) via Web Worker
- AI Chat mit Streamlit Bridge und DirectLLM Transport
- Keyword-Suche (MiniSearch, Fuzzy, Auto-Indexierung)
- Admin: Embedding-basierte Vektorsuche (HuggingFace Transformers)
- File System Access API Integration
- Single-File Build (`file://`-kompatibel)

### Phase 2+
- Forschungsanträge Plugin
- Artefakt-Generierung (Nachforderungen, Gutachten, E-Mails)
- Vektor-basierte semantische Suche (Query-Embedding)
- Team-Sync über File Server
- Vorlagen-System
