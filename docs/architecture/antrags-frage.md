# Die Frage an die Förderantrags-Liste (Antragsplan)

Flag `sucheNatuerlicheSprache` (dev + pl) — derselbe Schalter wie in der
Dokumenten-Suche: dasselbe Verfahren, dieselbe Freischaltung.

## Warum das nicht der Frageplan ist

Der [Frageplan](suche-relevanz.md) (§8) übersetzt eine Frage in **Textnadeln**:
Leitbegriffe mit ihren Schreibweisen, mit denen über den Volltext verglichen wird.
Für die Dokumenten-Suche ist das die ganze Aufgabe.

Die Fragen an die Antragsliste sind anderer Art — sie enthalten oft **kein
einziges Textthema**:

| Frage | Achsen |
|---|---|
| „alle Einzelvorhaben (nur bei FuE und DS) aus 2025 und 2026, die noch keinen PreCheck auf Verbundebene haben" | Projektart · Jahr · PreCheck |
| „alle Anträge in Bearbeitung, die länger als 2 Monate kein neues Kürzel bekommen haben, für Bearbeiter THÜ" | Status · Stillstand · Bearbeiter |
| „alle Netzwerke, die für Phase 2 abgelehnt wurden" | `vb_phase` · Status |

Das sind **Metadaten-Kombinationen**, und für fast jede Achse hat die Seite längst
ein Bedienelement. Übernommen wurde deshalb das **Muster**, nicht das Modul.

## Die Zielsprache

`Antragsplan` ([antragsplan.ts](../../src/plugins/antraege/frage/antragsplan.ts)) ist
flach, und jedes Feld benennt **eine vorhandene Achse**:
`status` · `vbPhasen` · `jahre` · `projektart` · `precheck` · `bearbeiter` ·
`stillstandTage` · `leitbegriffe` · `ignoriert`.

Flach und **nicht** der ausdrucksstärkere `Bedingung`-Baum aus `core/status`, weil
Korrigierbarkeit hier schwerer wiegt als Ausdruckskraft: für jede Achse oben gibt
es ein Bedienelement, das den gesetzten Wert zeigt und ändern lässt. Ein
Bedingungsbaum hätte auf dieser Seite keinen Editor — der Nutzer bekäme ein
Ergebnis, das er nur neu erfragen, nicht nachjustieren kann.

`leitbegriffe` sind `PlanBegriff` aus dem Frageplan, **unverändert**. Die
Wortlaut-Stufe der Antrags-Suche nahm `planTeile` schon entgegen; es fehlte nur der
Weg dorthin (`SearchAntraegeOptions.planTeile`, v4.105).

## Die vier Regeln

1. **Die KI wählt, sie filtert nicht.** Jeder Wertevorrat wird aus der
   Einzelquelle im Code in den Prompt gerendert (`KATEGORIE_TEXTE`,
   `VB_PHASE_LABELS`, `PROJEKTART_TITEL`, `PRECHECK_BUCKET_ORDER`). Gefiltert wird
   danach deterministisch von der App.
2. **Setzen heißt ersetzen, nicht abräumen.** Ein Plan überschreibt die Achsen, die
   er **nennt**, und lässt alle anderen stehen. Räumte eine Frage nach dem
   Bearbeiter alles ab, verlöre der Nutzer stillschweigend den Statusfilter von
   zwei Klicks vorher.
3. **Was nicht wirkt, wird gesagt.** Nicht-Übersetztes steht in `ignoriert`;
   was der Bestand nicht hergibt (ein Jahr ohne Antrag, eine Kategorie ohne
   Rohwert) steht in `PlanWirkung.ohneWirkung`. Beides in der Deutungszeile.
4. **Scheitert der Lauf, ändert sich nichts.** Filter und Liste bleiben stehen —
   sie sind deterministisch entstanden und hängen an keinem Modell.

### Eine tote Kategorie wird gar nicht erst angeboten

`statusWerteZeile()` im Antragsplan führt **nur Kategorien mit Rohwerten im aktiven
Katalog**. Am eingebauten Katalog gemessen hat `abgelehnt` **null** Rohwerte — die
Ablehnungen liegen dort als `abgelehnt/zurückgezogen` unter `abgeschlossen`. Ein
Modell, dem `abgelehnt` angeboten wird, wählt es für „…die abgelehnt wurden" völlig
zu Recht, und der gesetzte Filter vergliche nichts: die Frage käme ohne diese
Einschränkung zurück.

Abgeleitet wird bei **jedem Aufruf**, nie als Modul-Konstante — der kuratierte
Katalog wird nach dem Modul-Import gesetzt (die Lehre aus `chipStatusValues`,
v2.403). Welche Kategorien belegt sind, entscheidet damit der Katalog des Teams.

Der Frageplan tut das bewusst **nicht**: dort steuert die Auswahl eine
Suchfacette (ohne Treffer = leeres Ergebnis), hier einen Feld-Wert-Filter.

## Wohin der Plan schreibt

`wendeAntragsplanAn` ([wendeAntragsplanAn.ts](../../src/plugins/antraege/frage/wendeAntragsplanAn.ts))
ist rein und bekommt die Setzer hereingereicht — wie `applyPhase`:

| Plan-Feld | Ziel |
|---|---|
| `status` | `ActiveFilter` auf `system-status`, Kategorien via `getStatusValuesByCategory` aufgelöst |
| `vbPhasen` | `ActiveFilter` auf `system-vb-phase` |
| `jahre` | Spaltenkopf-Auswahl der Spalte `antragsdatum`, zu `YYYY-MM`-Werten expandiert |
| `projektart` / `precheck` | Store-Slots (chip-frei, wie die anderen Quickfilter) |
| `bearbeiter` | Store-Slot `frageKuerzel` → `useBearbeiterSicht` |
| `stillstandTage` | Store-Slot `stillstandTage` |
| `leitbegriffe` | Store-Slot `planTeile` → `searchAntraege` |

Das Jahr läuft über den **Antragseingang** (`jahrVon` im Vorgangs-Board liest
dasselbe Feld). Weil der Spaltenkopf-Filter über konkrete Monatswerte arbeitet,
wird ein Jahr zu den im Bestand vorhandenen `YYYY-MM` expandiert; ein Jahr ohne
einen einzigen davon landet in `ohneWirkung`.

## Zwei Achsen, die es vorher nicht gab

### Stillstand

`pruefeStillstand` urteilt gegen die **Zieltage des Status**; gefragt ist eine
**freie Schwelle**. Gebraucht wird deshalb nur die letzte Aktivität je Antrag
([letzteAktivitaet.ts](../../src/plugins/antraege/frage/letzteAktivitaet.ts)) —
ohne To-dos, Wächter-Urteil und Fristprognose, die am Vorgangs-Board das Teure
waren.

- **Drei Ausgänge**: `steht` · `laeuft` · **`unpruefbar`**. Ohne datierbares Kürzel
  steht ein Antrag nicht still, er lässt sich nicht beurteilen. Der Chip im
  Seitenkopf nennt die Zahl der Unprüfbaren; sie stumm zu den Unauffälligen zu
  schlagen wäre genau die Ampel, der man später nicht mehr glaubt.
- **Journal schlägt Näherung**: `max(D_)` ist eine Untergrenze (der Nacht-Export
  überschreibt). Wo das Import-Diff-Journal etwas weiß, gilt es — `belegt` reist mit.
- **Träge + gecacht** ([useAktivitaetsIndex.ts](../../src/plugins/antraege/frage/useAktivitaetsIndex.ts)):
  der Bestandslauf startet erst mit der ersten Auswahl. Schlüssel aus Fassung +
  Bestands-Generation + Stichtag-Tag, scharf nach **gelesenen** Sätzen. Der
  Betrachtungsbereich fehlt im Schlüssel, weil der Index bereichsfrei gebaut wird.
- Auch **ohne Frage per Klick** nutzbar (Pille „Stillstand", Stufen 30/60/90/180
  Tage). Ohne Index trägt die Pille **keine** Zähler — eine Zahl, die auf einem
  fehlenden Index beruht, wäre die Zusage einer Menge, die der Klick nicht liefert.

### Kürzel-Ausschnitt aus einer Frage

Die Liste konnte bis v4.105 nur auf das **eigene** Profil-Kürzel filtern; der
Filter selbst (`applyBearbeiterFilter`) ist längst generisch, nur der Weg fehlte.
Der Slot `frageKuerzel` verdrängt das eigene Kürzel, solange er steht.

Die Prüfung sitzt in `useBearbeiterSicht` und **nicht** beim Aufrufer, damit es
dafür genau eine Regel gibt: bei fester Identität (MA-Login, prod) greift der
Ausschnitt **nicht** — dort ist er ans Passwort gebunden, und eine Frage darf ihn so
wenig aufmachen wie die „alle"-Wahl. Der Chip sagt „aus der Frage" und nimmt sie
per Klick zurück (Pitfall #46).

## Der Fragesatz ist kein Suchbegriff

Bis v4.107 lief der Feldtext im Frage-Modus **sofort** als Wortlaut-Suche mit —
und „alle Netzwerke die für Phase 2 abgelehnt wurden" trifft über Titel und
Antragsteller erwartungsgemäß nichts. Die Liste war leer, alle Pillen standen auf
„Alle", und es sah aus, als hätte die KI etwas getan. Sie war nie gefragt worden.

`wirksamerSuchtext`
([suchtext.ts](../../src/plugins/antraege/frage/suchtext.ts)) ist deshalb die
**einzige** Stelle, die entscheidet, womit gesucht wird — gelesen von der Liste
(`useFilteredAntraege`) **und** von der Hybrid-Suche
(`useAntraegeHybridSearch`). Zwei Kopien derselben Bedingung wären zwei
Gelegenheiten, sie verschieden zu ändern.

Zwei Regeln:

1. **Ungestellt heißt unwirksam.** Solange `frageGestellt` nicht wortgleich zum
   Feldtext ist, sucht nichts — dieselbe Identitätsprüfung wie
   `frageplan.frage === query.trim()` in der Dokumenten-Suche. Wer nach dem
   Übersetzen weitertippt, hat wieder eine offene Frage.
2. **Ohne Leitbegriffe bleibt der Satz draußen, auch nach einem erfolgreichen
   Lauf.** Der Normalfall ist eine Frage nach Status, Jahr und PreCheck — sie
   nennt kein Thema, `planTeile` ist leer, und die Wortlaut-Stufe hat nichts zu
   tun. Liefe der Satz trotzdem mit, käme die Liste nach einem **gelungenen**
   KI-Lauf leer zurück; ein Fehler, der doppelt schwer zu finden ist.

`frageModus` und `frageGestellt` wohnen deshalb im Antrags-Store und nicht in
einem eigenen: die Frage entscheidet mit, ob der Feldtext eine Anfrage ist, und
das müssen Liste und Suche wissen, nicht nur der Kopf.

Sichtbar wird das im Kopf: **rechts vom Feld** stehen der Umschalter und —
solange die Frage offen ist — der Knopf **„Frage stellen"**; darunter die Zeile
„Noch nicht gestellt …". Die Eingabetaste tut dasselbe wie der Knopf (beide über
`absenden`); der Knopf sagt, DASS es eine Geste braucht.

## Die Vorschlagsliste

Ein leeres Feld, das einen ganzen Satz erwartet, ist die schwerste Eingabe der
Seite: der Platzhalter zeigt **ein** Beispiel, und welche Achsen es sonst gibt,
steht nirgends. Die Liste unter dem Feld
([vorschlagsAbschnitte.ts](../../src/plugins/antraege/frage/vorschlagsAbschnitte.ts))
beantwortet deshalb nicht „was hast du zuletzt gesucht", sondern „was kann man
hier überhaupt fragen" — drei Abschnitte, **eine** Liste mit einer Auswahlmarke:

| Abschnitt | Inhalt | Auswahl |
|---|---|---|
| Zuletzt gefragt | eigener Verlauf, max. 3 | stellt die Frage |
| Beispielfragen | drei fertige, je mit den Achsen dahinter | stellt die Frage |
| Zum Ausfüllen | drei Vorlagen mit Lücken `‹…›` | setzt nur ein |

**Fertige Frage gegen halbe Frage** ist die Trennlinie, die alles trägt. Verlauf
und Beispiel waren schon einmal ein Auftrag → die Auswahl tut, was die
Eingabetaste täte. Eine Vorlage ist ein halber Satz → sie wird eingesetzt, und
der Schreibcursor landet markiert auf der ersten Lücke. Dieselbe Regel wie in
der Dokumenten-Suche, wo Verlaufs-Einträge mitfeuern und die Syntax-Beispiele
nicht.

**Die Eingabetaste hat damit drei Bedeutungen**, in dieser Reihenfolge
([useFrageVorschlaege.ts](../../src/plugins/antraege/frage/useFrageVorschlaege.ts)):
markierte Zeile wählen → in die nächste Lücke springen → fragen. Eine Vorlage mit
`‹Kürzel›` erreicht die KI nie; ein Modell, das den Platzhalter liest, dächte
sich einen Bearbeiter aus.

**Vorgeschlagen wird nur, was der Plan ausführen kann.** Jede Frage hier spricht
ausschließlich die Achsen oben an — eine Beispielfrage nach dem Ort landete
geradewegs in „nicht berücksichtigt" und lehrte das Falsche. Ein Guard im
Modul-Test hält das fest. Der Varianten-Hinweis der Vorlage kommt aus
`VB_PHASE_LABELS` ohne `IRRLAEUFER_PHASE` — abgeleitet, nicht abgeschrieben.

**Gemerkt wird erst, was übersetzt werden konnte**, nicht der Tastendruck
([frageVerlauf.ts](../../src/plugins/antraege/frage/frageVerlauf.ts)): sonst
stünden Fragen im Abschnitt „Zuletzt gefragt", die an einer fehlenden
KI-Verbindung gescheitert sind, und versprächen eine Wiederholung, die nichts
wiederholt. Der Verlauf liegt **gerätelokal** in `localStorage` und ist von dem
der Dokumenten-Suche getrennt: dort stehen Stichworte und Feldausdrücke, hier
ganze Sätze. Die Mechanik teilen sich beide über
[anfrage-verlauf.ts](../../src/core/services/search/anfrage-verlauf.ts).

## Der Lauf

`ermittleAntragsplan` ([antragsplan-lauf.ts](../../src/plugins/antraege/frage/antragsplan-lauf.ts))
führt keine eigene Transport-Logik: die sechs nicht verhandelbaren Pflichten eines
einschüssigen KI-Laufs stehen seit v4.104 **einmal** in
[ein-schuss-lauf.ts](../../src/core/services/ai/ein-schuss-lauf.ts) und werden von
dort ausgeführt — Frageplan, Frageantwort und Wortformen-Prüfung laufen ebenfalls
darüber. Vorher stand dieselbe Prosa in drei Dateien.

Ein Aufruf pro **Enter**, nie pro Tastendruck; kein Retry.

## Abgrenzung

- **Kein zweiter Filterweg.** Der Plan schreibt in die vorhandenen Slots;
  `useFilteredAntraege` bleibt in Aufbau und Reihenfolge unverändert und hat nur
  einen Schritt mehr (Stillstand, an derselben Stelle wie die übrigen abgeleiteten
  Quickfilter).
- **Keine Antwortkarte.** Anders als in der Dokumenten-Suche (§8.1) beantwortet die
  Frage hier nichts — sie filtert. Die Antwort ist die Liste.
