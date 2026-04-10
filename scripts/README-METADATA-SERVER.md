# Metadata-Server fuer TeamFlow Local

## Was ist das?

Ein lokaler KI-Server der Dokument-Metadaten extrahiert.
Kein Internet noetig nach dem ersten Download.
Alle Daten bleiben auf diesem Rechner.

## Voraussetzungen

- Windows 10/11
- ~6 GB freier Festplattenspeicher (einmaliger Download)
- Optional: NVIDIA GPU mit 6+ GB VRAM (schneller, aber nicht noetig)

## Start

1. Doppelklick auf `start-metadata-server.bat`
2. Beim ersten Mal: ~6 GB werden heruntergeladen (5 Min mit schnellem Internet)
3. Server startet auf http://localhost:8081
4. Fenster offen lassen waehrend der Indexierung!

## In TeamFlow konfigurieren

1. Einstellungen > KI-Assistent
2. Provider: "llama.cpp (lokal)"
3. Endpoint: http://localhost:8081
4. Kein API Key noetig
5. Speichern

Dann unter Admin > Suchindex > Erweiterte Einstellungen:
- Metadata-Modell: "llama.cpp - Gemma 4 E4B (lokal)"

## Falls GPU nicht reicht (Fehlermeldung "out of memory")

`start-metadata-server-cpu.bat` statt der normalen Variante nutzen.
Ist langsamer, braucht aber keinen GPU-Speicher.

## Konfiguration anpassen

Datei `metadata-server-config.json` editieren:

- `context_size`: Standard 8192. Erhoehen fuer grosse Dokumente (16384, 32768)
- `gpu_layers`: Standard 99 (alle auf GPU). Auf 0 setzen fuer nur-CPU
- `threads`: Standard 4. Erhoehen auf 8 fuer CPU-Modus
- `port`: Standard 8081. Aendern falls belegt

## Server beenden

Ctrl+C im Server-Fenster, oder Fenster schliessen.
