# Feedback-Kuration (aufgelöst — leitet aufs Feedback-Board um)

## Zweck

Diese Seite existiert seit v2.364 nur noch als Weiterleitung für alte Lesezeichen. Das frühere Kurator-Dashboard „Kuration → Feedback" (5 Reiter: Tickets, Inbox, FAQ, Sponsoring, Einstellungen) ist vollständig im **Feedback-Board** aufgegangen — es gibt jetzt EINE Feedback-Oberfläche. Wer die alte Adresse aufruft, landet direkt auf dem Board; im Menü erscheint der Eintrag nicht mehr.

## UI-Elemente & Begriffe

- Keine eigenen — sofortige Weiterleitung, kein sichtbarer Bildschirm.
- Was der Nutzer stattdessen sieht, steht in der Hilfe des Feedback-Boards: den ausklappbaren Abschnitt **„Verwaltung"** am geöffneten Ticket (Status, Kategorie, Priorität, Aufwand, interne Notizen, öffentliche Antwort, FAQ-Markierung, Claude-Code-Prompt, Löschen) und das **Zahnrad** im Seitenkopf, das die vier ticket-freien Aufgaben öffnet (Inbox, FAQ, Sponsoring, Einstellungen).

## Typische Aktionen

- Keine. Meldet ein Nutzer Feedback „von dieser Seite", meint er praktisch immer das Feedback-Board.

## Technik

**Route:** `/kuration/feedback` → `/feedback-board` (`hideFromNav`).

**Datenmodell dahinter:** unverändert `FeedbackItem` in der geteilten `_intern/feedback/feedback.json`; die Bedienelemente sind nur umgezogen, nicht die Daten.

**Code:** `plugins/feedback/index.ts` + `FeedbackKurationRedirect.tsx`. Die abgelösten Bausteine leben in `components/feedback/FeedbackVerwaltungBlock.tsx` und `plugins/feedback-board/verwaltung/`.
