# TeamFlow Local

Lokale, serverlose Web-App für kollaboratives Aufgabenmanagement mit AI-Integration. Deployment ausschließlich über File Server — User öffnet `index.html` per Doppelklick, kein Backend, keine Chrome-Flags, kein IT-Support nötig.

## Quick Start

```bash
npm install
npm run dev          # Dev-Server auf http://localhost:5173
npm run build:single # Single-File Build → dist-single/index.html
```

## Deployment

1. `npm run build:single` ausführen
2. `dist-single/index.html` auf den File Server kopieren (z.B. `\\server\TeamFlow\app\index.html`)
3. User öffnet die Datei per Doppelklick — fertig

## AI-Setup (Streamlit Bridge)

1. Streamlit Chat-App unter `http://localhost:8501` starten
2. `public/bridge.js` als Bookmarklet im Browser installieren
3. Bookmarklet auf dem Streamlit-Tab klicken — grünes "TF Bridge" Badge erscheint
4. In TeamFlow Chat-Plugin Nachrichten senden

Alternativ: llama.cpp oder Cloud API unter Einstellungen > AI-Provider konfigurieren.

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
