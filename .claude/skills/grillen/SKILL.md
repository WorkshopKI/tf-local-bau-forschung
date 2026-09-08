---
name: grillen
description: Use when ein Vorhaben, Plan oder Entwurf geschärft werden soll, bevor gebaut wird — eine Feature-Bitte, ein Umbau, eine Architektur- oder Datenmodell-Frage, ein Plan vor der Freigabe; auch wenn der Nutzer „grill mich", „stell Rückfragen" oder „prüf den Plan" sagt, und als Frage-Schritt des Brainstormings.
---

# Grillen — Frontier-Interview vor dem Bauen

Ziel ist ein gemeinsames Verständnis, bevor eine Zeile entsteht. Jede Entscheidung hängt an einem **Entscheidungsbaum**; die **Frontier** sind die Fragen, die jetzt ohne Raten beantwortbar sind. Fakten holt der Agent, Entscheidungen trifft der Nutzer.

## Ablauf

### Runde 0 — Befund statt Fragen

1. Den Entscheidungsbaum „Ich will… → wo nachsehen" in [CLAUDE.md](../../../CLAUDE.md) lesen und das genannte Doc öffnen.
2. Vier Fragen aus dem Bestand beantworten — per Grep oder Explore-Agent, nie beim Nutzer: Gibt es das schon (unsichtbar, anders benannt, als Opt-in)? Ist das Gewünschte die Antwort auf das Problem? Ist es halb da und kaputt? Gibt es das Hindernis überhaupt?
3. Den Befund in höchstens acht Zeilen mit Fundstellen zeigen. Erst dann Q1.

### Runden 1 … n — die Frontier

- Alle Fragen, deren Voraussetzungen geklärt sind, kommen in **eine** Runde, nummeriert, jede mit Empfehlung:

  ```
  ❓ **Q1 – Titel**: Frage, bei Bedarf mit Optionen A/B/C.

  ➡️ Empfehlung und ein Satz Grund.
  ```

- Eine Frage, die von einer noch offenen Frage derselben Runde abhängt, gehört in die nächste Runde.
- Braucht eine Frage einen Fakt: Explore-Agent starten und die übrigen Fragen sofort stellen; nur die abhängigen warten auf den Bericht.
- Nach den Antworten den Baum aktualisieren, die Frontier neu rechnen, die nächste Runde stellen.

### Pflicht-Zweige dieses Repos (sobald das Vorhaben sie berührt)

| Zweig | Frage, die sonst untergeht |
|---|---|
| Sichtbarkeit | Welche der vier Achsen gilt: Flag · Freischaltung · Beta/Experten · `kuratorOnly`? Abnahme mit **aus**geschaltetem Beta-Schalter. |
| Persistenz | `kv`, eigener IDB-Store, Sidecar oder Snapshot — und welches Schreibprofil (idempotent, append-only, atomic)? |
| Ebene | Verbund oder Teilvorhaben? |
| Status | Kategorie-Helfer statt Rohstatus; welche Domäne (Antrag oder Feedback)? |
| Variante | dev / pl / prod — wo sichtbar, welcher Build danach? |
| Beleg | Jede Zahl trägt Einheit und Quelle und ist am echten Bestand gemessen. |
| Abnahme | `dev:local` selbst ansehen — oder `file://`-Handtest, dann benennen, was der Dev-Server nicht zeigt. |

### Glossar

- Begriffe gegen [CONTEXT.md](../../../CONTEXT.md) halten; ein Widerspruch wird sofort benannt: „CONTEXT.md sagt X, du meinst Y — welches gilt?"
- Ein aufgelöster Begriff steht noch in derselben Runde in CONTEXT.md (Begriff · Bedeutung · nicht sagen · Quelle).
- Eine schwer umkehrbare Entscheidung bekommt einen Warum-Absatz im Themen-Doc unter `docs/architecture/`; es gibt keinen ADR-Ordner.

### Ende

Frontier leer → Zusammenfassung „gemeinsames Verständnis" (Entscheidungen, Annahmen, offene Fakten) → zurück in den Rahmen: Ansätze, Design, Spec mit `## 0. Anlass` nach [docs/superpowers/README.md](../../../docs/superpowers/README.md). Gebaut wird nach der Freigabe des Nutzers, nicht aus diesem Skill heraus.

## Rote Flaggen

| Gedanke | Wirklichkeit |
|---|---|
| „Das frage ich kurz den Nutzer" (ein Fakt) | Fakten sind Agentenarbeit. Nachsehen. |
| „Eine Frage pro Nachricht ist höflicher" | Die ganze Frontier je Runde; Tiefe entsteht durch Runden, nicht durch Häppchen. |
| „Ohne Empfehlung ist die Frage neutraler" | Ohne Empfehlung antwortet der Nutzer flach. Immer empfehlen. |
| „Der Rest ist offensichtlich" | Beim Offensichtlichen laufen Bitte und Bedarf auseinander. Fragen. |
