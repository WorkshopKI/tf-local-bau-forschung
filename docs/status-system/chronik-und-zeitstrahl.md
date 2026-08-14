# Chronik & Zeitstrahl — die Verlaufs-Ansichten am Verbund

Die Sektion „Status & Verlauf" der Verbund-Detailseite beantwortet **eine**
Leitfrage: *wer (PA / AB / FB / QS / Jur) hat was (Kürzel) in welchem
Teilvorhaben gemacht* — auf einem Bildschirm, statt im Fachsystem den Verbund
und danach jedes Teilvorhaben einzeln aufzurufen.

Alle Ansichten lesen **dieselben Termine aus den Datumsfeldern**. Es gibt keine
zweite Quelle und keine Ableitung: der Status kommt aus dem Export (Pitfall #44).

## Die drei Ansichten

| Ansicht | Ordnung | Bauteil |
|---|---|---|
| **Chronik · nach Schritt** (Standard) | eine Zeile je Kürzel, eine Spalte je Träger | [StatusSchrittMatrix.tsx](../../src/plugins/antraege/status/StatusSchrittMatrix.tsx) |
| **Chronik · nach Datum** | chronologisch, Monat in der linken Rinne | [StatusChronik.tsx](../../src/plugins/antraege/status/StatusChronik.tsx) |
| **Zeitstrahl** | waagerechte Bahn je Verbund/TV | [VerlaufsBand.tsx](../../src/plugins/antraege/verlauf-band/VerlaufsBand.tsx) |

Gerechnet wird rein und node-testbar in `src/core/status/`:
[chronik.ts](../../src/core/status/chronik.ts) (Termine),
[chronik-matrix.ts](../../src/core/status/chronik-matrix.ts) (Matrix),
[verlauf-filter.ts](../../src/core/status/verlauf-filter.ts) (Auswahl),
[verlauf-kennzahlen.ts](../../src/core/status/verlauf-kennzahlen.ts) (Kopfzeile).

## Drei Regeln, die der Entwurf nicht hergibt

Der Design-Handoff (`_design/handoff/chronik`) arbeitet mit erfundenen Daten. An
drei Stellen weichen die echten davon ab — und das entschied den Bau.

### 1. Verbund-Ebene und TV-Ebene werden nie zusammengezogen

Der Entwurf zeigt eine Zeile `AAE` mit **Verbund-Datum und** TV-Daten. Die gibt
es nicht. `AAE` ist ein kanonisches **TV**-Feld
([seed-kanonisch.ts](../../src/core/status/seed-kanonisch.ts)); sein
Verbund-Gegenstück ist ein eigener Code — `XTE` „alle Anträge eingegangen".
`KANONISCHE_CODE_FELDER` verbietet ausdrücklich, dass zwei Katalog-Einträge auf
derselben Spalte stehen, und eine Paarung Verbund↔TV existiert nirgends als
Daten (`KUERZEL_PAARE` paart AB gegen FB, nicht Ebene gegen Ebene).

Also: **eine Zeile je Katalog-Feld.** Ein Verbund-Feld füllt nur die
Verbund-Spalte, ein TV-Feld nur die TV-Spalten. Geroutet wird nach `tvIds`
(dem Beleg), nicht nach `feld.ebene` (der Zuschreibung).

Am echten Bestand (ZKN084412, 7 Teilvorhaben) liest sich das besser als der
Entwurf:

```
AAE  Antragseingang            –          17.12.  17.12.  22.12.  21.12.  30.12.  04.01.  04.01.   18 T
XTE  alle Anträge eingegangen  04.01.21   –       –       –       –       –       –       –        –
```

Die einzelnen Anträge kamen über 18 Tage verteilt; am 04.01. war der Verbund
vollzählig. Eine zusammengezogene Zeile hätte genau das verschwiegen.

### 2. Neutrale Einträge werden abgeblendet, nie gefiltert

Im Entwurf trägt jede Zeile genau eine Rolle. Im Katalog sind **144 von 505
Codes neutral** — „jeder darf setzen" ([rollen.ts](../../src/core/status/rollen.ts)).
Sie einer Rollenwahl zu opfern nähme gut ein Viertel des Verlaufs weg und
behauptete dabei, sie gehörten jemand anderem.

`rollenSicht()` kennt deshalb drei Ausgänge: `voll`, `gedimmt` (neutral — bleibt
stehen, ohne Tönung und ohne Marke), `weg` (fremde Rolle — verlässt die Liste).
Der Zeitstrahl kennt kein `weg` (`sichtFuerBahn`): eine Liste darf kürzer
werden, eine Bahn verlöre ihre Form.

Gemessen an ZKN084412 unter „Wer = QS": 91 Schritte → 44; davon 25 mit
QS-Marke, **19 neutral und abgeblendet** (67 der 350 Datumsangaben). Die
Filterleiste sagt diese Zahl an, sonst läse sich das Abblenden als Fehler.

### 3. Fünf Rollen, nicht vier

Der Entwurf faltet die Juristen in die QS. Der Katalog trennt sie (QS 100 Codes,
Jur 22), und die Chronik schreibt seit jeher „Jur". Also fünf Chips und fünf
Tönungen.

## Rollenfarbe

Eine der wenigen Stellen, an denen Farbe Information trägt (DESIGN_GUIDE Regel 1;
Präzedenz ist die Kompetenz-Matrix). Dieselbe Codierung in Filterleiste,
Chronik-Zeile, Matrix-Zelle und — später — im Zeitstrahl-Balken. **Die
Filterleiste ist damit die Legende**; eine zweite gibt es nicht.

- Namen: [rollen-farbe.ts](../../src/core/status/rollen-farbe.ts) — die einzige Zuordnung.
- Werte: [theme.css](../../src/theme.css), `--tf-rolle-{pa,ab,fb,qs,jur}[-bg|-bar]`, Hell + Dunkel.
- Guard `rollen-farbe-eine-quelle` ([conventions-ui.test.ts](../../src/__tests__/conventions-ui.test.ts))
  hält beides fest **und misst den Kontrast nach**: jede Schriftfarbe muss auf
  ihrer eigenen Fläche ≥ 4,5:1 erreichen, in beiden Modi. Die Werte des Entwurfs
  lagen bei fünf von zehn Kombinationen darunter (hell PA 4,31; dunkel PA 4,04 /
  AB 4,11 / FB 4,42 / QS 4,02) — bei 10,5-px-Marken keine Feinheit.

## Zustand: was bleibt, was flüchtig ist

| Was | Wo | Warum |
|---|---|---|
| Ansicht (Chronik/Zeitstrahl), Modus (Schritt/Datum), „Nebensächliches" | [timelinePrefs.ts](../../src/plugins/antraege/status/timelinePrefs.ts) — IndexedDB, gerätelokal | eine Gewohnheit |
| Wer, Wo, „nur nicht gesetzt", Fokus | [useVerlaufFilter.ts](../../src/plugins/antraege/status/useVerlaufFilter.ts) — `useState` | eine Aussage über **diesen** Verbund; mitgeschleppt wäre sie ein untergeschobener Filter |

Klickregel der Auswahl-Chips (`schalteAuswahl`): **erster Klick isoliert**,
weitere addieren, die Abwahl des letzten fällt auf „alle" zurück — man soll sich
nicht in einen leeren Bildschirm klicken können.

Der **Fokus** überlebt den Moduswechsel: in der Matrix eine Streuung sehen, nach
Datum nachlesen, wann sie entstand. `Esc` hebt ihn auf.

## Zwei Wirte, ein Bauteil

Die chronologische Ansicht rendert an zwei Stellen — auf der Detailseite und im
Tabellen-Ausklapp ([VorgangsverlaufReiter](../../src/plugins/antraege/ausklapp/vorgangsverlauf/VorgangsverlaufReiter.tsx)).

Der **Ausklapp bekommt weder Matrix noch Filterleiste**: acht Datumsspalten
passen nicht in eine aufgeklappte Tabellenzeile, und auf einer TV-Zeile hätte die
Matrix genau eine Spalte. Er erbt die Marken, die Knotenzustände und die
Kennzahlen-Zeile. Gemessen wird trotzdem dort — er ist der engere Wirt.

Weil er die Teilvorhaben des Verbunds nicht kennt, tragen seine Träger-Marken die
**Endung des Aktenzeichens** (`…426`) statt einer Nummer. Eine dort selbst
vergebene „TV 2" wäre die Nummer dieser Liste, nicht die des Verbunds.

## Knotenzustände (nur „nach Datum")

| Knoten | Bedeutung | Quelle |
|---|---|---|
| 10 px gefüllt, Akzent, 3-px-Halo · Text Medium | **Meilenstein** | `prominenzDefault`, kuratierbar im Cockpit |
| 7 px gefüllt grau | **Regelfall** | `prominenzDefault` |
| 6 px hohl mit Rand · Text eine Stufe leiser | **Nachrichtenkanal** | `prominenzDefault: 'nebensaechlich'` |
| 9 px hohl, roter Rand, rot getönt · kein Datum | **Kürzel nicht gesetzt** | [`offenePaareJeTeilvorhaben`](../../src/core/status/waechter.ts) |

`ignoriert` erscheint nirgends — erfasst wird es trotzdem.

Die Legende steht im Fuß **dieser** Ansicht; die Matrix trägt dieselbe
Gewichtung ohne Punkte (Meilenstein-Kürzel akzentfarbig, Ereignis in Medium).

## Kennzahlen

„**N Schritte · M Datumsangaben** (Verbund + k TV) · Zeitraum · **j Kürzel nicht
gesetzt**". Schritte sind verschiedene Felder, Datumsangaben die befüllten
Zellen darüber — vier Teilvorhaben mit demselben Eingang sind ein Schritt und
vier Angaben. Ist gefiltert, steht der Nenner dabei („8 von 57").

Lücken zählen **nicht** in die Datumsangaben: eine fehlende Seite ist kein
Termin. Sie stehen daneben und sind klickbar.

## Offen

- **Zeitstrahl-Umbau** — Kürzel-Zeile über der Bahn, Balkenfarbe nach Rolle,
  ausgeschriebene Beschriftungszeile. Er zeigt heute die aus der
  C16-Trigger-Tabelle abgeleitete Phase; ihn nach Rolle einzufärben ändert, was
  das Bild behauptet. Bis dahin steht die Filterleiste **nur** über der Chronik
  — ein Bedienelement ohne Wirkung wäre ein gebrochenes Versprechen.
- **Export** („Verlauf kopieren", „Als XLSX") — im Entwurf angelegt, Zielformat
  offen (Matrix oder Ereignisliste).
