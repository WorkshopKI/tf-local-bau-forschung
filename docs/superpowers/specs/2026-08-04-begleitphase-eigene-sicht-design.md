# Begleitphase als eigene Sicht

Stand: 2026-08-04 · Ausgangspunkt: Nutzer-Rückmeldung „Reiter *Offen 35* gegen Pille *Offen 33* ist verwirrend".

## 1. Warum

Auf der Förderanträge-Seite trägt das Wort **„Offen" zwei Bedeutungen**:

| | Bedeutung | Menge | Wo |
|---|---|---|---|
| **Sicht** „Offen" (Reiter + Sidebar-Chip) | alles, wo die Verwaltung noch etwas zu tun hat | offen · Prüfung · Nachforderung · Entscheidung · **Begleitung** | nur [views.ts:48](../../../src/plugins/antraege/views.ts) |
| **Status-Phase** „Offen" (Pille, Gruppen-Bänder, Kanban) | die Phase *vor* der Nachforderung | offen · Prüfung · Entscheidung | [statusQuickChips.ts](../../../src/plugins/antraege/filter/statusQuickChips.ts), [antragGroups.ts](../../../src/plugins/antraege/antragGroups.ts), [groupAggregates.ts](../../../src/plugins/antraege/groupAggregates.ts) |

Die zweite Bedeutung zieht sich konsistent durch die App; die Sicht ist der Ausreißer. Der Versuch aus v2.372.2, das über die Beschriftung „Status **in dieser Sicht**" zu entschärfen, erklärt den *Umfangs*-Unterschied, nicht den *Bedeutungs*-Unterschied.

**Die Umbenennung allein greift zu kurz.** Fachlich sind es zwei Lebenszyklen mit verschiedenen Uhren und teils verschiedenen Bearbeitern:

- **Antragsphase** — Antragseingang bis Bewilligung, ca. 3–9 Monate, Kürzel in `TIB_KUERZ`/`BIB_KUERZ`.
- **Begleitphase** — nach Bewilligung, während der Antragsteller das Projekt umsetzt, 3–4 Jahre, Kürzel in `ZTP_KUERZ`/`PFM_KUERZ` (teils dieselben Personen).

Eine Zahl, die eine 3–9-Monats-Uhr zu einer 3–4-Jahres-Uhr addiert, ist als Arbeitssignal unbrauchbar — unabhängig davon, wie sie heißt.

## 2. Befunde aus dem Bestand

Gemessen am 2026-08-04 in `dev:local` gegen den echten Bestand (14.221 Anträge, Katalog-Fassung 12), 0 Konsolenfehler.

### 2.1 Die Begleitphase ist 193 Anträge groß und heute unsichtbar

Der Profil-Haken „Begleitungen einschließen" (`bearbeiter_inkl_begleitung`) steht ab Werk auf **aus** und blendet die Begleitphase dann **app-weit** aus:

| | Haken aus | Haken an |
|---|---|---|
| Reiter „Alle" | 7.468 | 7.661 |
| Reiter „Offen" | 892 | 1.085 |
| Pille „Begleitung" | 0 | 193 |

Roh im Bestand 268 (VN geprüft 146 · VN techn. geprüft 53 · Widerruf 36 · Anhörung zum Widerruf 33); 193 davon liegen im Betrachtungsbereich. Gegen 892 in der Antragsphase ist das gut ein Fünftel des Arbeitsvorrats.

Der Haken **propagiert korrekt** — gelesen in Anträge-Liste, Reiter-Zählern, Home-Dashboard, Eingangs-Ampel und Vorgangs-Board. Falsch ist seine Bauform: er hat eine **Doppelwirkung** ([bearbeiterFilter.ts:24](../../../src/plugins/antraege/bearbeiterFilter.ts)) — Kürzel-Matching auf ZTP/PFM **und** globale Sichtbarkeit — und kennt daher nur „überall unsichtbar" oder „überall eingemischt". Der Zustand „getrennt sichtbar" ist nicht erreichbar.

### 2.2 15 Anträge stehen in keiner Sicht

Dieselbe Pille zählt im Reiter „Alle" **Offen 802**, im Reiter „Offen" **787**. Zwei Ursachen addieren sich:

- **Der kuratierte Katalog kennt die vorkommende Schreibweise nicht.** Fassung 12 führt Code 72 als `"stellungnahme zur rücknahmeempf."`, seine einzige Variante ist dieselbe Abkürzung. Im Bestand stehen **15× die Langform** „Stellungnahme zur Rücknahmeempfehlung" und **0×** die Abkürzung. `getStatusCategory` findet nichts, greift auf `sonstige` — diese 15 sind in keiner Sicht offen, in keiner Frist, auf keiner Startseite. Der Code-Seed ([status-codes.ts](../../../src/core/status/status-codes.ts)) führt Code 72 umgekehrt: Langform kanonisch, Abkürzung als Variante.
- **Die Pille friert ihre Wertemenge beim Modul-Laden ein.** `CHIP_VALUES` in [statusQuickChips.ts](../../../src/plugins/antraege/filter/statusQuickChips.ts) ist eine IIFE auf Modul-Ebene; sie läuft, *bevor* `setStatusKatalogSnapshotMap` den kuratierten Katalog setzt, und rechnet dauerhaft mit dem eingebauten Seed. Der kennt die Langform — deshalb zählt die Pille die 15 mit, während der Rest der App sie verliert.

Derselbe Fehlertyp wie in v2.401.x (Bug-Klasse 15, „Zähler und Filter aus zwei Vokabularen"), dritte Fassung. Die Naht verläuft diesmal nicht zwischen Groß- und Kleinschreibung, sondern zwischen **Code-Seed und kuratiertem Katalog**.

### 2.3 Der Code trennt die zwei Uhren bereits

Nur die Reiter-Ebene mischt sie:

- [views.ts:52](../../../src/plugins/antraege/views.ts) und `:66` — die Sichten „Diese Woche" und „Überfällig" schließen Begleitung **bedingungslos** aus, mit ausformulierter Begründung im Kommentar.
- [frist.ts:58](../../../src/core/services/csv/frist.ts) — `computeFristDatum` schaltet die Uhr um: Begleitung ab `vn_eingang_datum` + 6 Monate, Antragsphase ab `antragsdatum` + 90 Tage.
- [merger/helpers.ts:68](../../../src/core/services/csv/merger/helpers.ts) — dieselbe Fallunterscheidung beim Import.

Daraus folgt unmittelbar: `frist_asc` ist für **beide** neuen Sichten der richtige Sortier-Default, weil `frist_datum` je Datensatz schon die passende Frist trägt.

## 3. Entwurf

### Teil A — zwei Sichten statt einer

[views.ts](../../../src/plugins/antraege/views.ts):

- `meine_offenen` **behält seinen Schlüssel** (`activeView`, `sortByView`, `viewModeByTab` und `quickfilterExpanded` persistieren danach; die Home-Sprünge aus [MeineAntraegeSection.tsx](../../../src/plugins/home/MeineAntraegeSection.tsx) und [HomePage.tsx](../../../src/plugins/home/HomePage.tsx) zeigen darauf). Neues Label **„Antragsphase"**, Prädikat `isOpenStatus(a.status) && !isBegleitungStatus(a.status)`.
- Neuer View `begleitung`, Label **„Begleitung"**, Prädikat `isBegleitungStatus(a.status)`.
- `viewCounts` bekommt den Zähler mit; die `Record<ViewKey, …>`-Typen in [sort.ts](../../../src/plugins/antraege/sort.ts) (`DEFAULT_SORT_BY_VIEW`, `DEFAULT_GROUPING_BY_VIEW`) sind **total** — der Typecheck erzwingt die neuen Einträge. Werte: `frist_asc` (siehe 2.3) und `'none'`.
- `getSortOptionsForView`: `begleitung` bleibt außerhalb von `BEWILLIGUNG_VIEWS` — Bewilligungsdatum-Sort ergibt dort keinen Sinn.

Das Wort „Offen" verschwindet damit von der Reiter-Ebene und meint app-weit genau eine Sache. Die Reiter lesen dann **Antragsphase 907 · Begleitung 193**.

Zur Herkunft der 907: heute zeigt der Reiter „Offen" mit Haken 1.085. Davon sind 193 Begleitung, bleiben 892 — plus die **15 aus 2.2**, die mit Teil C in die Antragsphase zurückkehren. Die Endsumme 1.100 liegt also um genau diese 15 über dem heutigen Stand; „Alle" bleibt bei 7.661, weil die 15 dort längst mitzählen (nur eben als `sonstige`).

### Teil B — der Haken verliert seine Sichtbarkeits-Wirkung

Sichtbarkeit macht künftig die Sicht, nicht ein globaler Schalter. Zu streichen:

- [useFilteredAntraege.ts:140](../../../src/plugins/antraege/useFilteredAntraege.ts) — die `filterByBegleitungPhase`-Stufe.
- [views.ts:119](../../../src/plugins/antraege/views.ts) und `:157` — `if (!includeBegleitung && isBegleitungStatus(…)) continue;` in `viewCount`/`viewCounts`.
- [dashboardAggregate.ts:252](../../../src/plugins/home/dashboardAggregate.ts) — dieselbe Zeile.
- [bearbeiterFilter.ts:201](../../../src/plugins/antraege/bearbeiterFilter.ts) — `filterByBegleitungPhase` wird damit tot und entfällt samt Tests.

Unangetastet bleibt, was **Lebenszyklus** ist und nicht Schalter: `views.ts:60`/`:72`/`:165` (SLA-Sichten), [frist.ts](../../../src/core/services/csv/frist.ts), [merger/helpers.ts](../../../src/core/services/csv/merger/helpers.ts), [tableColumns.tsx:75](../../../src/plugins/antraege/tableColumns.tsx), [useVorgangsBoard.ts:200](../../../src/plugins/vorgangs-board/useVorgangsBoard.ts).

Der Haken bleibt als reine Kürzel-Frage erhalten (`spaltenFuer` matcht weiter ZTP/PFM). Sein Text in [ProfilTab.tsx](../../../src/plugins/einstellungen/ProfilTab.tsx) verliert den Sichtbarkeits-Halbsatz und benennt nur noch, was er tut.

**Sichtbare Folge für alle Nutzer:** „Alle" wächst von 7.468 auf 7.661, die Home-Zahlen entsprechend. Das ist die Absicht — der heutige Default versteckt echte Arbeit —, aber es ist keine reine Umbenennung und gehört in den Changelog für Nutzer.

### Teil C — die 15 zurückholen

**Code.** `CHIP_VALUES` wird nicht mehr eingefroren. Statt eines Caches mit Invalidierung fällt die Modul-Konstante ersatzlos weg: `chipStatusValues` leitet bei Aufruf ab, und `getPhaseItems` hebt die fünf Mengen **einmal vor** seine Datensatz-Schleife (heute steht der Aufruf in der Schleife, bei 14k Datensätzen × 5 Chips). Damit lesen Pille und Sicht wieder dieselbe Quelle, ohne dass ein zweiter Mechanismus die Gültigkeit verwalten muss.

**Daten — und warum es doch Code ist.** Die Planung hat die Wurzel eine Ebene tiefer gefunden, als dieser Abschnitt zunächst annahm. Zwei Stellen zusammen frieren die Schreibweisen ein:

- [status-codes.ts:174](../../../src/core/status/status-codes.ts) — `reichereWerteAn` steigt bei `if (w.code !== undefined) return w;` sofort aus. Ein Eintrag, der bereits einen Code trägt, bekommt seine Schreibweisen nie wieder frisch. Der Frühausstieg soll die Kuration schützen (Phase, Zieltage, Rang) — er friert die Fremddaten gleich mit ein.
- [seed.ts:72](../../../src/core/status/seed.ts) ist ihr **einziger** Aufrufer. Eine vom Daten-Share geladene Fassung wird überhaupt nie angereichert und geht ungefiltert in `setStatusKatalogSnapshot`.

Damit ist eine einmalige Datenkorrektur am Eintrag zu Code 72 die falsche Antwort: sie behöbe den Fall, nicht die Klasse, und käme beim nächsten Kurations-Schritt wieder. Richtig ist, die Zuständigkeit geradezurücken — **Schreibweisen eines codierten Werts gehören dem Code-Katalog** (Pitfall #43), die Fassung besitzt Ordner, Phase, Rang und Zieltage. Der Snapshot-Bau ergänzt sie deshalb beim Indizieren; die persistierte Fassung bleibt unangetastet (Pitfall #45).

**Vorbeugung — der Puffer hat nicht angeschlagen, und das ist erklärbar.** Der Unkuratiert-Puffer (Pitfall #40) ist in Fassung 12 **leer**: null Einträge, obwohl 15 Datensätze einen unbekannten Wert tragen. `ermittleNeueUnkuratierte` läuft beim **Import**; kuratiert wird **danach**. Verliert eine spätere Fassung eine Schreibweise, prüft sie niemand mehr gegen den Bestand. Für codierte Werte nimmt der Fix oben dieser Klasse die Grundlage — sie können keine amtliche Schreibweise mehr verlieren. Für Werte **ohne** Code bleibt die Lücke bestehen; sie ist ein eigener Vorgang, kein Teil dieser Änderung.

## 4. Tests

| Datei | Prüft |
|---|---|
| `views.test.ts` | Antragsphase und Begleitung sind **disjunkt** und ergeben zusammen `isOpenStatus`; `viewCounts` stimmt je Sicht mit `viewCount` überein; die SLA-Sichten enthalten weiterhin keine Begleitung. |
| `phaseQuickfilter.test.ts` *(vorhanden, erweitern)* | Die Invariante Zähler = Filter gilt **auch mit gesetztem Katalog-Snapshot** — der Test setzt einen Snapshot, der von der eingebauten Map abweicht, und schlägt ohne den `CHIP_VALUES`-Fix fehl. |
| `statusCanonical.test.ts` *(vorhanden, erweitern)* | Rundlauf: für jede Kategorie `c` und jeden Wert `v ∈ getStatusValuesByCategory(c)` gilt `getStatusCategory(v) === c` — mit **und** ohne Snapshot. |
| `bearbeiterFilter.test.ts` | Die Begleitphasen-Tests entfallen mit `filterByBegleitungPhase`; die Kürzel-Tests zu ZTP/PFM bleiben unverändert. |
| `dashboardCounts.test.ts` | Home zählt Begleitung unabhängig vom Profil-Haken. |

Schlägt ein neuer Test nur im Suite-Lauf fehl, einzeln aber grün: Datei in `ISOLATED_TESTS` (`vitest.config.mts`) aufnehmen, nie den Test verbiegen.

## 5. Abnahme

`npm run check:quick` nach jedem Teilschritt, `npm run check` vor dem Commit. Danach selbst ansehen in `dev:local` (Pflicht, [CLAUDE.md](../../../CLAUDE.md) „Abnahme"):

1. Reiter lesen: **Antragsphase 907 · Begleitung 193**; „Alle" zeigt 7.661.
2. In beiden neuen Reitern die Pillen gegenrechnen — Pillen-Summe = Reiter-Zahl = gerenderte Zeilenzahl.
3. Pille „Offen" muss in **jedem** Reiter dieselbe Zahl nennen (heute 802 gegen 787). Die beiden Teilschritte von C sind dabei einzeln zu messen, weil sie in verschiedene Richtungen ziehen: nach dem `CHIP_VALUES`-Fix allein zeigen beide Reiter **787** (die Pille liest jetzt den Katalog und verliert die 15 wie alle anderen), nach der Katalog-Ergänzung beide **802**. Nur der Zwischenstand belegt, dass der Code-Fix wirkt und nicht die Datenkorrektur ihn verdeckt.
4. Profil-Haken an/aus: die Sichtbarkeit darf sich **nicht** mehr ändern, nur der Kürzel-Zuschnitt bei gesetztem eigenen Kürzel.
5. Sortierung in „Begleitung": die Frist stammt aus `vn_eingang_datum` + 6 Monate — an einem Datensatz gegenprüfen.
6. `window.__tf.fehler()` muss `0` sein.

Beim Nutzer bleibt nichts — die Änderung ist vollständig im Dev-Server prüfbar.

## 6. Bewusst nicht

- **Die Status-Phase „Offen" umbenennen.** Sie ist die amtliche Phasen-Sprache und steht zusätzlich in Gruppen-Bändern, Kanban-Lanes und `groupAggregates`. Die Sicht ist der Ausreißer, nicht die Phase.
- **Die Definitionen angleichen** (Reiter zählt wie die Pille). Nachforderungen fielen dann aus dem Arbeitsvorrat — fachlich falsch.
- **„In Arbeit" als Name.** Vergeben: so heißt das Sektions-Band im „Alle"-Reiter ([arbeitsvorrat.ts](../../../src/plugins/antraege/arbeitsvorrat.ts)), und es meint etwas anderes — dort zählt „bewilligt" mit.
- **Den Haken ganz entfernen.** Das Kürzel-Matching auf ZTP/PFM ist eine eigene, berechtigte Frage; fest eingeschaltet bliese es den persönlichen Arbeitsvorrat auf.
