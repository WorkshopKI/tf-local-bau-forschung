# Chronik & Zeitstrahl — die Verlaufs-Ansichten am Verbund

Die Sektion „Status & Verlauf" der Verbund-Detailseite beantwortet **eine**
Leitfrage: *wer (PA / AB / FB / QS / Jur) hat was (Kürzel) in welchem
Teilvorhaben gemacht* — auf einem Bildschirm, statt im Fachsystem den Verbund
und danach jedes Teilvorhaben einzeln aufzurufen.

Alle Ansichten lesen **dieselben Termine aus den Datumsfeldern**. Der Status
kommt aus dem Export und wird nicht abgeleitet (Pitfall #44).

Seit v4.58 hat die Chronik **nach Datum** eine zweite Quelle, und nur sie: das
Import-Diff-Journal für Termine, die ein früherer Export trug und der heutige
nicht mehr ([→ Zurückgenommene Termine](#zurückgenommene-termine)). Auch das ist
keine Ableitung — es ist belegte Vergangenheit.

## Die drei Ansichten

| Ansicht | Ordnung | Bauteil |
|---|---|---|
| **Chronik · nach Datum** (Standard) | chronologisch, Monat in der linken Rinne | [StatusChronik.tsx](../../src/plugins/antraege/status/StatusChronik.tsx) |
| **Chronik · nach Phase** | eine Zeile je Kürzel, eine Spalte je Träger; Phase in der linken Rinne | [StatusSchrittMatrix.tsx](../../src/plugins/antraege/status/StatusSchrittMatrix.tsx) |
| **Zeitstrahl** | waagerechte Bahn je Verbund/TV | [VerlaufsBand.tsx](../../src/plugins/antraege/verlauf-band/VerlaufsBand.tsx) (rahmt) + [BandBahn.tsx](../../src/plugins/antraege/verlauf-band/BandBahn.tsx) (zeichnet) |

Der Standard ist seit v4.61 **nach Datum**. Er war bis dahin die Matrix, und
damit öffneten die beiden Wirte desselben Vorgangs zwei verschiedene Bilder: der
Tabellen-Ausklapp zeigt ausschließlich die chronologische Ansicht. Ein geänderter
Default allein hätte niemanden erreicht, der die Sektion je benutzt hat —
`mutiere` schreibt das ganze Objekt, also trägt jeder gespeicherte Stand ein
explizites `modus`. Das Feld `modusGewaehlt` unterscheidet deshalb den Klick auf
den Schalter von der bloßen Mitschrift ([timelinePrefs.ts](../../src/plugins/antraege/status/timelinePrefs.ts));
ein Key-Bump hätte `ansicht` und „Nebensächliches" mit zurückgesetzt. Der
Standard steht seit v6.5 auch **links** im Umschalter — er ist der Normalfall,
nicht die Alternative.

Der Reiter heißt „nach Phase", der gespeicherte Wert dahinter `schritt`: die
Ansicht führt eine Zeile je Schritt, gegliedert nach Phase, und die Gliederung
ist es, die in der Rinne steht. Den Wert mitzubenennen hieße, jede gespeicherte
Wahl zu migrieren, ohne dass ein Nutzer davon etwas sähe — dieselbe Begründung
wie bei `band`/„Zeitstrahl".

### Ein Maß für beide Ordnungen

Wer umschaltet, will eine andere Ordnung sehen, nicht ein anderes Bild. Rinne,
Kürzel, Rolle und Ereignistext stehen deshalb in beiden Ansichten an denselben
x-Positionen (gemessen 482 / 633 / 687 / 771 px), die Zeilen sind 22 px hoch, und
getrennt wird nur am Gruppenwechsel — dort der Monat, hier die Phase. Beim
Umschalten tauscht nur die rechte Hälfte: Träger-Spalten mit Datum statt Datum
plus Träger-Marken.

Die Maße liegen **einmal** in
[verlaufGeometrie.ts](../../src/plugins/antraege/status/verlaufGeometrie.ts); bis
v6.5 standen sie doppelt (Tailwind-Klassen in der Chronik, px-Konstanten in der
Matrix) und waren längst auseinandergelaufen — 84 gegen 104 in der Rinne, 46
gegen 54 beim Kürzel, und der Ereignistext sprang um gut 100 px. Weil Tailwind
Klassennamen als Literale liest (`w-[${TAG_PX}px]` erzeugt kein CSS), steht jedes
Maß dort zwangsläufig zweimal — als Zahl und im Klassennamen; ein Test hält die
beiden zusammen. Drei Eigenheiten der Matrix folgen daraus: `border-separate`
(nur so liegt die Achsenlinie innerhalb ihrer `<col>`-Breite), Zellen **ohne**
waagerechtes Polster (sonst ist die `<col>`-Breite nicht mehr die ganze
Wahrheit), und eine leere zweite Spalte, die den Platz der Tagesspalte hält.

**Beide Ordnungen beschriften ihre Spalten**, mit denselben Wörtern an denselben
x-Positionen: `Monat` bzw. `Phase` in der Rinne, dann `Kürzel`, `Wer`, `Ereignis`
— die Matrix schließt mit ihren Träger-Spalten und `Spanne`, die Chronik mit
einem rechtsbündigen `Wo` über den Träger-Marken (dasselbe Wort, mit dem die
Filterleiste darüber ihre Träger-Chips überschreibt). Zwei davon erklären sich
nicht von selbst: `Kürzel` und `Wer`. Die Phasenmarke der Chronik bleibt
unbeschriftet — sie nennt ihre Phase selbst, und ein Kopf über einer Marke, die
nicht in jeder Zeile steht, benennte keine Spalte.

Der Kopf ist der Grund, aus dem `verlaufGeometrie.ts` die **Breiten getrennt von
der Schrift** führt (`TAG_BREITE` neben `TAG_SPALTE`): er braucht die Breite
seiner Spalte, nicht deren dicktengleiche Schrift — und zwei Schriftgrößen im
selben Klassen-String entscheidet nicht die Reihenfolge im String, sondern die im
erzeugten CSS. In der Chronik trägt er die Achsenlinie mit, weil deren 1 px in
der Rechnung steckt; der erste Monatsblock verliert dafür seine Trennlinie, sonst
stünden zwei Linien übereinander.

Die Phasen-Beschriftung steht per `rowSpan` über der **ganzen** Gruppe
(`phasenGruppen`, löst `phasenRinne` ab). Sonst bestimmt ein langes Label die
Höhe einer einzelnen Zeile: „Marker (ohne Phase)" bricht in der 84 px schmalen
Rinne dreifach um und machte aus 22 px gemessene 66 px. In der Rinne selbst steht
dafür „Marker" — der volle Wortlaut im Titel.

Gerechnet wird rein und node-testbar in `src/core/status/`:
[chronik.ts](../../src/core/status/chronik.ts) (Termine),
[chronik-matrix.ts](../../src/core/status/chronik-matrix.ts) (Matrix),
[verlauf-filter.ts](../../src/core/status/verlauf-filter.ts) (Auswahl),
[verlauf-kennzahlen.ts](../../src/core/status/verlauf-kennzahlen.ts) (Kopfzeile).
Für den Zeitstrahl zusätzlich in `src/plugins/antraege/verlauf-band/`:
[bandGeometrie.ts](../../src/plugins/antraege/verlauf-band/bandGeometrie.ts) (Achse),
[bandTermine.ts](../../src/plugins/antraege/verlauf-band/bandTermine.ts) (Marken),
[bandBeschriftung.ts](../../src/plugins/antraege/verlauf-band/bandBeschriftung.ts) (Etage).

## Vier Regeln, die der Entwurf nicht hergibt

Der Design-Handoff (`_design/handoff/chronik`) arbeitet mit erfundenen Daten. An
vier Stellen weichen die echten davon ab — und das entschied den Bau.

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

### 4. „Wer setzt" hat zwei Quellen — es gilt die Fassung

Die Rollenspalte steht an **zwei** Stellen: in der geladenen Katalogfassung
(`StatusFeldEintrag.rollen`, gelesen über `rollenVonFeld`) und in der
Kürzel-Zuarbeit (`kuerzelAuskunft`). Sie widersprechen sich messbar: an
ZKN084412 nannte die Zuarbeit **37 Termine „Juristen", die Fassung keinen
einzigen**.

Bis v4.50 fiel das nicht auf, weil nur die Verlaufsableitung die Zuarbeit las und
niemand ihre Rollen anzeigte. Mit den getönten Marken über der Bahn wäre daraus
ein sichtbarer Widerspruch geworden: eine Marke in Jur-Violett, die die
Filterleiste daneben nicht anbietet. Also liest **`baueUebergaenge` die Rollen
aus der Fassung** — dieselbe Quelle wie Chronik, Matrix, Filterleiste und
Aufgaben-Kaskade.

Die Zuarbeit wird nur noch für **eine** Unterscheidung befragt, die die Fassung
nicht führt: ob ein leeres Rollenfeld „jeder darf setzen" heißt (`neutral`) oder
„wir kennen dieses Kürzel gar nicht" (`unbekannt`) — Pitfall #43. Welche der
beiden Quellen fachlich recht hat, entscheidet die Kuration im Kürzel-Tab; bis
dahin spricht die App mit einer Stimme statt mit zwei.

## Rollenfarbe

Eine der wenigen Stellen, an denen Farbe Information trägt (DESIGN_GUIDE Regel 1;
Präzedenz ist die Kompetenz-Matrix). Dieselbe Codierung in Filterleiste,
Chronik-Zeile, Matrix-Zelle und Zeitstrahl-Marke. **Die Filterleiste ist damit
die Legende**; eine zweite gibt es nicht — und weil sie das ist, darf keine
Ansicht eine Rolle zeigen, die sie nicht anbietet (Regel 4 oben).

- Namen: [rollen-farbe.ts](../../src/core/status/rollen-farbe.ts) — die einzige Zuordnung.
- Werte: [theme.css](../../src/theme.css), `--tf-rolle-{pa,ab,fb,qs,jur}[-bg]`, Hell + Dunkel.
- Guard `rollen-farbe-eine-quelle` ([conventions-ui.test.ts](../../src/__tests__/conventions-ui.test.ts))
  hält beides fest **und misst den Kontrast nach**: jede Schriftfarbe muss auf
  ihrer eigenen Fläche ≥ 4,5:1 erreichen, in beiden Modi. Die Werte des Entwurfs
  lagen bei fünf von zehn Kombinationen darunter (hell PA 4,31; dunkel PA 4,04 /
  AB 4,11 / FB 4,42 / QS 4,02) — bei 10,5-px-Marken keine Feinheit.

### Wie breit eine Marke sein darf

Rollen- und Träger-Marken teilen **ein** Maß ([VerlaufBadges.tsx](../../src/plugins/antraege/status/VerlaufBadges.tsx)):
17 px hoch, 3 px Polster, 3 px Abstand — gemessen 17–20 px je Rollenmarke, 25 px
für `TV1`. Die Schrift steht auf `--tf-text-secondary` über `--tf-bg-secondary`
(gemessen 5,0:1 hell, 6,3:1 dunkel); der **Rand** trägt `--tf-border-hover`, weil
0,08 Alpha die Fläche verschwinden ließ und die Marke sich als loser grauer Text
las.

### Und warum die Chips der Leiste eckig sind

Die Leiste **ist** die Legende — also trägt ihr Chip die Form des Zeichens, das
er erklärt: eckig (6 px), nicht als Pille. `ToggleChip` hat dafür die Form
`form="marke"` (häkchenlos, enger, Rand `--tf-border-hover`); die Pillen-Form
bleibt das Filter-Idiom des Rests der App. Ohne Haken trägt die Tönung den
Zustand allein, die Schriftstärke bleibt darum in beiden Zuständen 500 — sonst
wanderte die Zeile beim Klick (DESIGN_GUIDE Kap. 5 / Pitfall #14).

Die Träger-Chips nennen zusätzlich die **Endung des Aktenzeichens**
(„TV 1 …426"): die laufende Nummer ordnet, aber zitieren lässt sie sich nicht —
im Fachsystem heißt das Teilvorhaben `16KN084426`.

Die Rollenspalte ist auf **drei** Marken bemessen (76 px; gemessen belegt sie im
Bestand höchstens 67,5). 31 der 506 Codes tragen drei Rollen, genau einer vier
(`IP`, „Kenntnisnahme von Insolvenz des Partners" — AB/FB/QS/Jur). Eine Spalte
für diesen einen zu bemessen kostete auf jeder Zeile jedes Vorgangs Breite; ihn
überlaufen zu lassen schob die Marken in den Ereignistext (v4.48.0, korrigiert in
v4.48.1). Darum fällt der Rest zu „+n" zusammen, dessen Titel alle Rollen nennt —
dieselbe Mechanik wie bei den Träger-Marken.

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

## Zwei Wirte, ein Bauteil — eine Bildsprache, zwei Tiefen

Die chronologische Ansicht rendert an zwei Stellen — auf der Detailseite und im
Tabellen-Ausklapp ([VorgangsverlaufReiter](../../src/plugins/antraege/ausklapp/vorgangsverlauf/VorgangsverlaufReiter.tsx)).
Sie fragen Verschiedenes: in der Tabelle *was ist gerade los*, auf der
Detailseite *was ist alles passiert*. Der **Zeilenbau ist deshalb identisch**,
der **Umfang nicht**.

Der **Ausklapp bekommt weder Matrix noch Filterleiste**: acht Datumsspalten
passen nicht in eine aufgeklappte Tabellenzeile, und auf einer TV-Zeile hätte die
Matrix genau eine Spalte. Auch kein Fokus — er verbindet Matrix, Chronik und
Zeitstrahl, und hier gibt es keine zweite Sicht, mit der er sich teilen ließe. Er
erbt die Marken, die Knotenzustände, die Kennzahlen-Zeile und die
zurückgenommenen Termine samt Nullpunkt. Gemessen wird trotzdem dort — er ist der
engere Wirt.

### Das Fenster: die jüngsten acht

Bis v4.60 stand die Chronik auch dort **ungekürzt**, mit der Begründung, ein
Kasten mit zehn von 22 Terminen lese sich als der ganze Verlauf. Die Begründung
stimmt, die Folgerung nicht: Median 22 und p90 32 Zeilen sind 500–700 px, die
sich zwischen Kopfkarte und Fristblock in eine Tabellenzeile schieben — wer eine
Zeile aufklappt, bekam den vollen Aktenvorgang.

Gekürzt wird jetzt, aber **ansagbar**: `juengsteZeilen` schneidet auf die acht
jüngsten Zeilen, ein Schalter darüber nennt die Zahl der älteren („24 ältere
Einträge zeigen"). Fünf Entscheidungen daran:

1. **Geschnitten wird die gemischte Liste**, nicht die Termine allein — ein
   zurückgenommener Termin ist eine Zeile wie jede andere.
2. **Vor der Monatsgruppierung**, damit Rinne und „N Monate ohne Termin" den
   sichtbaren Ausschnitt beschreiben und nicht einen, den es nicht gibt.
3. **Der Schalter steht oben.** Die Liste läuft aufsteigend; das Fenster zeigt
   ihr Ende, das Fehlende liegt darüber.
4. **Die Kennzahlen bleiben ungefenstert.** Sie sagen die Größe des *Vorgangs*
   an, nicht die der Darstellung — genau das macht den Ausschnitt lesbar.
5. **Eine Lücke ohne sichtbaren Monat entfällt** (der Rückfall „ohne Bezug"):
   unter einem Ausschnitt, der sie nicht erklärt, wäre sie ein Rätsel. Gezählt
   wird sie weiter — in Rot, in der Kennzahlen-Zeile darüber.

Die Detailseite bekommt **kein** Fenster: dort ist die Chronik das Ziel des
Klicks, nicht die Begleitung einer Tabelle.

Sein Journal kommt aus [useZeilenVerlauf](../../src/plugins/antraege/ausklapp/useZeilenVerlauf.ts),
das seit v4.58 die Chroniken **aller** Teilvorhaben der Zeile lädt statt nur der
einen — eine Verbund-Zeile trägt schließlich alle. Was davon in die
Verlaufsableitung geht, entscheidet weiter die Ein-TV-Regel; und die belegte
letzte Änderung bleibt an sie gebunden, sonst erbt der Stillstands-Wächter die
Beobachtung eines Nachbarn (Guard `kein-nullpunkt-als-letzte-aenderung`).

Seine Träger-Marken lesen `TV 1 … TV n` und „alle N" wie auf der Detailseite. Die
Karte kommt aus `tvAchse` ([chronik-matrix.ts](../../src/core/status/chronik-matrix.ts)),
gebaut über die Teilvorhaben des **ganzen Verbunds** — auch auf einer TV-Zeile,
die nur eines davon trägt. Sonst hieße „TV 1" hier das erste dieser Liste und
dort das erste des Vorhabens. Bis v4.60 stand hier die **Endung des
Aktenzeichens** (`…426`), weil der Ausklapp den Verbund angeblich nicht kannte;
seit `useZeilenVerlauf` an `useStatusVerlauf(verbundId)` hängt, kennt er ihn. Die
Endung bleibt als Rückfall, wo kein Verbund geladen ist — selbst zu nummerieren
wäre die Nummer dieser Liste. Guard: `chronik-zwei-wirte-ein-vokabular`
([conventions-status.test.ts](../../src/__tests__/conventions-status.test.ts)).

Der Reiter mit der Bahn heißt in beiden Wirten **„Zeitstrahl"** (bis v4.60 im
Ausklapp „Zeitverlauf"); es ist dasselbe `VerlaufsBand`. Der gespeicherte Wert
dahinter bleibt `zeitverlauf` — dieselbe Regel wie bei `band` oben.

## Knotenzustände (nur „nach Datum")

| Knoten | Bedeutung | Quelle |
|---|---|---|
| 10 px gefüllt, Akzent, 3-px-Halo · Text Medium | **Meilenstein** | `prominenzDefault`, kuratierbar im Cockpit |
| 7 px gefüllt grau | **Regelfall** | `prominenzDefault` |
| 6 px hohl mit Rand · Text eine Stufe leiser | **Nachrichtenkanal** | `prominenzDefault: 'nebensaechlich'` |
| 9 px hohl, roter Rand, rot getönt · kein Datum | **Kürzel nicht gesetzt** | [`offenePaareJeTeilvorhaben`](../../src/core/status/waechter.ts) |
| 8 px hohl, **gestrichelter** grauer Rand · Bezeichnung durchgestrichen | **zurückgenommen / verschoben** | [`baueZurueckgenommene`](../../src/core/status/chronik-zurueckgenommen.ts) |

`ignoriert` erscheint nirgends — erfasst wird es trotzdem.

## Zurückgenommene Termine

Nimmt jemand in C16 eine Setzung zurück oder korrigiert ihr Datum, überschreibt
der Nacht-Export die Spalte — und die alte Zeile ist spurlos weg. Am Verbund
ZKN125417 gemessen: `D_ART` (Rücknahmeempfehlung) wurde geleert und durch
`D_ABLT` (Ablehnung) ersetzt, `D_AL` wanderte vom 03.08. auf den 11.08. Nach dem
Import vom 15.08. war von beidem nichts mehr zu sehen — obwohl das Journal es
seit dem 14.08. festhielt (`geleert` / `geaendert`, [vorgangssystem.md §12.3](../architecture/vorgangssystem.md)).

Die Chronik zeigt beides jetzt **an seinem alten Tag**, durchgestrichen:

```
11.08.  ABLT  FB   Ablehnung tech. erstellt/…                                    TV2 TV3
11.08.  ART   FB   R̶ü̶c̶k̶n̶a̶h̶m̶e̶e̶m̶p̶f̶e̶h̶l̶u̶n̶g̶ ̶t̶e̶c̶h̶n̶.̶ · zurückgenommen zwischen 12.08. und 14.08.  TV2 TV3
03.08.  AL         N̶a̶c̶h̶l̶i̶e̶f̶e̶r̶u̶n̶g̶ ̶E̶i̶n̶g̶a̶n̶g̶ · verschoben auf 11.08.2026                       TV4
```

Sechs Entscheidungen, die der naive Bau anders getroffen hätte:

1. **Ein Datum, das der Export nicht mehr zeigt** — das ist die Klasse, nicht
   „storniert". `geleert` und `geaendert` fallen beide darunter; ein verschobener
   Termin ist an seiner alten Stelle genauso verschwunden wie ein gelöschter.
2. **Der Tag ist der alte Wert, nicht der Nachtlauf.** Der Nachtlauf beantwortet
   „wann haben wir es gemerkt"; auf die Achse gehört „wann stand es da". Die
   Merk-Angabe steht als Spanne im Text (`unscharf`, §12.3).
3. **Durchgestrichen wird nur die Bezeichnung.** Tag und Kürzel bleiben lesbar —
   genau mit ihnen findet man den Vorgang in C16 wieder.
4. **Der Ring ist grau-gestrichelt, nicht rot.** Rot trägt hier schon eine
   Bedeutung („Kürzel nicht gesetzt" = offene Aufgabe). Eine Rücknahme ist
   erledigt, kein Auftrag.
5. **Über Träger gefaltet.** `D_ART` stand auf TV2 und TV3; ungefaltet stünden
   zwei identische Zeilen. Dieselbe Regel wie bei den Terminen (Regel 1 oben) —
   nur folgt sie hier aus dem Journal, das je **Antrag** geführt wird.
6. **Zählt nicht als Datumsangabe.** Die Kennzahl steht daneben („· 2
   zurückgenommen"), wie „N Kürzel nicht gesetzt": die Zahl, die den Umfang der
   Chronik nennt, darf nicht durch Abwesendes wachsen.

**Der Nullpunkt steht darunter**, immer und in drei unterschiedenen Fassungen
([JournalNullpunkt.tsx](../../src/plugins/antraege/status/JournalNullpunkt.tsx) ·
Wortlaut in [journalTexte.ts](../../src/plugins/antraege/status/journalTexte.ts),
geteilt mit der Historie-Sektion): kein Journal auf dem Share · Vorgang außerhalb
des Betrachtungsbereichs · belegt ab TT.MM.JJJJ. Ohne ihn liest sich eine Chronik
ohne durchgestrichene Zeilen als „hier wurde nie etwas zurückgenommen" — und das
ist bei einem Journal, das erst am 05.08.2026 beginnt, meistens falsch.

**Matrix und Zeitstrahl bleiben außen vor.** Die Matrix hätte für ein gelöschtes
Datum keine Zelle (ihre Spalten sind Träger, ihre Zeilen Felder — ein
zurückgenommener Termin belegt dieselbe Zelle wie sein Nachfolger), und die Bahn
fällt schon heute auf 18 von 78 Terminen zurück. Beide zeigen weiterhin den
Export-Stand.

**Der Ladepfad ist geteilt**: `stand.json` wiegt über 5 MB und ist bewusst nicht
gecacht. [useJournalChroniken.ts](../../src/plugins/antraege/status/useJournalChroniken.ts)
liest einmal je Seite; Chronik, Historie-Sektion und der Ausklapp hängen daran.

Die Legende steht im Fuß **dieser** Ansicht; die Matrix trägt dieselbe
Gewichtung ohne Punkte (Meilenstein-Kürzel akzentfarbig, Ereignis in Medium).
Sie trägt seit v6.6 auch die **Kante**: trägt das Profil eine eigene Rolle, steht
dort ein sechster Eintrag `Ihre Rolle (FB)`. Bis dahin erklärte sich die Kante in
einer eigenen Zeile über der Liste — auf der Detailseite die fünfte Zeile vor dem
ersten Termin, für eine Auskunft, die man einmal liest.

## Kennzahlen

Schritte sind verschiedene Felder, Datumsangaben die befüllten Zellen darüber —
vier Teilvorhaben mit demselben Eingang sind ein Schritt und vier Angaben. Ist
gefiltert, steht der Nenner dabei („8 von 57").

Weder Lücken noch Zurückgenommenes zählen **in** die Datumsangaben: eine fehlende
Seite ist kein Termin, und ein zurückgenommener stand einmal in einer Spalte,
steht aber nicht mehr darin. Beide stehen daneben; die Lücken sind klickbar.

**Ein Bauteil, drei Schnitte** (v6.5,
[VerlaufKennzahlenZeile.tsx](../../src/plugins/antraege/status/VerlaufKennzahlenZeile.tsx)).
Bis dahin stand alles in einer eigenen Zeile unter der Überschrift; sie nannte
Zahlen, die eine Zeile tiefer ohnehin an den Filter-Chips standen.

| Schnitt | Segmente | Wirt |
|---|---|---|
| `alles` (Default) | alle | Tabellen-Ausklapp |
| `umfang` | Schritte · Datumsangaben · (Verbund + k TV) | das ⓘ neben dem Status |
| `ohneUmfang` | Zeitraum · z zurückgenommen · j fehlende Kürzel-Angaben | die Titelzeile |

Drei Wirte, aber **ein** Wortlaut: wären es drei Bauteile, gäbe es drei Fassungen
von „(Verbund + 3 TV)" und „8 von 57". Das Trennzeichen `·` gehört zwischen zwei
Segmente, nicht an eines — fest angeschrieben stünde es im Schnitt `ohneUmfang`
als führendes Zeichen da.

Der Rest steht in der **Titelzeile** und damit außerhalb des einklappbaren
Rumpfs: auch zugeklappt sagt die Zeile, über welchen Zeitraum der Vorgang läuft
und ob Kürzel fehlen. Der Klick auf „j fehlende Kürzel-Angaben" klappt dann
zuerst auf und setzt danach den Filter — ein Filter, dessen Wirkung man nicht
sieht, wäre ein gebrochenes Versprechen (dieselbe Regel, aus der die Lücken-Achse
im Zeitstrahl ganz entfällt).

Die Zahl der Schritte entfällt in der Titelzeile ganz: die WO-Chips darunter
tragen dieselbe Auskunft, seit der „Alle"-Chip seine Zahl hat. Er war der einzige
seiner Reihe ohne, und die Reihe rechnete sichtbar nicht auf — jetzt ist er die
Summe seiner Nachbarn (`Alle 39` = `5 + 12 + 12 + 10`), gegen die Rollenwahl
gerechnet und ohne die Bereichswahl, genau wie sie.

## Der Zeitstrahl: drei Etagen je Bahn

| Etage | Was | Datei |
|---|---|---|
| oben | **Termin-Marken**: jedes gesetzte Kürzel, getönt in der Farbe seiner Rolle | [bandTermine.ts](../../src/plugins/antraege/verlauf-band/bandTermine.ts) |
| Mitte | **Balken** mit Statusabschnitt, Grenzstrich (Konfidenz), Abschlussstreifen | [BandBahn.tsx](../../src/plugins/antraege/verlauf-band/BandBahn.tsx) |
| unten | **Klartext**: fehlende Gegenstücke (rot), Termine ohne Phase, überlange Abschnittsnamen, Dauern | [bandBeschriftung.ts](../../src/plugins/antraege/verlauf-band/bandBeschriftung.ts) |

Links daneben steht die **Rollenbilanz** der Bahn (`AB 24 · FB 22 · QS 30`) — wer
an diesem Teilvorhaben gearbeitet hat, in einer Zeile. Sie zählt Termine je Bahn,
die Chips der Leiste zählen Datumsangaben des Verbunds; beide nach derselben
Regel (`rollenBilanz`/`rollenZaehler`), aber mit verschiedenem Nenner — eine
Verbund-Spalte steht auf **jeder** TV-Bahn und wird dort auch gezählt.

### Die Rolle sitzt am Termin, nicht auf der Fläche

Der Entwurf färbt den **Balken** nach Rolle. Das trägt an unseren Daten nicht:

- **PA ist Neutralgrau** — und „neutral" (144 der 505 Codes) wäre auf einer
  Fläche derselbe Ton. Zwei Auskünfte, ein Bild.
- **Ein Kürzel trägt bis zu vier Rollen** (`IP`). Eine Marke löst das mit „+n",
  eine Füllung kann es nicht.
- **Der Balken nennt seinen Status als Text in sich.** Eine Fläche, die etwas
  anderes codiert als ihre eigene Beschriftung, widerspricht sich.

Also: Fläche = Status (wie bisher), Rollenfarbe an Marke und Klartext. Der
Meilenstein wirkt dort über die **Schriftstärke**, nicht über die Akzentfarbe wie
in der Matrix — der Farbkanal ist schon vergeben.

### Was die Etage zeigt, und was nicht

Die Rangfolge der Klartext-Zeile ist die Entscheidung: Warnung → Lücke →
fokussierter Termin → übrige Termine → Abschnittsnamen → Dauern. Termine stehen
**vor** den Abschnittsnamen, weil ein Abschnittsname im Balken, im Tooltip und in
der Legende steht — der Klartext eines Termins nirgends sonst.

Gemessen an ZKN084412 (TV 2, **78 Termine** in der Bahn): 18 Marken tragen 22
Termine, 3 bekommen den vollen Klartext. Das ist kein Mangel, sondern die
Auskunft: was nicht ohne Überlappung passt, entfällt — ein gekürztes Kürzel wäre
ein anderes Kürzel. Eine zweite Etage brächte etwa drei Texte mehr und kostete
16 px auf jeder Bahn; die Beschriftungen sind 300 px lang, nicht die Zeile ist zu
kurz. Kurzbezeichnungen je Kürzel (Handoff §9.3) wären der Hebel — die gibt es
noch nicht, und sie zu erfinden hieße Fremddaten zu ersetzen.

### Filter und Fokus

- **Wer blendet ab** (`sichtFuerBahn`): Marken und Klartext verlieren Tönung,
  die Balken bleiben unangetastet. Der Entwurf leert dort zusätzlich die Balken
  (Screenshot 08); ein Balken ohne seinen Status ist aber kein Kontext mehr.
- **Wo blendet Bahnen aus**, und **die Achse bleibt**: gemessen sitzt jede
  gemeinsame Marke bei „alle" und bei „nur TV 3" auf demselben Pixel. Ohne diese
  Zusage wäre der geteilte Fokus wertlos.
- **Fokus**: Marken des Feldes bekommen einen Akzentring, ihr Klartext wird vor
  allen anderen gesetzt. `Esc` hebt auf.
- **„Nebensächliches" bleibt der Chronik.** `baueUebergaenge` baut seine Termine
  fest ohne diese Kürzel; die Bahn kennt sie gar nicht. Der Schalter verschwindet
  deshalb im Zeitstrahl, und eine Zeile darunter sagt, wie viele fehlen.

Die Achse deckt **genau eine** Kante mehr als früher: den frühesten Termin, falls
er vor dem ersten Statuswechsel liegt (`FOY` vor `AAE`). Jeden Termin zur Kante
zu machen blähte die Bahn auf über 2000 px Scrollbreite — `bodenFuer` gibt jedem
Intervall ein Mindestmaß. Termine **nach** dem Bezugszeitpunkt bekommen keine
Marke: geklemmt behaupteten sie ein Datum, das sie nicht haben.

## Offen

- **Export** („Als XLSX") — im Entwurf angelegt, Zielformat offen (Matrix oder
  Ereignisliste). „Verlauf kopieren" gibt es am Zeitstrahl schon, der Chronik
  fehlt es.
- **`heute`-Linie**: nötig, sobald die Achse über den Bezugszeitpunkt hinaus
  reichen soll (siehe Termine nach dem Stichtag).
- **Kurzbezeichnungen je Kürzel** — der Hebel für die Klartext-Zeile.
