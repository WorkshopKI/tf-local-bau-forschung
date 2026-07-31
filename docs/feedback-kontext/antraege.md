# Förderanträge

**Zweck:** Zentrale Arbeitsseite für Förderanträge — suchen/filtern, bearbeiten, Status/Dokumente verwalten.

**UI-Elemente & Begriffe:**
- **Liste links:** sortier-/gruppierbar. Bei offenem Detail schrumpft sie zur **Kompakt-Spalte** und lässt sich ganz einklappen (**Fokus-Modus**: alle Listen-Werkzeuge weg, Titel + „Aufnehmen" bleiben). Je Ordner des Fachsystems ist in der Tabelle eine Statusspalte einblendbar.
- **FKZ** `16KN######` / `16EP######`: beim Überfahren einer Zeile erscheint rechts vom FKZ ein **Kopier-Icon** (Verbund-Zeile: das Verbund-FKZ).
- **Filter:** als drittes Panel.
- **Detail rechts:** Kopf (Titel + Meta + Stepper, rechts „Antrag-Aufbereitung öffnen"), klappbare **Kurzbeschreibung** (offen), Gutachten-Werkstatt, dann — eingeklappt — „Antragsdaten" (Fakten + Verbundpartner/Teilvorhaben), Artefakt-Werkbank, „Alle Felder", „Historie".
  - **„Status & Verlauf":** Phase; **Chronik** der Termine oder **Zeitstrahl**, „Warum dieser Status?", **Statuseinträge** nach den Ordnern des Fachsystems, vorgefiltert auf die eigene Rolle.
  - **„Fristen & Meilensteine":** Prognose + Restzeit.
  - **Offenes Teilvorhaben:** Felder, Netzwerk, Dokumente.

**Gutachten-Werkstatt (wenn aktiv):**
- **„Dokumente des Verbundes"** (oben): Typ + Umfang je Datei, maßgebliche **Vorhabensbeschreibung** markiert; weitere per „ins Gutachten aufnehmen".
- **Noch nicht generierter Abschnitt:** „{Abschnitt} generieren" + **Persönlicher Stil**.
- **Abschnitts-Karte**, vier Ebenen:
  - **Kopf:** Titel, Entwurf/Freigegeben, Version, „Formuliert · Feinschliff", ggf. „Standard-KI (Fallback)", ⋯-Menü (Feinschliff/Vorfassungen/Verwerfen).
  - **Text:** satzweise markierbar.
  - **Werkzeugzeile:** Neu/Kürzer/Länger · **Persönlicher Stil** · Bearbeiten · **Kopier-Icon** ⧉ neben Bearbeiten · QS prüfen · „Freigeben und weiter" mit QS-Badge. Freigegeben: Erneut öffnen · QS prüfen · Kopieren · Stil.
  - **Fußzeile:** Sätze/Wörter/Regeln/Skill, verwendete KI „Standard-KI"/„Agentische KI" + 👍/👎.
- **Am Text:** **Abschnitts-QS** („n von m Kriterien ok") + **Regelprüfung** (Messwert/Limit + KI-Korrektur). Generieren hängt den **Feinschliff** an.
- **Rechts „Quelle & KI-Hinweise"** (eingeklappt): **Beleg-Karten** (Klick → Satz), Abdeckung, Denkprozess.
- **Offline:** Bearbeiten/Prüfen ja, KI aus.

**Typische Aktionen:**
- Antrag suchen/filtern, Verbund öffnen, Teilvorhaben wechseln
- Dokumente hochladen + Gutachten-Kontext wählen
- Abschnitt erzeugen, per KI korrigieren, QS prüfen
- Vom Befund zum Satz springen

## Technik

**Datenmodell dahinter:** `useAntraegeStore` (CSV-Schema `Antrag`/`Verbund`/`AntragListItem`), Hybrid-Suche (`useAntraegeHybridSearch`, Orama BM25+Vector), Filter-State, Feld-Historie, Dokument-Tags (`kv`).

**Code:** `src/plugins/antraege/` — `AntraegePage.tsx`, `AntraegeTable.tsx`, `VerbundDetail.tsx`, `store.ts`, `filter/`; Werkstatt in `gutachten/`. Kompakt-Spalte = `KompaktListe`, Teilvorhaben-Block = `TvDetailBlock`, Abschnitts-Karte = `SectionReviewCard`, Dokumente des Verbundes = `KorpusInventar`, Quellen-Panel = `KontextPanel`.
