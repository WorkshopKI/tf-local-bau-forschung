# Dokumente
**Zweck:** Nutzer importiert Dateien (DOCX/PDF/MD/TXT), die intern zu Markdown konvertiert und durchsuchbar abgelegt werden — mit Tags zur Organisation und Volltext-/semantischer Suche innerhalb der Liste.

**UI-Elemente & Begriffe:** Liste links (mit „Angeheftet"-Sektion, Paginierung) + Detail-Seitenpanel rechts bei Auswahl; „Öffnen" wechselt in eine Vollbild-Markdown-Ansicht. Buttons: „Importieren" (öffnet Drop-Zone für Datei-Upload). Suchfeld „Volltext + semantische Suche". Tag-Pillen als Filter (Top 10 + „weitere" aufklappbar). Pin-Icon zum Anheften. Import-Feedback als Erfolgs-/Fehlermeldung.

**Datenmodell dahinter:** IndexedDB-Store `doc:*` (`DocumentFull`: id, filename, format, tags, created, pages, vorgangId, source, conversion-Report). Angeheftete IDs in `localStorage` (`teamflow_dokumente_pinned`). Volltext-/Vektor-Index über den geteilten Such-Service (`useSearch`).

**Typische Aktionen:**
- Datei(en) per Drag&Drop oder Dialog importieren (Konvertierung zu Markdown)
- Dokument in der Liste auswählen, Metadaten/Inhalt im Seitenpanel ansehen
- Tags vergeben/ändern, nach Tag filtern
- Volltext oder semantisch nach Inhalten suchen
- Dokument anheften/lösen
- Dokument löschen

**Code:** `src/plugins/dokumente/` — Hauptdateien: `index.tsx` (Plugin-Registrierung, Liste/Panel-Layout), `store.ts` (Zustand-Store, IDB-Zugriff), `DokumenteListe.tsx` (Liste, Import, Filter), `DokumentSidePanel.tsx` / `DokumentPreview.tsx` (Detail-/Vollbildansicht).
