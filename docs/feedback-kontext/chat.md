# Chat (Assistent)

## Zweck

Nutzer stellt Fragen an einen lokalen KI-Assistenten — z. B. zu Förderanträgen, Dokumenten oder allgemein — mit optionalem Zugriff auf die Dokumenten-Archiv-Suche (RAG). Seit v2.173 kein eigener Screen mehr, sondern das andockende „Assistent"-Panel rechts in der **Suche** (Button „Assistent"); der alte Chat-Aufruf leitet dorthin um.

## UI-Elemente & Begriffe

- **Rechtes Panel** (resizebar) mit Kopf „ASSISTENT" + Verlauf-Dropdown (Unterhaltungen wählen/neu/anheften/umbenennen/löschen; angeheftete oben in eigener Gruppe) + Schließen.
- **Nachrichten-Thread + Composer:** Eingabefeld, Senden/Stoppen.
- **„+"-Werkzeuge-Menü:** Verzeichnisse wählen, Archiv-Suche ein/aus.
- **Kontext-Chip „Kontext: N Suchtreffer":** heftet die aktuellen Treffer an, entfernbar.
- **Quellen:** Quellen-Chips + nummerierte Inline-Zitate `[n]`, Quellen-Panel bei Zitat-Klick.
- **Weiteres:** Daumen-hoch/-runter-Feedback, Datei-Anhänge (PDF/DOCX/MD/TXT), „Denkprozess"-Anzeige (Reasoning).

## Typische Aktionen

- Nachricht senden, laufende Antwort stoppen, erneut generieren oder bei Fehler wiederholen
- Archiv-Suche (RAG) an/aus + Verzeichnisse als Kontext wählen
- Suchtreffer-Kontext anheften/entfernen, Quelle anklicken
- Unterhaltung wechseln/neu/anheften/umbenennen (inline)/löschen

## Technik

**Route:** `/chat` → `/suche?assistent=1` (`hideFromNav`).

**Datenmodell dahinter:** `ConversationMeta`/`ConversationFull` (Titel, FKZ-Verknüpfung, gepinnt) mit `ChatMessage[]` (Rolle, Content, Attachments, `sources: ChatSource[]`, Stats, Feedback); persistiert über `useChatStore` in IndexedDB. Suchtreffer-Kontext läuft über den `extraContext`-Pfad (nicht die FKZ-Verknüpfung).

**Code:** `plugins/chat/` — `ChatPanelHost.tsx` (Panel-Shell, in `plugins/suche/SuchSeite.tsx` eingebettet), `ChatRedirect.tsx`, `useChatController.ts` (Senden/Kontext/Transport-Fallback-Ladder: Streaming → Multi-Turn → Single-Turn), `store.ts` (Persistenz), `conversation-context.ts` (API-Message-Bau).
