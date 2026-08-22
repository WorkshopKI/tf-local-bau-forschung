# Suche: Trefferstellen, Relevanz, Faltung

Wie ein Suchtreffer zu seiner Bewertung kommt — und warum die Suche vorher
keine hatte. Gilt für die Suchseite (`src/plugins/suche/`) und die Stufen
dahinter (`src/core/hooks/useUnifiedSearch.ts`).

## 1 Der Ausgangspunkt: ein Score ohne Varianz

Bis v4.5 setzte die Wortlaut-Stufe ihren Score fest auf `1.0`. Da die
Ähnlichkeitssuche opt-in ist und jede Sitzung auf AUS startet und der
Dokumentenindex auf vielen Rechnern leer ist, war der Normalfall: **alle Treffer
hatten exakt denselben Score**. Die Spalte zeigte eine Reihe „1.00", und die
Standard-Sortierung „nach Score" lieferte in Wahrheit die Reihenfolge des
IDB-Cursors.

Das ist die Wurzel von drei Symptomen, die wie Designfragen aussahen: keine
Sortierung, keine Relevanzangabe, keine Erklärung, warum ein Treffer kam.

## 2 Trefferstellen — der Beleg

Der Antrags-Korpus hält die suchbaren Felder ohnehin getrennt
([search-corpus.ts](../../src/plugins/antraege/services/search-corpus.ts)):
Titel (VB + TV), Kurzbeschreibung, Deskriptoren, Akronym, Aktenzeichen,
Organisation, Standort, Web-Adresse — seit v4.50 Netzwerk, Arbeitsnotiz und
Wahlkreis, seit v4.53 das Verbundkennzeichen. Die Feld-Zuordnung war also nie
eine Rechnung, sondern nur eine Information, die niemand mitgeführt hat.

**Woher der Korpus seine Felder nimmt (v4.42.0).** Unter welchem Schlüssel eine
CSV-Spalte im Antrags-Record landet, entscheidet das Wizard-Mapping —
`canonical ?? custom ?? spalte.toLowerCase()`. Der Korpus hat diese Schlüssel bis
v4.41 **geraten**, und am echten Bestand lag `VB_INHALT` unter
`inhalt_kurzzusammenfassung` statt unter `vb_inhalt`: die gesamte
Projektbeschreibung fehlte im Suchindex, bei einer Quelle, die 14 084 der 14 097
FKZ abdeckt. Nichts wurde rot — die Suche sah nur aus wie ein dünner Bestand
(recurring-bug-classes Klasse 5). Dasselbe traf `ORG_AST`, das je Quelle unter
drei verschiedenen Schlüsseln liegt.

Die Zuordnung kommt deshalb aus
[korpusFeldAufloesung.ts](../../src/plugins/antraege/services/korpusFeldAufloesung.ts):
aufgelöst über den Spalten-**CODE** (`VB_INHALT`, `ORG_AST`, …) per
`resolveFieldKey`, gleiches Muster wie `resolveFbStatusFelder`. Die alten
Alias-Listen bleiben als Fallback, damit ein Programm ohne passendes Schema nicht
schlechter sucht als vorher. Die Reihenfolge der Slots ist dabei die
Kollisions-Regel: eine Quelle mappt `ORG_AST` auf denselben Schlüssel wie das
kanonische `ORG_AFS`, und wer beide Slots darauf zeigen ließe, verlöre die 2,5 %
der Sätze mit abweichender Rechtsperson.

`substringMatches` arbeitet deshalb in **zwei Durchgängen**
([antraege-search-service.ts](../../src/plugins/antraege/services/antraege-search-service.ts)):

| Durchgang | Was | Kosten |
|---|---|---|
| 1 — Match | Oder-Kette über alle Felder, bricht beim ersten Treffer ab | unverändert ~10–30 ms über 14 000 Einträge |
| 2 — `feldZuordnung` | prüft alle Felder, NUR für bestätigte Treffer | vernachlässigbar (Treffermenge ≪ Bestand) |

Der Kurzschluss im ersten Durchgang ist der Grund für die Laufzeit; ihn
aufzugeben, um nebenbei Felder zu sammeln, hätte die Suche spürbar verlangsamt.

### Wo der Beleg im Ergebnis steht (v4.23)

Ein Etikett „Ort" sagt, DASS im Ort getroffen wurde — nicht WAS dort steht. Am
echten Bestand gemessen: „Dresden" im Ortsbereich lieferte 485
Treffer, und in der Liste war das Suchwort bei **4 von 30** sichtbaren Zeilen
markiert — bei denen, wo die Stadt zufällig im Firmennamen vorkam.

Die Ursache ist keine Lücke im Layout, sondern eine im Datenfluss: sechs der
vierzehn Trefferstellen haben längst einen Platz im Ergebnis, acht nicht.

| Trefferstelle | steht im Ergebnis als |
|---|---|
| `titel`, `kurzbeschreibung` | Spalte „Titel / Inhalt" (fest eingeblendet) |
| `akronym`, `organisation` | Snippet derselben Spalte (`makeAntragSnippet`) |
| `aktenzeichen` | Spalte „FKZ" |
| `dokument` | Dateiname bzw. gefaltete Textstelle |
| `aehnlichkeit` | Spalten „Suche" / „Relevanz" |
| **`standort`** | **Spalte „Ort"** — wird eingeblendet |
| **`bundesland`** | **Spalte „Bundesland"** — wird eingeblendet |
| **`deskriptoren`** | **Spalte „Deskriptoren"** — wird eingeblendet |
| **`domain`** | **Spalte „Web-Adresse"** — wird eingeblendet |
| **`netzwerk`** | **Spalte „Netzwerk"** — wird eingeblendet |
| **`wahlkreis`** | **Spalte „Wahlkreis"** — wird eingeblendet |
| **`notiz`** | **Spalte „Notiz"** — wird eingeblendet |
| **`verbundkennzeichen`** | **Spalte „Verbund-Nr."** — wird eingeblendet |

[autoSpalten.ts](../../src/plugins/suche/autoSpalten.ts) führt diese acht — und
nur diese acht. Eine weitere Zeile braucht den Nachweis, dass der Beleg wirklich
nirgends sonst auftaucht; sonst verbreitert sich die Tabelle für nichts.

Für `domain` ist der Nachweis geführt: die Web-Adresse steht in keiner anderen
Spalte und in keinem Snippet. Sie ist sogar der schärfere Fall — bei einem
Domain-Treffer steht das Suchwort in **keinem** sichtbaren Feld der Zeile.

**Zwei Auslöser.** Die Einstellung: „nur Ort, Bundesland & Wahlkreis" blendet die
Ortsspalte immer ein, auch wenn eine Anfrage nichts findet. Die Fundstelle: im
Standardbereich erscheint sie, sobald **ein** Treffer den Beleg trägt — das ist
der Normalfall, denn kaum jemand stellt das Dropdown um. Der Wahlkreis hängt
allein am zweiten Auslöser: er gehört zu demselben Bereich, ist dort aber die
seltenere Fundstelle, und zwei Dauerspalten für eine Wahl wären eine zu viel.

**Die Spalten gehören der Anfrage, nicht der Person.** Sie kommen über
`erzwungeneKeys` des geteilten [ColumnPicker](../../src/components/data-table/ColumnPicker.tsx)
dazu (angehakt, deaktiviert, Marke „auto", im Zähler mitgezählt) und schreiben
**nichts** in die gespeicherte Spaltenwahl. Verschwindet der Grund, verschwindet
die Spalte.

**Warum nicht die vorhandene Spalte „Ort AST".** Gesucht wird gegen
`AntragTextEntry.standort` = Ort-AFS + Ort-AST. Bei abweichendem Ausführungsort
(1 052 von 14 224 Sätzen) stünde in einer `ort_ast`-Zelle ein Wert **ohne**
Markierung — eine Erklärung, die keine ist. „Ort AST" bleibt daneben die
CSV-Spalte für Sortieren, Filtern und Export; die neue Spalte ist der Beleg.
Dieselbe Unterscheidung wie bei `antragsteller` (= ORG_AFS) in v4.4.3.

Das Feld trägt seinen Trenner deshalb schon im Korpus (`verbindeMit(' · ', …)`).
Die **Suchform ist davon unberührt**: `standortSuchform` ersetzt jede
Nicht-Buchstaben-Folge durch Leerraum, „Dresden · Sachsen" und „Dresden Sachsen"
sind danach dieselbe Zeichenkette (Test in `korpusFelder.test.ts`).

In der **Liste** zeigt derselbe Baustein (`belegWerte`) den Wert in der
Fundstellen-Zeile; das Etikett entfällt dort, weil der Wert es ersetzt. Nach dem
Umbau: 30 von 30 Zeilen markiert, Zeilenhöhe 111 px → 82 px.

### Die Web-Adresse (v4.42.0)

Gemeldet war: „der Antragsteller GMBU wird nicht gefunden, obwohl er da ist."

Am Bestand nachgemessen stimmte beides — er ist da, und er ist nicht zu finden.
Die Einrichtung steht in **jedem** Organisationsfeld ausgeschrieben
(„Gesellschaft zur Förderung von Medizin-, Bio- und Umwelt- Technologien e.V.");
die Zeichenfolge „GMBU" kommt im ganzen Bestand in **keinem** Antragstellerfeld
vor. Sie steht nur in Projektbeschreibungen, Bemerkungen — und in
`@gmbu.de`.

Das ist kein Einzelfall mit Regel-Charakter, sondern eine Lücke in den Daten:
**244** Einrichtungen führen ihr Kürzel im Namen („… e.V. (IUTA)") und sind
darüber längst auffindbar. Wer es nicht tut, war unerreichbar.

Deshalb leitet der Korpus aus der Kontakt-Mail der Projektleitung (`EMAIL_PL`)
den **Host** ab — `bergmann@gmbu.de` → `gmbu.de`. Drei Regeln:

- **Nur der Host, nie die Adresse.** Der lokale Teil ist eine Personenangabe und
  gehört in kein Suchfeld.
- **Ohne Top-Level-Domain in der Suchform** (` gmbu `), sonst träfe die Anfrage
  „de" jeden Antrag — dieselbe Falle wie beim zweibuchstabigen Bundesland-Kürzel.
- **Sperrliste.** Die Quelldatei führt in `TIB_MAIL`/`BIB_MAIL`/`ZTP_MAIL`/
  `PFM_MAIL` die Adressen des **Projektträgers**: `vdivde-it.de` steht 26 933 mal
  darin, `filina-it.de` 3 367 mal. Als Suchwort wären sie ein Treffer auf alles.
  Die Auflösung über den Spalten-CODE schließt diese Spalten strukturell aus, die
  Liste ist das zweite Netz — plus Freemailer, die keine Einrichtung benennen.

Verglichen wird **am Wortanfang**, wie beim Standort: Kürzel sind kurz und
stecken ineinander. Trennzeichen bleiben Wortgrenzen, damit `tu-chemnitz.de` auch
auf „chemnitz" anspricht.

**Reichweite:** `EMAIL_PL` führt nur die Bewilligungs-Quelle — **8 024 von
14 097** FKZ. Anträge ohne Bewilligungssatz bleiben über die Domain unerreichbar.

### Netzwerk, Arbeitsnotiz, Wahlkreis (v4.50.0)

Gefragt war: „können wir weitere Felder aus den Roh-CSVs dazunehmen, solche mit
sinnvollem Text?" Die Antwort kam aus einer Messung über alle drei aktiven
Quellen (512 Spalten, 14 225 FKZ) — nicht danach, welche Spalte viel Text hat,
sondern danach, welcher Text **nirgendwo sonst durchsuchbar** ist.

| Spalte | Schlüssel im Store | Deckung | Zugewinn |
|---|---|---|---|
| `NETZWERKNA` | `netzwerk` · `netzwerk_kurzname_fkz_ztp` | 11 492 (81 %) | 556 Namen stehen in keinem Titel — plus das Netz-Kennzeichen |
| `T_YW` / `T_HINT` | `wichtig` / `bemerkung` | 3 343 / 3 161 | steht in **keinem** anderen Feld |
| `WKNAAK_AFS` | `wahlkreisname_afs` | 14 218 (100 %) | 5 274 Wahlkreisnamen nennen einen Ort, den das Standortfeld nicht führt |
| `NACE_LANG` | `nace_code_beschreibung…` | 2 256 (16 %) | 1 512 Branchentexte fehlen in den Deskriptoren |

Vier Entscheidungen dahinter:

- **Das Netz-Kennzeichen ist der eigentliche Gewinn.** Die Angabe lautet
  `"LOHCmobil" 16KN065602_AM` — Name UND Kennzeichen des Netzwerks. Über das
  Kennzeichen findet man erstmals alle Teilvorhaben EINES Netzwerks auf einmal;
  vorher fand dieselbe Anfrage nur den Netzwerkantrag selbst. Der Name allein
  hätte den Aufwand nicht getragen: in 10 925 von 11 492 Fällen steht er ohnehin
  im Titel.
- **Beide Notizspalten sind EIN Suchfeld.** Der Suchende fragt „steht das
  irgendwo in meinen Notizen", nicht „steht das in `T_YW` oder in `T_HINT`". Die
  Auflösung hält sie trotzdem getrennt — sonst fände der zweite Slot den Wert des
  ersten und eine der beiden Spalten wäre still verschwunden.
- **Der Wahlkreis gehört zum „wo".** Deshalb steht er im Ortsbereich und deshalb
  nennt ihn dessen Beschriftung. Verglichen wird **am Wortanfang** wie beim
  Standort: es sind Ortsnamen, und die stecken ineinander.
- **NACE bekommt kein eigenes Feld.** Der Branchentext beantwortet dieselbe Frage
  wie die Deskriptoren, nur feiner — er hängt sich dort an. Ein eigenes Etikett
  in der Trefferzeile wäre eine Unterscheidung, die dem Suchenden nichts sagt.

**Was NICHT dazukam** und warum: die Straße (`STR_AST`, 100 % gefüllt) — sie
holte über Namen wie „Berliner Str." Fehltreffer in fremde Städte; `ATTR_TEXT`
(„KMU", 99,5 %) und `NAT_ZUORD` — ein Vokabular aus ~30 Werten ist eine Facette,
kein Suchfeld; die Anrede `BRANR_PL` („Sehr geehrter Herr …") — Personenangabe
ohne Sachaussage. `ALTAKZ` wäre interessant (der alte Vorgangscode), ist im
Import aber ausdrücklich auf „ignorieren" gesetzt und bräuchte erst eine
Mapping-Änderung.

### Ort und Bundesland sind zwei Felder (v4.82.0)

Gemeldet an der Vorschlagsliste: `ort:` schlug Bundesländer vor, `bl:` schlug
dieselben Bundesländer vor — beide beschriftet mit „Ort". Kein Anzeigefehler,
sondern die Bauart: `ort`, `bl`, `buland` und `bundesland` waren Aliasse
**desselben** Trefferfeldes `standort`, der Korpus zog Ort und Land in ein Feld
zusammen, und das Etikett kommt aus `TREFFERFELD_LABEL[feld]`.

Warum das die Liste unbrauchbar machte, sagt die Verteilung: **jeder** Antrag
trägt ein Bundesland, die Orte verteilen sich auf 2 055 Werte. Die 16
Ländernamen führten deshalb jede Häufigkeitsliste an (Sachsen 3 282, Bayern
1 976, …) — die ersten 50 Vorschläge unter `ort:` enthielten kaum einen Ort.

Seit v4.82 ist `bundesland` ein eigenes Trefferfeld mit eigenem Präfix (`bl:`),
eigenem Etikett, eigener Facette und eigener Spalte. Zwei Entscheidungen dabei:

- **Das Kürzel bleibt suchbar, aber unsichtbar.** Angezeigt und vorgeschlagen
  wird nur der Klartext — sonst stünden „Sachsen" und „SN" als zwei Werte
  nebeneinander und teilten dasselbe Land in zwei Zeilen.
- **Verglichen wird am Wortanfang**, wie beim Standort und aus demselben Grund:
  „essen" darf Hessen nicht hereinholen. Für das Bundesland reicht das nicht —
  siehe den nächsten Abschnitt.

### Ein geschlossenes Vokabular wird verglichen, nicht durchsucht (v4.84.0)

Gefragt wurde, warum `bl:SN` (2 742) und `bl:Sachsen` (3 278) verschieden viel
finden: **niemand kann wissen, in welcher Schreibweise der Export sein Land
ablegt**, und beide Schreibweisen müssen dieselbe Menge liefern.

Nachgemessen war die Antwort nicht die naheliegende. In allen acht Quelldateien
steht ausschließlich das Kürzel, nie ein ausgeschriebener Name — die Lücke kam
von der anderen Seite: die am Wortanfang verankerte Nadel `" sachsen"` steckt
auch in `" sachsen anhalt st "`. **`bl:Sachsen` lieferte 536 Anträge aus
Sachsen-Anhalt mit**, ohne dass die Trefferzeile es verriet (2 742 + 550 − 14
Sätze mit je einem Land je Seite = 3 278).

Die Verankerung ist damit nicht falsch, sondern für dieses Feld das falsche
Werkzeug: **das Bundesland ist ein geschlossenes Vokabular aus 16 Werten, und
zwei davon stecken ineinander.** Ein Feld mit abzählbaren Werten hat Werte, keine
Textstellen — es wird verglichen.

- `bundeslandCode()` führt Kürzel und Name auf dieselbe Antwort (`SN`, `sn`,
  `Sachsen`, `sachsen` → `'SN'`; NFC wegen der Umlaute, Pitfall #22).
- Der Korpus führt `bundeslandCodes` — jedes aufgelöste Kürzel einzeln gerahmt
  (`' sn '`, bei zwei Seiten `' sn st '`).
- `trifftBundesland()` vergleicht genau, **sobald sich das gefragte Wort
  auflöst** — sonst fällt es auf die verankerte Suche über
  `bundeslandSuchform` zurück.

**Der Rückfall ist kein Rest, sondern die Bedingung dafür, dass die Suche beim
Tippen etwas zeigt.** `bl:sach` benennt kein Land und findet weiter beide
Sachsen; sobald das Wort vollständig ist, schnappt die Anfrage auf 2 742. Ebenso
bleibt ein fremder Wert auffindbar, den der Katalog nicht kennt — der genaue
Vergleich darf nie zum stillen Suchausfall werden.

Nebenwirkung, erwünscht: die Facetten-Zahl in der Vorschlagsliste stimmt jetzt
mit dem überein, was der Klick liefert. Vorher versprach sie 3 278 und hielt es
auch — mit Anträgen aus zwei Ländern.

**Rohe Kürzel in der Ortsliste — ein Mapping-Schaden, kein Suchfehler.** Neben
„Sachsen" standen „SN" (1 508), „BW" (974), „NW" (935), „BY" (922) als eigene
Ortswerte. Die Zahlen sind exakt die Zeilenzahlen der Quelle `7737-bgl`: ihr
Schema wirft `PLZ_AFS`, `ORT_AFS` und `BULAND_AFS` auf **denselben**
Speicher-Schlüssel `ausfuhrende_stelle` (Artefakt der Label-XLS-Gruppierung —
alle drei tragen dieselbe Gruppenbeschriftung). Der Import schreibt Spalte für
Spalte, die letzte gewinnt: im Store steht das Kürzel, und weil `ortAfs` vor
`landAfs` bedient wird, las der Korpus es als Ortsnamen.

`baueKorpusFeldKarte` vergibt solche Schlüssel seit v4.82 an **keinen** Slot —
was mehrere Spalten eines Schemas beanspruchen, trägt nichts Verlässliches. Die
Sperre gilt nur für die schema-aufgelösten Zugänge, nie für die fest verdrahtete
Basis: `antragsteller` ist in 7737 ebenfalls doppelt belegt und käme sonst mit
zu Fall. Repariert ist der Datenschaden damit nicht — die Quelle liefert ihren
Ort erst wieder, wenn ihr Mapping im Wizard auf getrennte Schlüssel gestellt und
neu importiert wird.

### Die Kennzeichen: Verbund und Fachsystem-AKZ (v4.53.0)

Nach dem FKZ ließ sich direkt suchen, nach dem **Verbundkennzeichen** nicht.
Dieselbe Messung wie oben, diesmal auf die Spalten beschränkt, die Codes tragen
(kurz, Buchstabe + Ziffer, kein Datum): über 512 Spalten der drei Quellen bleiben
genau **vier** übrig — `FKZ`, `AKZ`, `VB_NUMMER`, `ALTAKZ`. Mehr Kennzeichen gibt
es im Bestand nicht.

| Spalte | Schlüssel im Store | Deckung | Zugewinn |
|---|---|---|---|
| `VB_NUMMER` | `verbund_id` (kanonisch) | 14 225 (100 %), 7 535 Verbünde | steht in **keinem** durchsuchten Feld — nicht im FKZ, nicht im Netzwerkfeld, nicht im Titel (je 0 von 14 225) |
| `AKZ` | `akz` (custom) | 12 358 | der Ziffernteil ist in 12 321 Fällen mit dem FKZ identisch; die ganze Zeichenkette `KNF065624` fand vorher in 38 Fällen etwas |
| `ALTAKZ` | — | 5 109 | im Import auf „ignorieren" — steht gar nicht im Store |

Drei Entscheidungen:

- **Das Verbundkennzeichen wird eine eigene Fundstelle** (`verbundkennzeichen`,
  Präfix `vb:`), keine Erweiterung des Aktenzeichens. Es benennt eine ANDERE
  Sache: `vb:ZKN073232` liefert neun Teilvorhaben, von denen keines dieses
  Aktenzeichen trägt — ein Etikett „Aktenzeichen" wäre an dieser Zeile falsch.
  3 451 der 7 535 Verbünde haben mehr als ein Teilvorhaben (bis zu neun), und die
  Nummer war bis dahin der einzige Weg, sie beisammen zu sehen, den es nicht gab.
  Gewicht **3** wie das Aktenzeichen: eine Nummer hat keinen Deutungsspielraum.
  In der Oberfläche heißt der Beleg **„Verbund-Nr."** und nicht
  „Verbundkennzeichen" — als 10px-Marke stünden sonst 124 px Etikett vor 60 px
  Wert (gemessen); die Kurzform liest sich zudem als Satz: „Verbund-Nr.
  ZKN073232".
- **Das Fachsystem-AKZ fällt mit dem FKZ zusammen.** `16KN065624` und `KNF065624`
  sind derselbe Antrag; wer eine Nummer tippt, fragt „welcher Antrag ist das",
  nicht „steht das in FKZ oder AKZ". Deshalb EIN Feld, erreichbar über `fkz:`,
  `akz:`, `aktenzeichen:` und `kennzeichen:`. Der Buchstabenteil ist nicht
  ableitbar (`16KN` → KNF / INF / NWF / KNM / INM / INS …, er kodiert die
  Förderart), der Ziffernteil dagegen fast immer gleich — deshalb keine eigene
  Spalte: die FKZ-Spalte zeigt dieselben sechs Ziffern.
- **`ALTAKZ` bleibt draußen**, solange das Mapping es ausschließt. Ein Feld
  aufzunehmen, das im Store nicht existiert, wäre genau die stille
  Feature-Deaktivierung aus Klasse 5 — nur andersherum.

Dazu eine Umbenennung ohne Substanz: das Netzwerk-Präfix heißt jetzt `nw:` (die
Schreibweise des Teams). `netz:` liest die Suche weiter — gemerkte Suchen und
Notizen sollen nicht ins Leere laufen —, sie schlägt es nur nicht mehr vor.

### Keine Trefferzahl vor der Messung (v4.53.0)

Der Ergebniskopf schrieb `sichtbar.length`, sobald etwas im Suchfeld stand. Bei
einer frischen Anfrage ist diese Liste leer, bis die Pipeline das erste Mal
liefert — 300 ms Entprellung plus Korpuslauf, am echten Bestand **357–666 ms**
gemessen. So lange stand dort „**0 Treffer**", danach die richtige Zahl. Gemeldet
als „kurz 0 Treffer, dann die echte Trefferliste"; es war nie ein Ergebnis,
sondern eine Zahl vor der Messung.

Jetzt steht in diesem Fenster „**… Treffer**"
([SuchSeite.tsx](../../src/plugins/suche/SuchSeite.tsx)). Beim Weitertippen bleibt
dagegen die Zahl des vorigen Laufs stehen — eine kurz veraltete Zahl ist ehrlicher
als eine falsche, und sie flackert nicht. Eine echte 0 erscheint unverändert,
sobald der Lauf fertig ist (gemessen: 357 ms, mit dem Kein-Treffer-Zustand
darunter).

## 3 Relevanz — das Urteil

`berechneRelevanz(felder, abdeckung)` in
[trefferstelle.ts](../../src/core/services/search/trefferstelle.ts):

```
relevanz = abdeckung × (0,75 × stärke + 0,25 × breite)
stärke   = höchstes Feldgewicht / 3
breite   = min(1, (Anzahl Felder − 1) / 2)
```

**Feldgewichte** (nur ihr Verhältnis zählt): Titel · Akronym · Aktenzeichen 3 —
Kurzbeschreibung · Dokument 2 — Deskriptoren · Netzwerk · Ähnlichkeit 1,5 —
Organisation · Web-Adresse · Standort · Wahlkreis · Notiz 1.

Die Staffelung sagt, wie stark eine Fundstelle für das THEMA spricht: im Titel
steht, worum es geht; in der Einrichtung steht, wer es macht. „HPC Standards
GmbH" ist kein fachlicher Standards-Treffer. Das Netzwerk liegt bei den
Deskriptoren, weil es eine Vorhabens-FAMILIE benennt; die Arbeitsnotiz ganz
unten, weil sie vom VORGANG handelt („ZA nicht erinnern"), fast nie vom Thema.

**`abdeckung`** ist der Anteil der Suchwörter mit Fundstelle — bei UND immer 1,
bei ODER der Unterschied zwischen „ein Wort von dreien" und „alle drei".

**Drei Stufen** (`relevanzStufe`): hoch ab 0,66 · mittel ab 0,40 · sonst gering.

**Wortlaut schlägt Bedeutung.** Ein reiner Ähnlichkeitstreffer wird über
`relevanzAusAehnlichkeit` gedeckelt (Faktor 0,5) und kann die Stufe „hoch" nicht
erreichen. Sonst verdrängte ein Modellurteil die belegbaren Treffer.

**Eine Zahl, nicht zwei.** `score` TRÄGT die Relevanz — es gibt keine zweite
Sortiergröße daneben. `relevanzStufe` ist vorberechnet, damit Liste und Tabelle
dieselbe Stufe zeigen und die Schwellen nur an einer Stelle stehen.

Am Bestand gemessen (14 225 Anträge): „additive Fertigung" → 570 Treffer, davon
158 hoch / 9 mittel / 403 gering, 5 verschiedene Werte. „Standards" → 14 Treffer,
davon 6 allein über den Firmennamen, alle „gering".

## 4 Faltung der Dokumenttreffer

Ein Dokumenttreffer, dessen Antrag bekannt ist (Phase-2-Manifest,
`filenameToAkz`), wird zur **Textstelle** dieses Antrags statt zu einer zweiten
Zeile. Er trägt das Feld `dokument` bei und hebt damit die Relevanz seines
Antrags. Dokumente **ohne** zugeordneten Antrag bleiben eigenständige Treffer.

Zwei Folgen:

- Die **Quellenangabe ist Dateiname bzw. Abschnitt, keine Seitenzahl** — der
  Orama-Index führt je Abschnitt nur `id/text/title/source/tags/type`.
- Der frühere zweite Orama-Lauf (`searchAntraegeDms` in der übergreifenden
  Suche) ist entfallen: er fragte denselben Index ein zweites Mal für dieselbe
  Zuordnung — 150–300 ms für ein Ergebnis, das schon vorlag.

## 5 „Wortformen mitsuchen" = Wortstämme

Eine deterministische Synonymquelle hat die App nicht (das Glossar führt 41
Abkürzungen ohne Synonymfeld), und das Embedding-Modell kann Nachbarschaft
messen, aber keine Begriffe BENENNEN — ohne benennbare Begriffe gibt es nichts
abzuwählen. Seit v4.65 füllt der **Frageplan** genau diese Lücke (§8): die interne
KI kann Begriffe benennen, und weil sie es kann, erscheinen sie als Chips.
Der Wortstamm bleibt daneben, was er war — die kostenlose, rein sprachliche
Stufe, die kein Modell braucht.

Der Schalter hieß bis v4.16.0 „Ähnliche Begriffe mitsuchen" und stand neben der
„Ähnlichkeitssuche": zwei Namen, die dasselbe versprachen und Verschiedenes
taten. Getrennt sind sie jetzt entlang ihrer Achse — dasselbe **Wort** in anderer
Form (hier, rein sprachlich) gegen dasselbe **Thema** in anderen Worten
(Embedding, [[useSemanticSearchMode]]).

[wortstamm.ts](../../src/core/services/search/wortstamm.ts) löst Endungen ab
(`ungen|ung|en|er|es|em|e|s|n`, Reststamm ≥ 4 Zeichen). Die Chips der
Deutungszeile zeigen die Wörter, die im Bestand **tatsächlich gefunden** wurden.

**Der Deckel ist keine Kosmetik.** Sobald eine Variante abgewählt ist, sucht die
Stufe mit ausdrücklichen Nadeln (Wort + verbliebene Varianten) statt mit dem
Stamm — was nie eingesammelt wurde, fehlt dann. Mit Sammel-Deckel 8 fiel „Normen"
beim Abwählen EINER Variante von 28 auf 15 Treffer. Deshalb: **einsammeln 64,
anzeigen 8**; die nicht gezeigten bleiben aktiv.

### Die Wortgrenze (v4.68)

Bis v4.67 genügte `klein.includes(stamm)`: der Stamm durfte **irgendwo** im Wort
stehen. „Normen" wird zu `norm`, und damit zählte auch „e-**norm**-es" — kein
Wortform-Treffer, ein Buchstaben-Treffer. Gemeldet wurde das als „die Vorschläge
sind überwiegend nicht sinnvoll", und es betraf nicht nur die Chips: **gesucht**
wurde mit demselben Stamm, die Treffer kamen also wirklich zustande.

Die naheliegende Gegenregel — „muss am Wortanfang stehen" — wäre falsch: im
Deutschen steht das Grundwort hinten, und „Kalibrierstandards" ist genau der
Fall, den die Stufe finden soll. Unterscheidbar sind die beiden am **Rest direkt
davor, bis zur nächsten Wortgrenze**: bei „enormes" ist er ein einzelnes „e", bei
„kalibrierstandards" ein ganzes Wort. `enthaeltAlsWortteil` nimmt einen Fund an,
wenn dieser Rest leer ist (Wortanfang, hinter Bindestrich) oder **mindestens zwei
Zeichen** hat — zwei, damit „ge-normt" und „vor-norm" bleiben.

Am echten Bestand (14 225 Anträge) gemessen:

| Nadel | vorher | nachher | verloren |
|---|---|---|---|
| `norm` | 285 | 151 | 134 — jede Stichprobe „enorm…" |
| `standard` | 517 | 517 | 0 (Zusammensetzungen bleiben) |
| `laser` | 486 | 485 | 1 — der Nachname „Glaser" |
| `bahn` | 261 | 261 | 0 |

Die Regel gilt in der Suchstufe **und** beim Einsammeln der Chips. Sonst
erklärte die Zeile einen Treffer nicht mehr, den sie erzeugt hat.

### Die Platzhalter „?" und „*" (v4.101, v4.123)

Anlass ist die Namensdrift im Bestand: 306 der 733 Netzwerke führen mehr als
eine Schreibweise ihres Namens, darunter drei mit verwechselbaren Zeichen
(`mobiInspec` gegen `mobilnspec`, `DIGIPRO-EW` gegen `DiGlPro-EW`). Wer die
Binnenschreibweise nicht kennt, findet mit einer festen Nadel immer nur die eine
Hälfte — am Bestand: `mobiInspec` 32 Treffer, `mobilnspec` 3, und keine Anfrage
erreicht beide.

**`?` steht für genau ein Zeichen — überall außer am Wortende.** Diese eine
Regel trägt den ganzen Unterschied: ein Suchwort zerfällt an den Leerzeichen,
also steht das Fragezeichen einer Frage immer am Ende seines Wortes. „Welche
Vorhaben drehen sich um Normung?" bleibt damit eine Frage und wird nicht
stillschweigend zur Muster-Suche. Der Preis ist benannt: `16kn08300?` ist
**kein** Platzhalter — braucht es aber auch nicht, weil eine Nadel ohnehin als
Teilstring gesucht wird und `16kn08300` dieselbe Menge liefert.

Zwei Leitplanken:

- **Mindestens drei feste Zeichen.** `????` träfe sonst alle 12 358 Anträge.
  Die Grenze schützt nicht die Rechenzeit, sondern die Auskunft — eine Anfrage,
  die alles trifft, ist keine.
- **Dieselbe Wortanfang-Regel wie oben.** Ein Platzhalter lockert sie nicht:
  `n?rm` findet „Normung", nicht „enormes".

**Die Kosten wurden vor dem Bau gemessen**, über 12 358 echte Anträge × 6 Felder,
20 Läufe je Zeile:

| | ms je Durchlauf |
|---|---:|
| heute: `enthaeltAlsWortteil`, feste Nadel | 5,8 |
| dieselbe Arbeit durch die neue Weiche | 5,0 |
| `mobi?nspec` als Muster | 4,7 |
| `?obiinspec` (Platzhalter ganz vorn) | 4,5 |

Der Muster-Pfad ist **nicht teurer** als der heutige — beide brechen beim ersten
Fund ab, und die Regex-Maschine ist schneller als die Schleife aus `indexOf` plus
Wortgrenzen-Rücklauf. Teuer an einer Platzhalter-Suche ist nichts außer einer zu
weiten, und dagegen steht die Drei-Zeichen-Grenze.

Der heiße Pfad bleibt unberührt, weil `baueNadelMuster` für eine Nadel ohne
Platzhalter `null` liefert: dann läuft `enthaeltAlsWortteil` Zeichen für Zeichen
wie zuvor. Compiliert wird **einmal je Suchteil**, nicht je Eintrag — bei 14 000
Einträgen × Feldern × Nadeln wäre schon ein `Map`-Zugriff je Prüfung teurer als
die Prüfung selbst.

Am Bestand nachgemessen: `mobi?nspec` **33**, `16KN0830?1` **14**, `Normung?`
**0** (wörtlich gesucht, wie gewollt), `????` **0**.

#### Der Stern kam nach (v4.123)

Das Fragezeichen verlangt, dass man **abzählt**. `mobi?nspec` findet die beiden
Schreibweisen nur, weil sie sich in genau einem Zeichen unterscheiden; wer das
nicht weiß, tippt `mob?nspec` und bekommt **0** — ausgerechnet an der Drift, die
man sucht, weil man sie nicht kennt. `mob*spec` stellt dieselbe Frage, ohne die
Antwort vorauszusetzen.

**`*` steht für beliebig viele Zeichen — auch für keines, und es bleibt im
Wort.** Das Muster ist `[\p{L}\p{N}]*`, nicht `.*`: sonst spannte ein Stern über
Leerzeichen hinweg. Der Unterschied ist messbar, nicht theoretisch — `mob*technik`
findet **2** (die Firma „Mobiltechnik"), feldweit ohne Wortgrenze wären es
**119** gewesen, fast alle davon ein „mobil" und ein „Technik" in zwei Sätzen.
Der Bindestrich trennt hart wie überall in [wortstamm.ts](../../src/core/services/search/wortstamm.ts):
`mobi-Inspec` erreicht der Stern nicht.

Anders als `?` gilt er **auch am Wortende** — dort kostet er nur nichts
(`mobi*` und `mobi` liefern beide 1 504), und ein Satzzeichen, mit dem er
verwechselt werden könnte, gibt es nicht. Die Untergrenze zählt weiter nur die
festen Zeichen: `a*c` ist keine Muster-Suche, sondern die wörtliche nach `a*c`
(**0**). Mehrere Sterne hintereinander zieht `baueNadelMuster` zu einem
zusammen — `[…]*[…]*` beschriebe dieselbe Menge und liefe an einem langen Wort
quadratisch zurück.

Am Bestand nachgemessen (14 225 Anträge × 12 Felder, Median aus 15 Läufen):

| Anfrage | Treffer | ms |
|---|---:|---:|
| `mobiinspec` (feste Nadel) | 32 | 16,5 |
| `mobi?nspec` | 33 | 15,3 |
| `mob?nspec` | **0** | — |
| `mob*spec` | **33** | 14,4 |
| `mob**spec` | 33 | 13,8 |
| `mobi*` = `mobi` | 1 504 | 16,3 |
| `laser` (Vergleichsmaß ohne Platzhalter) | 484 | 17,4 |

Alle Zeilen liegen im selben Band; die Unterschiede darin sind Messrauschen (ein
zweiter Durchgang ordnete sie anders). Der Stern kostet so viel wie ein
gewöhnliches Wort. Er erbt außerdem alles,
was schon steht: `fkz:16KN0830*` **32** und `nw:mob*spec` **33** (Feldpräfix),
`"mob*spec"` **0** (zitiert ist wörtlich gemeint, dort ist der Stern ein
Sternchen).

**Die Fundstelle wird als Muster markiert.** `mob*spec` steht in keinem
Antragstext, `mobiInspec` schon — ohne diesen Weg käme die Zeile, die man ohne
Auszeichnung am wenigsten versteht, ausgerechnet unmarkiert an
([markierung.ts](../../src/core/services/search/markierung.ts) liest dieselbe
`baueNadelMuster`). Das galt bis v4.122 auch für `?` und ist mit demselben Patch
behoben.

**Was ein Platzhalter NICHT ist: unscharfe Suche.** Er findet Stellen, keine
Tippfehler. `mob*spec` erreicht „mobiInspec" und „mobilnspec", aber weder
„Mobinspek" noch „obiInspec" noch „mobi Inspec" — wer über Zeichenabstände
suchen will, braucht einen anderen Mechanismus, keinen weiteren Platzhalter.

**Beide stehen seit v4.135 im Reiter „Suchsprache"** — je als eigene, ausführbare
Zeile ([suchsprache.ts](../../src/plugins/suche/start/suchsprache.ts)). Der Stern
kam mit v4.123 dorthin, das Fragezeichen hatte zwischen v4.101 und v4.134 keine
Zeile in der Oberfläche: die Suche konnte es, und niemand konnte es erfahren.
Getrennte Zeilen, weil die Wahl zwischen beiden der Inhalt ist — `mob*spec`
fragt, ohne die Antwort vorauszusetzen, `16KN0830?1` (14) nutzt aus, dass man
genau eine wechselnde Stelle kennt.

### Die Reihenfolge der Chips (v4.68)

Angezeigt werden 8 von 64 — bis v4.67 die ersten in Korpus-Reihenfolge, also ein
beliebiger Ausschnitt. Gemessen hieß das: „normotherme" (ein einziger Antrag)
stand vorn, „Standardisierung" (dutzende) war unsichtbar. `sammleAusEintrag`
zählt seitdem mit, in wie vielen Anträgen eine Variante vorkommt, und sortiert
danach.

**Was das nicht löst, ist Bedeutung.** Der Wortstamm ist sprachlich: „normotherme"
und „Normung" teilen ihn wirklich, nur handelt das eine von Körpertemperatur.
Dafür gibt es den Knopf **„von der KI prüfen"**
([wortformen-pruefung.ts](../../src/core/services/search/wortformen-pruefung.ts),
Flag `sucheNatuerlicheSprache`): EIN interner Lauf auf Wunsch, nie automatisch —
die Wortformen müssen ohne Verbindung sofort funktionieren. Das Ergebnis landet
in derselben Abwahl-Liste, die auch der Klick auf einen Chip füllt; die KI drückt
also nur Knöpfe, die der Nutzer auch selbst drücken könnte, und jedes Wort steht
danach durchgestrichen da statt zu verschwinden.

Aussortiert wird, was das Modell **nennt** — nicht, was es vergisst. Andersherum
würde ein Auslassungsfehler zur kürzeren Trefferliste. Eine Antwort, die *alles*
aussortiert, gilt als umgedrehte Aufgabe und wird verworfen.

## 6 Worttrennung des Dokumenten-Index

Betrifft **nur** die Dokumentenstufe (Orama). Die Antragsstufe vergleicht rohe
Zeichenketten und ist von alldem unberührt.

Orama trennt Wörter über ein Zeichenklassen-Muster **pro Sprache**. Bis v4.7 lief
der Index auf `english` — und dessen Muster
(`[^A-Za-zàèéìòóù0-9_'-]+`) kennt `ä ö ü ß` nicht, behandelt sie also als
Trennzeichen. Seit v4.8 steht die Sprache in **einer** Konstante,
`INDEX_SPRACHE` in [orama-store.ts](../../src/core/services/search/orama-store.ts);
der Guard `orama-create-mit-indexsprache` hält jede weitere `create(...)`-Stelle
daran.

Am echten Textbestand gemessen (Fixture-CSVs + Projekt-Doku):

| | englisch | deutsch |
|---|---|---|
| verschiedene Token | 20 338 | **14 778** |
| Wörter, die zerrissen werden | 1 217 | 0 |
| häufigste Bruchstücke | `f` 859× · `r` 626× · `l` 321× | — |

„Fördergeber" wurde zu `f` + `rdergeber`, „Größe" zu `gr` + `e`. Weil Anfrage und
Index dieselbe Trennung benutzten, fand die Suche noch etwas — aber über
Bruchstücke. Das kostete zweierlei: `f` verband **jedes** Umlautwort miteinander
(mit ODER-Verknüpfung traf „Förderung" auch „Führung"), und die BM25-Wertung
zählte Bruchstücke statt Wörter.

Das deutsche Muster (`[^a-z0-9A-ZäöüÄÖÜß]+`) hält Umlautwörter zusammen und
trennt zusätzlich an `-` und `_` — „ZIM-Kooperationsprojekt" ist damit auch über
`kooperationsprojekt` auffindbar. Die Normalisierung faltet Umlaute danach
ohnehin (`förderung` → `forderung`), auf beiden Seiten gleich.

**Kein Stemming.** Das bräuchte `@orama/stemmers` (Orama wirft sonst
`MISSING_STEMMER`) und wäre ein zweiter, eigener Eingriff mit eigener Messung.

### Was mit einem Alt-Index passiert

**Er bleibt nutzbar.** `load()` setzt `tokenizer.language` auf den im Index
gespeicherten Wert zurück — der Alt-Index bleibt also in sich stimmig, Anfrage
und Index trennen weiterhin gleich, und niemand verliert seine Dokumentensuche.
Besser wird er dadurch nicht; erst ein Vollindexlauf hebt ihn.

Damit dieser Zustand nicht still bleibt:

| Ort | Verhalten |
|---|---|
| `loadOramaFromDB` | Warnung im Pipeline-Log |
| Kurator → Suchindex | Ampel „Worttrennung geändert — Index neu aufbauen" |
| Kurator → Index aktualisieren | „der nächste Lauf baut den Index komplett neu" |
| `BatchIndexer.indexAll` | verwirft `orama-db` + `index-manifest` + Checkpoint → erzwungener Vollaufbau |

Der erzwungene Vollaufbau ist kein Komfort, sondern Pflicht: ein inkrementeller
Lauf würde die Alt-Token behalten und neue Dokumente deutsch dazulegen — ein
halber Index mit zwei Trennungen. Der Checkpoint muss mit weg, sonst überspringt
der Vollaufbau die dort als erledigt vermerkten Dokumente.

Gelesen wird die Sprache **aus dem Index selbst** (`save()` schreibt sie mit),
nicht aus einem Merkschlüssel daneben — eine zweite Quelle könnte davon abweichen.

## 7 Was NICHT gemacht wurde

- **Vergleiche** (`jahr:>2024`) — die Feldsuche seit v4.49 nennt ein Feld und
  einen Wert, mehr nicht
  ([feldpraefix.ts](../../src/core/services/search/feldpraefix.ts)). Vergleiche
  wären eine Abfragesprache und gehören zu den Facetten, nicht ins Suchfeld.
  Platzhalter dagegen gibt es (`?` seit v4.101, `*` seit v4.123) — sie
  beschreiben ein Wort, keine Bedingung, und laufen deshalb durch dieselbe Nadel
  wie jedes andere Suchwort.
- **Unscharfe Suche** (Zeichenabstand, „meintest du") — **gemessen, nicht
  vermutet abgelehnt**: der Zugewinn am echten Namensraum ist null, siehe
  § 12. Ein Platzhalter findet Stellen, keine Tippfehler; die
  Ähnlichkeitsstufe misst Bedeutung, nicht Schreibweise. Die Klasse, die die
  Messung stattdessen zutage förderte — dieselbe Sache, anders getrennt —
  braucht kein Maß und ist seit v4.125 gebaut (§ 12.2).
- **Monitoring gespeicherter Suchen** — es gibt keinen Benachrichtigungsweg.
  „+2 seit zuletzt" ist die Differenz zum letzten Ausführen, nicht „2 neue
  Anträge", und die Beschriftung sagt genau das.

## 8 Die dritte Nadel-Quelle: der Frageplan (v4.65)

Das Suchfeld lud seit v3.50 im Platzhalter zu einer „analytischen Frage" ein und
konnte keine beantworten. Am echten Bestand gemessen (14 225 Anträge):

| Eingabe | Treffer |
|---|---|
| „Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?" (alle Wörter müssen vorkommen) | **0** |
| dieselbe Frage als genau diese Wortfolge | **0** |
| `Normung` | 5 |
| `Normung` + Wortformen | 285 |

Die Sache ist tausendfach da — unter „Normen", „Normierung", „Standardisierung".
Was fehlte, war eine Quelle, die diese Wörter **benennen** kann (§5).

**Die KI liefert Begriffe, keine Suchläufe.** `substringMatches` prüft alle
Suchteile in EINEM Durchgang über den Korpus; getrennte Läufe je Begriff wären
langsamer und müssten die Wertung neu erfinden, die es längst gibt.

**Ein Leitbegriff = ein Suchteil, seine Schreibweisen = dessen Nadeln.** Das ist
die ganze Mechanik, und sie ist keine Kosmetik. Ein Teil gilt als getroffen,
sobald IRGENDEINE seiner Nadeln trifft (`t.nadeln.some`) — `abdeckung` zählt
damit die gefragten SACHEN, nicht die Schreibweisen. Am Bestand gemessen, beide
Male mit denselben neun Nadeln:

| Aufbau | Treffer | hoch | mittel | gering |
|---|---|---|---|---|
| 2 Leitbegriffe mit ihren Schreibweisen | 583 | **4** | **20** | 559 |
| 9 gleichrangige Begriffe (flach) | 583 | 0 | 0 | **583** |

Dieselbe Treffermenge — aber flach kollabiert die gesamte Wertung: kein Treffer
kommt über 2/9 Abdeckung, alles wird „gering", und die Sortierung nach Score
liefert wieder die Reihenfolge des Cursors (§1). Die Gruppierung ist die
Bedingung dafür, dass „hauptsächlich" in der Frage überhaupt gemessen wird.

**Einschränkungen sind keine Alternativen.** Ein `PlanBegriff` trägt `pflicht`;
Pflichtteile müssen ALLE zutreffen, die Themen folgen der Verknüpfung. Ohne diese
Trennung wäre „in Bayern" nur ein weiteres ODER-Wort:

| „Was läuft in Bayern zum Thema Leichtbau?" | Treffer |
|---|---|
| Thema allein | 736 |
| Ort allein | 1 976 |
| Thema **UND NUR** Ort (Pflicht) | **87** |
| Thema ODER Ort (die naive Fassung) | 2 625 |

**`abdeckung` zählt nur die Themen.** Eine erfüllte Einschränkung ist bei jedem
überlebenden Treffer erfüllt — sie mitzuzählen hübe die Relevanz aller Treffer
gleichmäßig an, und die Stufe „hoch" sagte nichts mehr aus.

**Ohne Plan bewegt sich nichts.** `WortlautOptionen.planTeile` ist optional; fehlt
es, ist `pflichtTeile` leer, `themenTeile === teile` und `zaehlbar ===
teile.length` — der Ausdruck ist Zeichen für Zeichen der alte. Das ist die
Abnahmebedingung, nicht ein Nebeneffekt.

**Was der Plan NICHT ins Feld schreibt.** Die Feldbindung reist im Plan-Objekt
mit, nicht als `ort:`-Präfix im Anfragetext: `hatFeldPraefix()` schaltet Vektor-
und Dokumentstufe ab, und ein Plan, der seine Bindung in den Text schriebe,
verlöre beide stillschweigend. Umgekehrt gilt: sobald der Plan ein Feld bindet
oder etwas verlangt, werden beide Stufen bewusst abgeschaltet — sie könnten die
Einschränkung nicht einhalten. Ein reines Themen-Bündel lässt sie mitlaufen.

**Was „nicht berücksichtigt" nennen darf** (v4.78). Die Zeile unter den Chips
führt `ignoriert` — und trug bis dahin Wörter, die niemand verloren hatte. Der
Prompt verlangte Unvereinbares: Frageworte („Vorhaben", „Projekte") seien keine
Begriffe, **und** alles Nicht-Übersetzte sei zu melden. Das Modell meldete also
gehorsam das Wort, das auszulassen ihm befohlen war. „hauptsächlich" war der
schwerere Fall: es **wird** beantwortet — von der Abdeckung, siehe die Tabelle
oben — und die Zeile behauptete das Gegenteil, an der einen Stelle, die Vertrauen
herstellen soll.

Beide Wortklassen leben jetzt als Konstanten (`FRAGEWORTE`,
`GEWICHTUNGSWOERTER`), die der Prompt **rendert** und `parseFrageplan`
**filtert** — der Prompt für die Satzform, der Filter für die Wortform. Gefiltert
wird nur die Liste des Modells; was der Parser selbst verwarf (unbekanntes Feld,
zu kurze Nadel), ist immer ein Verlust und bleibt stehen.

**Die Förderantrags-Liste fragt anders.** Dort enthalten die Fragen oft gar kein
Thema, sondern Metadaten-Kombinationen („alle Netzwerke, die für Phase 2 abgelehnt
wurden"). Übernommen wurde deshalb das MUSTER, nicht dieses Modul: der
[Antragsplan](antrags-frage.md) setzt die vorhandenen Filter-Achsen der Seite und
teilt sich mit dem Frageplan nur die Leitbegriffe (`PlanBegriff`) und deren Regeln.

Modul: [frageplan.ts](../../src/core/services/search/frageplan.ts) (rein, ohne
Uhr und ohne Plugin-Import), Lauf:
[frageplan-lauf.ts](../../src/core/services/search/frageplan-lauf.ts) (ein
Aufruf, nur intern, `ziel: 'standard'`, kein Retry). Flag
`sucheNatuerlicheSprache`, dev + pl.

### 8.0 Was der Prompt dem Modell beibringen muss (v4.136)

Bis v4.135 war der Frageplan gebaut, aber nie **gegen den Bestand** abgenommen —
die Zahlen oben stammen aus der Entwurfszeit. Beim ersten vollen Lauf über alle
Beispielfragen (je zwei Runden gegen die interne KI, 14 225 Anträge) lieferten
**zwei der fünf null Treffer**, und eine dritte schwankte zwischen 176 und 550
bei identischem Fragetext.

Keiner dieser Fehlgriffe lag in der Mechanik. Alle lagen im Prompt — er ließ
Fragen offen, die man nur mit dem Bestand vor Augen beantworten kann.

**Ein Feld ohne Bezeichnung ist ein Münzwurf.** `feldListe()` rendert seit v4.136
`Präfix (Bezeichnung)` wie die Nachbarlisten `statusListe`/`bereichListe` es
längst tun. Vorher stand dort `… ast · ort · bl · deskriptor …`, und ausgerechnet
das Paar, das v4.82 GETRENNT hat, war nicht zu unterscheiden. Dazu kam eine
Namenskollision: `standort` heißt der BEREICH „Ort, Bundesland & Wahlkreis" —
und ist zugleich der interne Name des engen Ortsfeldes.

| „Sachsen" gebunden an | Treffer | mit dem Thema Sensorik |
|---|---:|---:|
| `ort` (Ortsfeld — Sachsenheim &c.) | 7 | 2 → nach der Status-Facette **0** |
| `bl` (Bundesland) | 2 742 | **493** |

Vier von fünf Ortsfragen wählten das Ortsfeld. Danach: fünf von fünf das
Bundesland.

**Ein Thema bekommt nie ein Feld.** Die Bindung kostet doppelt — Treffer und die
beiden Stufen, die `planSchraenktEin()` stilllegt. Gemessen: Wasserstoff an
`kurzbeschreibung` 179 statt 225, Robotik an `titel` 55 statt 116.

**Die kürzeste Form, aber nicht das kürzeste Wort.** Verglichen wird als
Wortteil (§5), also enthält die kurze Nadel die lange als Sonderfall. Das Modell
lieferte trotzdem die lange, weil es niemand anders verlangt hatte:

| Modell lieferte | Treffer | Stamm | Treffer |
|---|---:|---|---:|
| `wasserstofftechnologie` | 2 | `wasserstoff` | 224 |
| `normung` | 5 | `norm` | 145 |
| `robotik` | 92 | `robot` | 500 |

Die Regel allein trieb sofort ins Gegenteil: aus „Wasserstofftechnologie" wurde
`technologie`, und die Frage sprang auf **2 704** Treffer. Kürzen heißt Endungen
weglassen, nicht das Wort wechseln — `technologie` steht in 8 075 von 14 225
Anträgen und benennt nichts. Beide Grenzen stehen mit ihrer Messung im Prompt
(`STAMM_BEISPIELE`, `ZU_WEITE_GRUNDWOERTER`).

**Erfundene Komposita sind der Normalfall, nicht die Ausnahme.** 19 gemessene
Nadeln aus echten Läufen finden **null**: ein zusammengeschriebenes Wort
auseinandergezogen (`wasserstoff technologie`), ein ausgedachtes Kompositum
(`batterieaufbereitung`, `robotikprojekt`), eine Umschreibung statt des Wortes
(`wasserstoffbasierte technologie`). Etabliertes Englisch dagegen trägt
(`machine learning` 28).

**Sechs davon nannte der Prompt selbst** — die Normen-Regel führte `din-norm`,
`en-norm`, `vde-norm` und `iso 9001` als Vorbilder und behauptete dabei „sie
stehen so in den Antragstexten". Alle vier: null. Der Guard daneben prüfte ihre
**Länge** gegen `MIN_NADEL_LEN`; er wäre auch grün geblieben, wenn jedes Beispiel
ins Leere liefe. Übrig bleiben die drei gemessenen (`din en` 11, `din iso` 5,
`astm` 22) — mit ihrer Trefferzahl als Kommentar hinter der Zeile, wie an den
Beispielen des Reiters „Suchsprache" seit v4.135.

**Der Bearbeitungsstand ist nicht die Laufzeit.** „Welche Vorhaben … laufen seit
2023?" setzte `status: offen` und fiel von 102 auf 3. „Zu bearbeiten" heißt, dass
noch niemand entschieden hat — der Filter schneidet gerade die Bewilligten weg,
also die laufenden. Der Prompt sagt die Unterscheidung jetzt.

### 8.2 „nicht berücksichtigt" — die zweite Runde (v4.136)

Die v4.78-Reparatur (unten) griff für **Wörter**. Gemessen kamen die Meldungen
als **Sätze**, und der Rahmen rettete sie über den Filter:

> „Der Ausdruck 'Zeig mir' wird nicht als Suchkriterium verwendet."

Der Prompt verlangte genau das („kurze Klartext-**Sätze**"), der Filter erwartete
das Gegenteil. In fünf von acht Läufen stand so etwas unter den Chips. Er
verlangt jetzt die **blanke Wendung** aus der Frage; `META_WOERTER` ist der Gurt
für die Satzform, die trotzdem kommt.

Der schwerere Fall widersprach einem sichtbaren Chip: `ignoriert: ["seit 2023"]`,
**während** der Jahr-Chip 2023–2026 danebenstand. `baueIgnoriertListe` bekommt
deshalb die vom Plan GESETZTEN Werte und streicht, was nur davon spricht — der
Prompt sagt dieselbe Regel in Worten. Nach dem Patch: `ignoriert` in **allen
acht** Läufen leer.

Beide Prompt-Zeilen sind geteilt (`ignoriertSchemaZeilen`), weil der
[Antragsplan](antrags-frage.md) sie wortgleich führte und der Filter dahinter
EINER ist.

### 8.3 Der Befund muss sagen, was schon feststeht (v4.136)

Zwei Zahlen für dieselbe Achse auf einem Bildschirm, und eine ist falsch:

- **Die Jahr-Achse war zweimal definiert.** Die Facette rechnet
  `extractYear(bewilligungsdatum) || extractYear(antragsdatum)`, der Befund las
  `bewilligungsdatum?.slice(0, 4)`. Am Bestand tragen 9 233 von 14 225 ein
  Bewilligungsdatum, aber 14 221 ein Antragsdatum — die Facette holte Treffer
  herein, die der Befund als „ohne Angabe" meldete, und die Antwortkarte schrieb
  es hin. Beide lesen jetzt dieselbe Ableitung.
- **Die Einschränkung fehlte im Befund.** Zu „Was läuft in Bayern zum Thema
  Leichtbau?" nannte er nur das Thema, führte darunter aber „Bundesland: Bayern
  62 · ohne Angabe 20" — und die Karte schrieb „82 Vorhaben … davon liegen 62 im
  Bundesland Bayern". Alle 82 liegen in Bayern; das ist die Bedingung ihrer
  Anwesenheit. `Befund.einschraenkungen` sagt es jetzt vor der Verteilung, samt
  dem Satz, dass eine Lücke im Feld kein Gegenbeispiel ist.

Dazu zwei Prompt-Regeln für die Karte: sie spricht über die **Vorhaben**, nicht
über Befund und Auszug (gemessen stand dort „weil sie ‚trägt ALLE gefragten
Themen' gekennzeichnet sind" — eine Erklärung der Mechanik an einen Leser, der
die Kennzeichnung nie sieht), und sie fasst keine Werte zu Spannen zusammen.

### 8.4 Vorher / Nachher, am selben Bestand

Je Frage der Median aus zwei Runden davor gegen die Runde danach:

| Beispielfrage | vorher | nachher |
|---|---:|---:|
| Normung und Standards | 546 / 176 | **649** |
| KI in der Medizintechnik | 2 595 | 2 479 |
| Bayern / Leichtbau | 82 / **0** | **82** |
| Wasserstoff seit 2023 | 77 / 102 | **102** |
| offene Anträge Sensorik Sachsen | **0** / **0** | **3** |
| *Vorlage* Batterierecycling | 3 | 3 |
| *Vorlage* Photonik in Sachsen | **0** | **1** |
| *Vorlage* Robotik seit 2022 | 6 | **20** |

Keine Frage liefert mehr null; `ignoriert` ist überall leer; jede Ortsangabe
sitzt im Bundeslandfeld; kein Thema trägt eine Feldbindung; 0 Konsolenfehler.

**Was bleibt.** Das Modell nennt gelegentlich noch den „Auszug" in der Antwort,
und es zerlegt einen Kompositum-Begriff (`Batterierecycling`, 3 Treffer) nicht in
zwei Leitbegriffe (`Batterie` + `Recycling`: 788, davon 11 mit beiden). Beides
ist Streuung, kein Defekt — und weiter zu schrauben hieße, auf einzelne Läufe zu
optimieren.

### 8.1 Die Frage wird auch beantwortet (v4.89)

Bis v4.88 endete der Frage-Modus bei der Trefferliste. Daneben ging das
Assistenten-Panel auf, trug **dieselbe Frage** im Eingabefeld und wartete auf
eine zweite Absendung. Wer sie abschickte, bekam eine Antwort über **40 von 663**
Treffern — der Prompt sagte das korrekt an („die übrigen 623 liegen NICHT vor"),
aber „drehen sich *hauptsächlich* um Normung" blieb damit unbeantwortet. Zwei
Absendungen für eine Frage, und die zweite antwortete auf 6 % der Menge.

Der Hebel lag ungenutzt herum: über alle 663 Treffer weiß die App längst genug,
exakt und kostenlos. `baueBefund`
([frageBefund.ts](../../src/plugins/suche/frageBefund.ts)) sammelt es ein —
Relevanzverteilung, Fundstellen, Jahre, Länder, Orte, Antragsteller und vor allem
**wie viele Treffer ALLE gefragten Sachen tragen**. Genau das meint
„hauptsächlich", und es ist eine abzählbare Aussage.

Dafür trägt ein Treffer seine `abdeckung` jetzt pur mit
([search-result.ts](../../src/core/types/search-result.ts)). Gerechnet wurde sie
immer schon (`feldZuordnung`), sie verschwand aber im `score`, vermischt mit den
Feldgewichten — von dort ist sie nicht mehr zu trennen.

Der Antwort-Lauf
([frageantwort-lauf.ts](../../src/core/services/search/frageantwort-lauf.ts))
hat dieselben sechs Pflichten wie der Frageplan und zwei eigene:

- **Die Zahlen sind gegeben, nicht zu erfinden.** Unter der Antwort steht
  dieselbe Trefferliste; von zwei Zahlen für dieselbe Sache ist immer eine falsch.
- **Jede Aussage über ein Vorhaben nennt sein FKZ.** In der Karte werden die
  Kennzeichen anklickbar — ohne das wäre die Belegpflicht eine Formalie.

Gerechnet wird über **`sichtbar`**, also die Menge nach den Facetten: dieselbe,
die der Ergebniskopf beziffert. Über `searchResults` wäre die Karte schneller
fertig, sagte aber „aus 663 Treffern" über eine Liste mit 87.

Die Antwort steht als Karte **über der Trefferliste**
([antwort/](../../src/plugins/suche/antwort/)), nicht im Panel: gefragt wurde die
Suche, nicht ein Gesprächspartner. Das Panel geht nicht mehr von selbst auf und
behält die Frage im Feld (`vorbelegung`) — für Rückfragen, nicht für die erste
Antwort. Scheitert der Lauf, benennt die Karte das und **die Trefferliste bleibt
stehen**: sie ist deterministisch entstanden und hängt an keinem Modell.

### 8.2 Zwei Mengen an das Modell: Belege und Vorschläge (v4.104)

Bis v4.103 fuhren **20** Treffer als Belege mit, und die Treffer der
Ähnlichkeitssuche steckten unter ihnen — ununterscheidbar von denen, die ein
gesuchtes Wort tragen. Beides war zu ändern, und der zweite Punkt ist der
wichtigere: ein Ähnlichkeits-Treffer ist kein Fund, sondern ein **Vorschlag** des
Embedding-Modells. In ihm kommt kein einziges der gesuchten Wörter vor.

**Erst gemessen, dann erhöht.** Eine Belegzeile kostet über 12 180 echte Anträge
im Mittel **355 Zeichen** (Median 363, p90 457, längste 609 — der Deckel von
300 Zeichen je Textauszug wirkt). Daraus:

| | Zeichen |
|---|---:|
| 20 Belege (bis v4.103) | 7 105 |
| **40 Belege** (Mittel) | **14 209** |
| 40 Belege, p90-Fall | 18 280 |
| 40 Belege, längste Zeilen | 24 360 |
| 12 Ähnlichkeits-Vorschläge | ~4 260 |

`KONTEXT_CHAR_BUDGET` (24 000) wacht ohnehin darüber und schneidet den Rest ab.
Die Halbierung auf 20 war also eine Vorsicht ohne Grund — bei einer Frage nach
einer Liste ist jeder Beleg mehr ein Beispiel weniger, das erraten werden muss.

**Getrennt heißt: das Modell entscheidet, und es muss die Entscheidung
kennzeichnen.** Der Prompt führt „Belege (Auszug, die relevantesten Treffer)" und
„Thematisch verwandt (kein gesuchtes Wort — selbst prüfen)" als zwei Abschnitte;
die Regel dazu verlangt Einzelprüfung, den Zusatz „(thematisch verwandt)" hinter
dem Kennzeichen und Schweigen, wenn keiner passt. Genau dafür taugt ein
Sprachmodell und eine Kosinus-Schwelle nicht: `EMBEDDING_TOP_K = 50` liefert die
50 nächstliegenden, ob sie zur Frage gehören, steht damit nicht fest.

Zwei Invarianten halten das zusammen:

- **Eine Gesamtzahl.** Der Befund zählt weiter über ALLE Treffer — die Liste
  unter der Karte zeigt sie ja auch. Er nennt die Zusammensetzung in derselben
  Zeile: „Treffer insgesamt: 671 (596 mit gesuchtem Wortlaut, 75 nur thematisch
  ähnlich)". Zwei Zahlen in zwei Zeilen läsen sich als zwei Mengen.
- **Kandidaten allein reichen.** Findet eine Frage nur über Ähnlichkeit etwas,
  entfällt der Belege-Abschnitt und der Lauf läuft trotzdem. Ihn abzulehnen hieße,
  über eine gefüllte Trefferliste zu schweigen.

Nimmt das Modell einen Vorschlag auf, greift die Brücke von v4.100 unverändert:
sein Kennzeichen steht in der Antwort, also trägt seine Zeile in der Liste die
Marke „in der Antwort" und den Satz dazu.

**Nicht automatisch eingeschaltet.** Die Stufe bleibt ein Haken — sie lädt 200 MB
nach, und bei einer einschränkenden Frage läuft sie ohnehin nicht mit
(`planSchraenktEin`). Was sie im Frage-Modus tut, sagt seit v4.103.1 ihr eigener
Tooltip.

### 8.3 Wer eine Gruppe zählt, muss sie kenntlich machen (v4.105.1)

„Welche Vorhaben drehen sich **hauptsächlich** um Normung und Standards?" — 499
Treffer, und der Befund wusste die Antwort schon: „Davon tragen ALLE gefragten
Themen: 4 von 499". Die Antwort daneben nannte die Vier und schrieb dann, sie
seien „in den dargestellten 40 Belegen nicht enthalten". **Sie standen auf den
Plätzen 1 bis 4.**

Der Fehler lag nicht am Modell. Der Befund benannte eine Gruppe über eine
Eigenschaft (`abdeckung === 1`), die **keine Belegzeile trug**: dort standen
Titel, Snippet, Relevanz, Fundstellen, Kurzbeschreibung — nichts, woran sich die
vier von den 36 anderen unterscheiden ließen. Das Modell konnte die Gruppe
zählen, aber nicht benennen; es sagte das (»lassen sich aus dem Auszug nicht
identifizieren«) und verschärfte es zu einer Aussage über Abwesenheit.

Dass die Trefferliste sie unterscheidbar zeigt („Relevanz **mittel**", während
495 „gering" sind), ist kein Gegenargument, sondern Arithmetik, die im Prompt
nirgends steht: eine Fundstelle nur in der Kurzbeschreibung ergibt roh 0,5, mal
`abdeckung` 1 bleibt 0,5 (**mittel**, ab `SCHWELLE_MITTEL` 0,4), mal 0,5 bei nur
einem der beiden Themen sind es 0,25 (**gering**). Hier fielen beide Gruppen
zusammen; verlassen kann man sich darauf nicht.

Zwei Änderungen, beide an derselben Zahl (`themen`, die Anzahl der gefragten
Sachen aus dem Befund):

- **Die Zeile beschriftet die Gruppe.** Ab zwei gefragten Sachen trägt ein
  Beleg mit voller Abdeckung den Zusatz `ABDECKUNG_MARKE` („trägt ALLE gefragten
  Themen"). Bei einer einzigen Sache bleibt sie weg — dort trüge sie jede Zeile
  und unterschiede keine.
- **Die Auswahl zieht die Gruppe nach vorn.** Die Relevanz allein garantiert das
  nicht: `abdeckung` ist nur ein Faktor in ihr. Ein Vorhaben, das EINE der beiden
  Sachen im Titel und in weiteren Feldern führt, kommt auf bis zu 0,5 — eines,
  das BEIDE nur in einer Notiz führt, auf 0,25. Bei 60 solchen Halb-Treffern vor
  4 Voll-Treffern fiele die Gruppe komplett aus den 40 Belegen, und derselbe
  Antwort-Satz stünde wieder da.

Die Prompt-Regel hängt an der **Marke selbst** (`belege.includes(ABDECKUNG_MARKE)`),
nicht an einem zweiten Schalter: sie steht genau dann da, wenn eine Zeile sie
trägt, und verlangt, die Gekennzeichneten einzeln mit Kennzeichen zu nennen statt
nur ihre Anzahl zu wiederholen. Die Schwelle für „trägt alles" lebt einmal
(`traegtAlleThemen`) — der Befund zählt damit, die Zeile beschriftet damit.

### 8.4 Das Feld schlägt Fragen vor (v4.109)

Im Frage-Modus schwieg die Vervollständigung bisher (`wertIndex` ist dort `null`
— niemand tippt `ort:` in einen Satz), übrig blieb der nackte Verlauf. Der
beantwortet aber nicht die eine Frage, die vor einem leeren Feld steht: **was
kann man hier überhaupt fragen?**

Seit v4.109 zeigt das Feld denselben Bau wie die Förderantrags-Liste —
[@/components/frage-vorschlaege](../../src/components/frage-vorschlaege/abschnitte.ts),
drei Abschnitte in **einer** Liste mit einer Auswahlmarke:

| Abschnitt | Inhalt | Auswahl |
|---|---|---|
| Zuletzt gefragt | eigener Verlauf, max. 3 | stellt die Frage |
| Beispielfragen | drei aus `FRAGEN` | stellt die Frage |
| Zum Ausfüllen | drei Vorlagen mit Lücken `‹…›` | setzt nur ein |

Drei Regeln halten das zusammen:

- **Der Katalog ist geteilt, die Fragen sind es nicht.** Die Antragsliste fragt
  nach Metadaten-Achsen (Status, Variante, PreCheck), diese Suche nach einem
  THEMA plus Einschränkungen (Ort, Jahr, Stand). Ein gemeinsamer Vorrat wäre auf
  jeder Seite zur Hälfte eine Einladung ins Leere
  ([katalog.ts](../../src/plugins/suche/frage/katalog.ts)).
- **Eine Liste, zwei Orte.** `FRAGEN` ist zugleich der Vorrat des Reiters
  „Fragen" im Startzustand; das Dropdown zeigt drei davon, der Reiter alle fünf.
  Zwei Vorräte liefen auseinander.
- **Erst ab dem ersten Zeichen.** Beim leeren Feld steht der Startzustand
  darunter — und sein Reiter „Fragen" ist die ungedeckte Fläche für genau diesen
  Katalog. Ein Dropdown darüber nähme die Reiterleiste weg, die es erklärt
  (dieselbe Regel wie in `vorschlagslisteSteht`, v4.107.1).

**Eine halbe Frage erreicht die KI nie.** `frageStellen` bricht bei einer offenen
Lücke ab und der Knopf „Frage stellen" ist dann gesperrt — nicht nur die
Eingabetaste springt in die Lücke, sondern jeder Weg zur KI kennt sie. Ein
Modell, das `‹Thema›` liest, denkt sich eines aus.

### 8.5 Die Ähnlichkeitsstufe legt Rechenschaft ab (v4.110)

Gemeldet: „ich schalte ‚auch ähnliche Themen' ein, die Trefferzahl ändert sich
nicht, und nach 20 Sekunden steht dieselbe KI-Antwort da." Nachgemessen am
laufenden Server (`Normung Standards Zertifizierung`, 135 Treffer):

```
[useUnifiedSearch] Ähnlichkeitssuche: 2 Vector-Treffer (Korpus 1086) in 7ms
Pipeline gesamt: 41525ms, 136 Treffer
```

Die Stufe **lief** — sie fand zwei Kandidaten, einer davon war neu. Die Antwort
lief nicht neu, weil ihr Schlüssel `Frage :: Trefferzahl` sich nicht geändert
hatte. Nichts davon war sichtbar: **ein Messfeld ohne Urteil meldet keinen
Stillstand.**

**Zwei Änderungen, beide gemessen.**

1. **Der Schalter sagt, was er getan hat** ([aehnlichkeitsSatz.ts](../../src/plugins/suche/aehnlichkeitsSatz.ts)).
   Drei Fälle, jeder eine Auskunft: „9 thematisch verwandte Vorhaben, 8 davon neu
   in der Liste" · „12 … — alle standen schon im Wortlaut-Ergebnis, die
   Trefferzahl ändert sich dadurch nicht" · „kein Vorhaben lag über der
   Schwelle". Dazu die **Reichweite**, solange der Korpus kleiner ist als der
   Bestand: „Vergleichbar sind 1 086 von 14 225 Vorhaben — nur sie haben auf
   diesem Rechner einen Vektor." Ein Vorhaben ohne Vektor kann nie ähnlich sein;
   das ist die halbe Antwort auf „warum findet er nichts", und sie stand
   nirgends. Der Befund kommt aus der Vektorstufe selbst und zählt **vor** dem
   Einsortieren, sonst wäre „neu" immer gleich „alle". *(Die genannte Zahl war
   bis v4.113 die GEDECKELTE — §8.6.)*

2. **Die relative Schwelle steht auf 0,85 statt 0,90.** Nicht der Floor (0,35)
   war die Bremse, sondern das enge Band um die beste Cosine — `TOP_K` (50) war es
   bei breiten Fragen allerdings doch, was erst v4.113 gemessen hat (§8.6) — die Messtabelle über fünf Fragen steht im Service
   ([antraege-search-service.ts](../../src/plugins/antraege/services/antraege-search-service.ts)).
   Am selben Lauf wie oben: **2 Kandidaten → 9, davon 8 neu; 136 → 143 Treffer.**
   Vertretbar wurde das erst mit v4.104 (§8.2): die Kandidaten fahren als eigene,
   gekennzeichnete Menge zum Modell und verdrängen keinen belegten Treffer.

Was **nicht** geändert wurde: der Deckel `AEHNLICHKEIT_DECKEL` (0,5). Ein reiner
Ähnlichkeitstreffer bleibt „gering" und steht nie über einem Wortlaut-Treffer —
Wortlaut schlägt Bedeutung (§2).

### 8.6 Was die Stufe wirklich verglich (v4.113)

Eine erschöpfende Bug-Jagd auf genau diese Stufe, alles am echten Bestand
gemessen (14 225 Anträge, 14 065 Vektoren) und von unabhängigen Prüfern
gegengelesen. Zehn Befunde; der schwerste stand seit dem ersten Korpus.

**Der Vektor eines Vorhabens kannte nie seinen Inhalt.**
`buildEmbeddingTextForAntrag` las drei Schlüssel hart: `verbund_titel`, `titel`,
`projektbeschreibung_text`. Am Bestand war davon **einer** gefüllt:

| Schlüssel | gefüllt |
|---|---|
| `projektbeschreibung_text` | **0 von 14 225** (existiert in keinem Record) |
| `verbund_titel` | **0 von 14 225** |
| `titel` | 14 220 |
| `inhalt_kurzzusammenfassung` — *hier steht der Inhalt* | **9 259**, Median 834 Zeichen |

Es ist wortgleich die Bug-Klasse, die für den **Wortlaut**-Korpus mit v4.42
behoben wurde (§2): welcher Schlüssel es wird, entscheidet das Wizard-Mapping,
nicht der Code. Der Guard `korpus-felder-ueber-schema` bewachte nur
`search-corpus.ts` — ein Guard, der eine Datei kennt, fängt keine Klasse. Beide
Korpora lösen jetzt über `baueKorpusFeldKarte` auf, der Guard deckt beide, und ein
zweiter verbietet die harten Feldkonstanten daneben.

Gemessen nach dem Fix, gleicher Bestand: **9 259** Einbettungstexte tragen den
Inhalt (vorher 0), Median-Länge **811** statt **147** Zeichen (p90 1 343, max
2 272 — der 4 000-Zeichen-Deckel greift nie). Der Titel bleibt **vorn**: nimmt man
den Inhalt auf und lässt den Titel weg, sinkt die Trefferquote für Titel-Anfragen
von 40/40 auf 24/40.

**Wirksam wird das erst nach einem Rebuild** — Korpus-Build-Version **v3**.

**Der Korpus führt jetzt eine Signatur** ([signatur.ts](../../src/core/services/embedding-corpus/signatur.ts)).
Das war die schärfste offene Frage: sein IDB-Schlüssel ist das Aktenzeichen, sonst
nichts, und `incremental` filterte allein über die Existenz dieses Schlüssels.
Präfix, `dtype`, Pooling, Normalisierung und Textzusammensetzung gingen in keinen
Schlüssel, Hash oder Merkschlüssel ein — wer eines änderte, liess alle alten
Vektoren liegen, legte neue aus einem anderen Raum daneben, und nichts wurde rot,
weil `checkCompat` nur `modellId` und `dim` verglich. Jetzt: Signatur = Modell +
Dimension + Dokument-Präfix + Textversion; weicht sie ab (oder fehlt sie), baut der
Lauf **voll** statt zu mischen, und das Manifest stempelt den **erzeugenden** Stand
statt des gerade aktiven.

**Der Bereich gilt auch für die Ähnlichkeit** (`bereichNutztAehnlichkeit`).
`aehnlichkeit` steht in `NICHT_IM_STANDARD` — „hängt an ihrem eigenen Schalter" —
und der Schalter kannte den Bereich nicht. Gemessen, Anfrage
„Wasserstofftechnologie", Stufe an:

| „Suche in" | Treffer | davon aus der Vektorstufe |
|---|---|---|
| alle Vorhabensfelder | 50 | 48 neu |
| **nur Einrichtung** | 50 | **50 — alle** |
| **nur Dokumente**, Stufe an | **50** | **50 — alle** |
| nur Dokumente, Stufe aus | **0** | — |

Wer bewusst auf „nur Einrichtung" einschränkte — der Fall, für den die
Beschränkung dokumentiert ist —, bekam wieder das Thema. Jetzt ruht die Stufe
dort, und die Zeile sagt es an (`SemanticStatus` `'bereich-ruht'`).

**Der Deckel verwarf bevorzugt die neuen Treffer, und der Satz nannte die
gedeckelte Zahl.** `topKEmbeddingMatches` schnitt die nach Cosine sortierte
GESAMTmenge auf 50. Über 8 Anfragen gemessen:

| | über der Schwelle | genannt | abgeschnitten | davon **neu** |
|---|---|---|---|---|
| Summe | **450** | **297** | 153 | **62 von 147 (42 %)** |

Systematisch, nicht zufällig: neue Treffer lagen im Mittel auf Rang **54,3**,
schon vorhandene auf **40,8**. Bei „Wasserstoff" meldete die App wörtlich „50
thematisch verwandte Vorhaben — alle standen schon im Wortlaut-Ergebnis", während
65 über der Schwelle lagen und die zwei abgeschnittenen (cos 0,453 / 0,447) die
einzigen neuen gewesen wären — der Satz, der „es ändert sich nichts" erklären
soll, berichtete die Ursache dieser Beschwerde als deren Widerlegung. Jetzt gilt
der Deckel nur für die **neuen** (ein schon gelisteter Treffer kostet keine Zeile,
nur eine Fundstelle), `kandidaten` ist die Zahl **vor** dem Deckel, und was er
zurückhielt, steht dabei.

**Der Anfrage-Präfix ist wieder der trainierte.** Hier stand ein selbst
formulierter deutscher (`task: Suchergebnis aus deutschen Verwaltungsdokumenten |
query: `). Trennschärfe d′ = (Ziel-Cosine − Korpus-Mittel) / SD, n = 15:

| Präfix | Ziel-Cosine | Korpus-Mittel | SD | **d′** |
|---|---|---|---|---|
| deutsch (alt) | 0,766 | 0,3076 | 0,0469 | 9,92 |
| **Original** `task: search result \| query: ` | **0,8198** | 0,2052 | 0,0548 | **11,40** |

15 von 15 Einzelfällen für das Original. Der naheliegende Einwand — der Cutoff ist
relativ, eine gleichmässige Verschiebung ändert nichts — ist gemessen widerlegt:
von den ausgewählten Mengen blieben je Anfrage nur 32–52 % gleich (Jaccard) und
3–5 der ersten 10 Treffer. Der `documentPrefix` bleibt, wie er ist: der
„title"-Slot ist kein Feld, das das Modell auswertet, sondern eine Zeichenkette
vor dem Text — ihn zu füllen brachte +0,02 MRR, also Rauschen.

**Der Boden 0,35 bleibt — nachgemessen, nicht übernommen.** Er war gegen die
gestauchte Skala des deutschen Präfixes gesetzt. Auf der weiteren Skala des
Originals trennt er **besser**: 12 Anfragen gegen die 14 065 Vektoren, beste
Cosine je Anfrage — Unsinn und Off-Domain („qwertz asdf zzz", „Apfelkuchen
Rezept", „Fussballweltmeisterschaft 1974", „Urlaub auf Mallorca") erreichten
höchstens **0,339**, echte Fachanfragen mindestens **0,369**. Der Boden liegt genau
in dieser Lücke.

**Sechs weitere, kurz.**

- **„Das Modell konnte nicht geladen werden", während es lädt.** `init` kehrte bei
  `this.loading` sofort zurück; `ensureEmbeddingReady` galt danach als erledigt,
  `isReady()` war `false`, die Zeile meldete einen Fehler, der nicht stattfand —
  mit Verweis auf die Konsole, die unter `file://` niemand offen hat. Der laufende
  Ladelauf wird jetzt **abgewartet**.
- **Das Modell lud bei jedem App-Start**, obwohl das Opt-in aus ist und am
  Schalter „(lädt 200 MB)" steht: `useSearchProvider` ist app-weit gemountet und
  rief `embeddingService.init` ohne jede Prüfung. Jetzt lädt, wer es braucht
  (`ensureVectorModel`); wer bereit wird, meldet es über `subscribe`, sonst bliebe
  das Abzeichen „Modell lädt…" stehen.
- **Das Einschalten konnte Dokumenttreffer kosten.** `queryVector` **wählte**
  zwischen `mode: 'fulltext'` und `mode: 'hybrid'` — dieselbe Anfrage, eine andere
  Dokumentmenge. „Auch" heisst additiv: der Wortlaut-Lauf behält seine Plätze, der
  Hybrid-Lauf füllt nur die freien auf.
- **Ein Fragment-Korpus heilte nie.** Der Autoload griff nur bei genau 0 Vektoren;
  ein Teilbestand entsteht ohne Zutun, weil `applyCorpusStreamed` pro Vektor eine
  eigene IDB-Transaktion schreibt. Jetzt lädt er, solange der Share mehr hält — und
  nur aus demselben Vektorraum. Die Zeile nennt den Ausweg auch im Teil-Fall.
- **Der Indexer zählte Chunks doppelt.** Ein geändertes Dokument ersetzt seine
  Chunks per `upsert`, der Index wuchs um 0, `doc-chunk-counts` um die volle
  Chunkzahl — und `normalizeScore` zog dem GERADE aktualisierten Dokument dafür
  ~19 % ab (nach zwei weiteren ~34 %). Der Zähler wird je Dokument neu gesetzt,
  `index-chunk-count` kommt aus dem Index selbst.
- **Der Indexer löschte nie alte Chunks.** Aus 12 Abschnitten wurden 5, und
  `docId-5 … docId-11` blieben mit dem ALTEN Wortlaut unter dem Namen der AKTUELLEN
  Datei stehen, während die Ampel „Index aktuell" meldete. Die Chunk-Ids je
  Dokument stehen jetzt in `doc-chunk-ids`, und `removeDocAndChunks` räumt beides.

**Verworfen** (adversarisch geprüft und gefallen): der `documentPrefix` als
Wirkungsbefund (drei von drei Prüfern — es gibt keinen Titel-Slot); die Vermutung,
der deutsche Präfix DRÜCKE die Skala (er hob sie in 6 von 8 Fällen); und dass der
Boden knapp über dem Durchschnittsdokument liege (das Tor ist der relative
Cutoff).

**Offen geblieben**: ob die vom Deckel verworfenen Treffer *gut* sind (es gibt
keine bewerteten Anfragen); der reale Effekt der Dokumentenstufen-Befunde (diese
Maschine hat 1 Dokument im Index); der programmfremde Vektortreffer (nur ein
Programm vorhanden); die Hauptthread-Blockade (Pitfall #8 — das Messinstrument war
im Browser-Pane unbrauchbar, der Leerlauf-Referenzlauf zeigte ohne jede Arbeit
1 062 ms Lücke); und welcher der beiden Präfixe die *relevanteren* Treffer liefert
— d′ sagt „trennschärfer", nicht „besser".

## 9 Das Suchfeld schlägt vor (v4.71)

Die Feldsuche aus §7 setzt zweierlei voraus: dass man die Präfixe kennt **und**
dass man den Wert richtig schreibt. Beides war eine Zumutung, und am Bestand
gemessen ist klar, warum.

### 9.1 Der Wertevorrat, den niemand raten kann

| Feld | verschiedene Werte | mehrwortig (nach Häufigkeit gewichtet) |
|---|---|---|
| `bl:` | 16 | 19 % |
| `deskriptor:` | **43** | 63 % |
| `wahlkreis:` | 299 | 49 % |
| `nw:` | 1 270 Netzwerknamen | ~0 % |
| `ort:` | 2 055 | 8 % |
| `ast:` | 5 461 | **100 %** |

Die Deskriptoren sind ein **festes Vokabular**, das nirgends in der App stand
(„Digitale Wirtschaft und Gesellschaft (IKT)", „Energie/Ress. Effizienz"); ein
Netzwerk heißt im Export `"ProAnimalLife" 16KN062302_KR`; und die Einrichtung
mit 305 Anträgen heißt nicht „Fraunhofer-Gesellschaft … e.V.", sondern
„Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung **eingetragener
Verein**". Wer das eintippen soll, tippt es falsch — beim Schreiben dieses
Abschnitts ist genau das passiert, und die Anfrage lieferte 0 Treffer.

Felder mit Fließtext (Titel, Beschreibung, Notiz) stehen bewusst **nicht** in der
Liste: eine Vorschlagsliste daraus wäre eine Wortwolke. Kennzeichen (`fkz:`,
`vb:`) sind abzählbar, aber 7 535 undurchsichtige Codes sind nichts zum
Durchblättern.

### 9.2 Anführungszeichen sind die Voraussetzung, nicht die Kür

Bis v4.70 zerfiel jede Anfrage an Leerzeichen. Ein Wert aus mehreren Wörtern
wurde damit zu etwas anderem, als dastand — gemessen an `ort:Frankfurt am Main`:

| Verknüpfung | ohne Anführungszeichen | mit `ort:"Frankfurt am Main"` |
|---|---|---|
| alle Wörter müssen vorkommen | 48 | **40** |
| irgendein Wort genügt | **6 365** | **40** |

Bei UND fängt der Zufall den Fehler meist ab (die übrigen Wörter stehen ohnehin
in denselben Sätzen), bei ODER nicht mehr. Ein Vorschlag, den man anklickt und
der dann 6 365 statt 40 Treffer bringt, wäre schlimmer als kein Vorschlag —
deshalb kam der Parser zuerst.

`ast:"Technische Universität Chemnitz"` ist seither **ein** Suchteil: ein Chip in
der Deutungszeile, eine Fundstelle „Einrichtung", kein Wortstamm (`exakt` in
[feldpraefix.ts](../../src/core/services/search/feldpraefix.ts)). Auch ohne Feld
funktioniert das Zitat — `"additive Fertigung"` sucht die Wortfolge, ohne den
Modus umzustellen.

### 9.3 Die Zahl kommt aus einem Probelauf, nicht aus dem Zähler

Der Werte-Index zählt, in wie vielen Anträgen ein Wert vorkommt. Diese Zahl
**ordnete** die Liste bis v4.87; seither sortiert sie alphabetisch (§9.4). Die
Häufigkeit ordnet seit v4.111 noch genau eine Sache: **welche Werte der Reiter
„Top Ten" zeigt** (`haeufigsteWerte`; bis v6.10 hieß er „Stöbern" und zeigte
fünf statt zehn) — er nannte sie „die häufigsten fünf", nahm aber den
alphabetischen Anschnitt und zeigte damit Bremen (306 Anträge) statt Sachsen
(2 742).

Für die **Stichwort-Achse** desselben Reiters gilt das nicht: sie kommt aus
einem eigenen Index über die Titel und Kurzbeschreibungen
([wort-index.ts](../../src/plugins/antraege/services/wort-index.ts)), und dort
weichen Index-Zahl und Trefferzahl weit voneinander ab („Daten" steht in 646
Vorhaben, findet aber 2 414 Treffer, weil die Suche jedes Feld liest und auch
in „Datenbank" fündig wird). Die Zeile zeigt deshalb die **Index-Zahl** — und
nennt sie „Vorhaben" statt „Treffer", damit die beiden Maße nicht dasselbe Wort
tragen.

Was als Zahl neben einem Vorschlag steht, kommt aus `searchAntraegeSubstring`
mit den eingestellten Reglern, also aus derselben Maschinerie, die nach dem Klick
läuft — nie aus dem Zähler. Der Unterschied ist klein geworden (am Bestand
gemessen: 486 Rohtreffer für den Ort „Dresden", die Suche findet 485), aber es
sind zwei verschiedene Fragen, und nur die zweite beantwortet, was nach dem Klick
dasteht.

Seit v4.91 zählt der Probelauf zusätzlich auf die **gewählten Richtlinien**
herunter (§10). Ohne das verspräche ein Vorschlag „42 Treffer" und lieferte nach
dem Klick 30 — und genauso die Startzustand-Zahlen: gemessen trägt „Additive
Fertigung / 3D-Druck" 545 Anträge bei „alle Richtlinien" und 531 im
Standard-Bereich. Dafür führt der Korpus-Eintrag die `unterprogrammId` MIT; der
Filter selbst sitzt im Konsumenten, nie im Korpus (Pitfall #46).

Die Probeläufe laufen **nach** der Liste (150 ms Verzögerung, nur für
Wert-Vorschläge) und **in Schüben zu vier**: ein Lauf kostet gemessen 11–20 ms,
eine volle Liste also rund 700 ms — am Stück ein sichtbarer Hänger nach jeder
Tipp-Pause, in Schüben bleibt jeder Block unter ~45 ms. Dasselbe Verfahren nutzt
der Startzustand für seine Trefferzahlen.

Der nächste Schub kommt über einen **Message-Task, nicht über `setTimeout(0)`**.
Verschachtelte Timer klemmt der Browser ab der fünften Ebene auf 4 ms und in
einem verborgenen Fenster auf rund eine Sekunde: in `dev:local` (verborgener Tab)
hatten von 42 Deskriptoren nach 30 Sekunden erst 28 eine Zahl. Mit dem
Message-Task stehen alle 42 nach **934 ms**.

### 9.4 Wie viele Werte die Liste zeigt (v4.88: alle)

**Alle.** Erst waren es acht, dann 50 — und jede Zahl beantwortete „welche
zeigen wir", statt der Frage, die der Suchende stellt: „welche gibt es". Gefragt
wurde ausdrücklich nach allen Netzwerken; ist die Liste alphabetisch und
scrollbar, gibt es keinen Grund, sie vorher zu beschneiden. Die Fußzeile
„50 von 1.243" entfällt mit dem Deckel, den sie erklärte.

Drei Dinge mussten dafür nachziehen, jedes an einer gemessenen Zahl:

| Was | Ohne die Änderung | Damit |
|---|---|---|
| **Rendern** — die Liste kommt in Stufen zu 200 über Message-Tasks (`STUFE` in [SearchInput.tsx](../../src/plugins/suche/SearchInput.tsx)) | ein Tastendruck blockiert bei `ast:` **1 338 ms** (`ort:` 713, `nw:` 458) | **51 / 46 / 43 ms**, 200 Zeilen sofort, der Rest wächst nach |
| **Trefferzahlen** — nur für Zeilen im Sichtfenster ([useProbeZahlen.ts](../../src/plugins/suche/useProbeZahlen.ts)) | ein Probelauf kostet 11–20 ms, also ~20 s für `nw:`, ~80 s für `ast:` | rund 20 Zahlen je Sicht, beim Scrollen kommen sie nach |
| **Sortierung** — alphabetisch statt nach Häufigkeit ([wert-index.ts](../../src/plugins/antraege/services/wert-index.ts)) | die Häufigkeit ordnete, WELCHE 50 zu sehen sind | gefunden wird nach Namen; die Häufigkeit ordnet nur noch die zehn der Top-Ten-Vorschau (§9.3) |

Der Sichtbarkeits-Melder liest **Scroll-Geometrie, keinen `IntersectionObserver`**:
der feuert in einem nicht dargestellten Fenster gar nicht (in `dev:local`
gemessen: 0 Meldungen), und die Liste stünde dann ohne eine einzige Zahl da.

**Was die alphabetische Ordnung ans Licht holte.** Beide Fehlstände gab es
vorher schon; die Häufigkeits-Sortierung hatte sie nur nach unten geschoben.

- **25 von 1 243 Netzwerkwerten fehlt ein Anführungszeichen** — mal das
  schließende (`"3DLiveVis2 16KN045423_LT`), mal das öffnende
  (`CANNABIS-NET" 16KN089602_KR`). Alphabetisch sortiert ein führendes `"` ganz
  nach vorn: die ersten Zeilen des Katalogs waren Bruchstücke. `netzwerkName`
  nimmt weiterhin zuerst das Paar (es steht nicht immer vorn —
  `16KN054101 "IWiT" _PSc`) und räumt nur sonst auf.
- **80 Netzwerke stehen in zwei Schreibweisen** (`3D-Fab`/`3D-FAB`).
  Alphabetisch stehen sie direkt untereinander und sehen aus wie ein
  Anzeigefehler; die Suche unterscheidet sie ohnehin nicht. `verdichteWertIndex`
  faltet sie zu einer Zeile mit der häufigeren Schreibweise — das behob nebenbei
  **688** React-Warnungen wegen doppelter Schlüssel.

- **13 von 5 407 Einrichtungen tragen ein Anführungszeichen MITTEN im Namen**
  (`"EIKBOOM" Gesellschaft mit beschränkter Haftung`) — und waren über ihren
  eigenen Katalogeintrag nicht auffindbar: `alsAnfrageWert` räumte das Zeichen
  aus der Anfrage, der Korpus behielt es, der Klick fand **0** (Kontrolle
  `ast:EIKBOOM`: 2). Alphabetisch stehen sie ganz oben, es waren also die ersten
  Zeilen, die jemand sieht. Seit v4.111 legen **beide Seiten** dasselbe ab
  (`ohneZitatzeichen` in [wert-index.ts](../../src/plugins/antraege/services/wert-index.ts),
  angewandt auf `organisationLower`/`netzwerkLower` und in `alsAnfrageWert`);
  ersetzt wird durch ein Leerzeichen, nicht gelöscht — `Foo"Bar` sind zwei
  Wörter. Die **Anzeige** bleibt, wie der Export es schreibt.

**Was bleibt**: 68 Netzwerke führen im Export gar keinen Namen, nur ein
Kennzeichen (`16KN087150`). Sie stehen alphabetisch bei den Ziffern und damit am
Anfang der Liste. Sie zu verstecken hieße, sie unauffindbar zu machen.

### 9.5 Wo was wohnt

- Wertevorrat: [wert-index.ts](../../src/plugins/antraege/services/wert-index.ts)
  — gefüllt **im selben Cursor-Walk**, der den Suchkorpus baut
  ([search-corpus.ts](../../src/plugins/antraege/services/search-corpus.ts)); ein
  zweiter Lauf über 14 000 Anträge wäre reine Wiederholung. Die zusammengezogenen
  Korpus-Felder taugen nicht als Quelle: `organisation` verbindet Antragsteller
  und ausführende Stelle mit einem Leerzeichen und ist danach nicht mehr in zwei
  Namen zu zerlegen.
- Auswahl-Logik: [vervollstaendigung.ts](../../src/plugins/suche/vervollstaendigung.ts)
  — rein, ohne React. Vorgeschlagen wird zum **Stück unter dem Schreibcursor**,
  ersetzt wird nur dieses.
- Die Deskriptoren kommen über `deskriptorenAnzeige`
  ([descriptor-text.ts](../../src/plugins/antraege/services/descriptor-text.ts)):
  WELCHE Werte es sind, entscheidet weiterhin `readAntragDeskriptoren` — dieselbe
  Funktion, aus der der Suchtext entsteht; zurückgeholt wird nur die
  Schreibweise, weil „iuk-technologien" in einer Liste wie ein Datenfehler
  aussieht.

Kein Feature-Flag: das ist kein zweiter Weg neben der Suche, sondern derselbe —
nur mit Vorschlägen. Im Frage-Modus (§8) schweigt die Vervollständigung, dort
schreibt niemand `ort:`.

## 10 Welche Richtlinien in der Trefferliste stehen (v4.91)

Über der Trefferliste steht ein Chip „**Treffer: alle Richtlinien**". Er
entscheidet, welche Förder-Richtlinien überhaupt erscheinen — voreingestellt
alle, und wer das ändert, ändert es einmal: die Wahl ist gerätelokal gemerkt.

**Der Grundzustand ist „alle", und das ist die eigentliche Aussage.** Die Suche
ist Evidenz: sie soll finden, was es gibt, auch in stillgelegten Altprogrammen.
Der *Betrachtungsbereich* der Arbeitslisten steht dagegen auf „letzte 3
Richtlinien" — zwei verschiedene Fragen, deshalb zwei Speicher und zwei
Grundzustände. Geteilt sind nur Mechanik und Bedienung; die vollständige
Gegenüberstellung steht in
[vorgangssystem.md §10.3](vorgangssystem.md).

**Reihenfolge in der Pipeline:** Suchtreffer → Richtlinien-Auswahl → Facetten →
Spaltenfilter → Sortierung. Die Auswahl steht **vor** den Facetten, weil eine
Facettenzahl eine Zusage ist: steht „Bewilligt 12" da, kommen nach dem Klick 12
Zeilen — auf der Menge, die tatsächlich erscheint.

**Was die Auswahl NICHT tut:**

- Sie sortiert, gewichtet und faltet nichts. Der Score bleibt unberührt.
- Sie rät nicht: ein Treffer ohne Programm-Nummer (etwa ein Dokument ohne
  verknüpften Antrag) bleibt stehen. Ihn wegzuwerfen hieße, eine Zugehörigkeit
  zu behaupten, die niemand kennt.
- Sie versteckt sich nicht. Weicht sie von „alle" ab, beziffert der Chip die
  Differenz („· 56 ausgeblendet"), der Kein-Treffer-Zustand bietet „alle
  Richtlinien einbeziehen" **mit der echten Zahl** an, und der Chip steht auch
  ohne Anfrage da — die Startzustand-Zahlen hängen schon an ihr.

Gemessen an „laser" über 14 225 Anträge: 485 Treffer bei „alle Richtlinien", 429
im Standard-Bereich, Chip „· 56 ausgeblendet". 485 − 56 = 429.

**Wo was wohnt:** [richtlinienWahl.ts](../../src/plugins/suche/richtlinienWahl.ts)
(Speicher + reiner Filter), [SuchRichtlinienChip.tsx](../../src/plugins/suche/SuchRichtlinienChip.tsx)
(Bindung an den geteilten `BereichAuswahlChip`),
[useKorpusZahlen.ts](../../src/plugins/suche/useKorpusZahlen.ts) (Probelauf +
Vorschlagszahl, auf die Auswahl heruntergezählt).

## 11 Der Netzwerkantrag traegt den Namen seines Netzwerks (v4.93)

`nw:mobiInspec` versprach „das Netzwerk" und lieferte nur dessen
Teilvorhaben — der Netzwerkantrag selbst war ueber dieses Feld **nie**
erreichbar. Sichtbar wurde es am Antragstyp-Filter: unter `nw:` bot er nur
„FuE" an, nie „NW", und wer das Netzwerk selbst sehen wollte, hatte dort nichts
zum Umschalten.

**Die Ursache ist strukturell, kein Datenfehler.** Die Spalte `NETZWERKNA`
fuehren nur die Teilvorhaben: sie zeigt auf das Netzwerk, zu dem sie gehoeren.
Der Netzwerkantrag laesst sie leer — er *ist* das Netzwerk, es gibt fuer ihn
nichts zu referenzieren. Am Bestand gemessen (13 016 16KN-Saetze): von 1 775
Netzwerkantraegen tragen **1 581 gar nichts** in der Spalte; die uebrigen 194
tragen ein Kennzeichen statt eines Namens (`"16KN111101"` — der Verweis der
Phase 2 auf ihre Phase 1).

**Der Name wird abgeleitet, aus zwei Quellen in fester Reihenfolge**
([netzwerk-leads.ts](../../src/plugins/antraege/services/netzwerk-leads.ts)):

| Quelle | Faelle | Warum in dieser Reihenfolge |
|---|---|---|
| `NETZWERKNA` der Mitglieder | 1 306 | garantiert **dieselbe Zeichenkette** wie bei den Mitgliedern — sonst zerfiele ein Netzwerk in der Vorschlagsliste in zwei Eintraege |
| eigenes `VB_KURZNAM` | 468 | Netzwerke ohne Mitglieder; umschliessende Klammern fallen weg (`(mobiInspec)`), sie markieren den abgelehnten Versuch |
| — | 1 | 16KN086601 hat weder noch und bleibt namenlos. Geraten wird nicht |

Fuehren die Mitglieder **mehrere** Schreibweisen (494 Netzwerke), gewinnt die
haeufigste, bei Gleichstand die alphabetisch erste — dieselbe Regel wie in
`verdichteWertIndex`. **Der Tippfehler wird damit nicht weggewaschen:** bei
`mobiInspec` stehen 29 Saetze gegen einen einzelnen `mobilnspec`; der
Netzwerkantrag bekommt `mobiInspec`, und `nw:mobilnspec` findet weiter genau
seinen einen Satz. Beide Schreibweisen bleiben in der Vorschlagsliste
nebeneinander sichtbar (§9.4) — die App zeigt den Datenstand, sie korrigiert ihn
nicht.

Der Nachlauf laeuft **im Speicher**, ueber die schon geladenen Saetze, nicht ein
zweites Mal ueber die IDB — der Cursor-Walk bleibt ein Durchgang.

Gemessen in `dev:local`: `nw:mobiInspec` **29 → 32** (die zwei Netzwerkantraege
des Netzes 0830 plus den abgelehnten Vorlaeufer 16KN080301), Antragstyp-Facette
jetzt **FuE 29 · NW 3**, und die Zahl am Vorschlag `mobiInspec` steht wieder auf
derselben Menge wie das Ergebnis (32).

## 12 Was Namensdrift wirklich ist (Messung v4.123)

Nach dem Stern stand die Frage im Raum, ob als nächstes ein **Abstandsmaß**
gehört („meintest du `mobiInspec`?"). Vor dem Bau wurde der Namensraum
ausgezählt — das Ergebnis kippte die Frage.

**Der Bestand** (14 225 Anträge): 677 Netzwerke tragen einen Namen, 960
verschiedene Schreibweisen; **235 Netzwerke (35 %) führen mehr als eine**, an
den Nebenschreibweisen hängen **938 Anträge**. Die Akronyme dagegen driften
**innerhalb eines Verbunds nie** (0 von 7 533) — Drift lebt in der freien
Verweis-Spalte `NETZWERKNA`, nicht im Akronym.

**Was ein Abstandsmaß beitrüge**, über alle 377 Paare Haupt-↔-Nebenschreibweise:

| Klasse | Paare | Anträge |
|---|---:|---:|
| gemeinsamer Teilstring ≥ 5 → **heute schon** mit fester Nadel erreichbar | 185 | 594 |
| Stern/Fragezeichen nötig → **seit v4.123** erreichbar | 16 | 46 |
| Abstand ≤ 2 **ohne** brauchbaren gemeinsamen Teil → nur per Abstandsmaß | **0** | **0** |
| Abstand > 2 → **ein anderer Name**, kein Vertipper | 176 | 298 |

Die Menge, die ein Abstandsmaß als Einziges rettet, ist **leer**. Die 176 Fälle
der letzten Zeile sind keine Schreibfehler, sondern Mitglieder, die in die
Netzwerk-Spalte etwas anderes eingetragen haben — `ProtecTier ↔ Betäubung`,
`eLight ↔ eParabike ↔ Elektrofahrrad`, `BioORIX ↔ Metagene`. Kein Maß bringt die
zusammen, und keines sollte.

**Der Preis stünde trotzdem an**: unter den 960 Namen liegen **17 Paare
verschiedener Netzwerke** bei Abstand 1 (`rwtec ↔ retec`, `instand ↔ instant`,
`tms ↔ tns`, `iba ↔ ita`, `aqs ↔ aes`, `plm ↔ p2m`, `kgb ↔ kwb`, `gid ↔ gsd`)
und **349** bei Abstand 2. Ein „meintest du" kaufte also Verwechslung ohne
Gegenwert.

### 12.1 Die Lücke ist das Trennzeichen, nicht der Tippfehler

Dieselbe Auszählung zeigt, wo Schreibweisen tatsächlich auseinanderlaufen:
**36 Namensgruppen unterscheiden sich ausschließlich im Trennzeichen** —
`sws energie ↔ swsenergie`, `ego-tex ↔ egotex`, `lab-on-a-chip ↔ lab on a chip`,
`h2 apply ↔ h2apply ↔ h2-apply`, `forst_tec ↔ forst-tec`, `f.i.t. ↔ f.i.t`.
**Alle 36 gehören zum selben Netzwerk** — die Zusammenfassung wäre also ohne
einen einzigen Fehlalarm. **66 der 235 Drift-Netzwerke (28 %) wären allein
dadurch geheilt**, es hängen **415 Anträge** daran. Bei den Akronymen bleiben
nach Abzug der Klammer-Fälle (`(PULSAR)` ↔ `PULSAR`, per Teilstring ohnehin
erreichbar) **28 echte Lücken mit 57 Anträgen**.

Der Stern hilft hier **nicht**: er bleibt innerhalb eines Wortes, und genau die
Wortgrenze ist ja der Unterschied.

Am Bestand sichtbar wird das als **Asymmetrie** — derselbe Name, drei
Schreibweisen, drei Antworten:

| Anfrage | Treffer vor v4.125 | seit v4.125 |
|---|---:|---:|
| `h2 apply` (zwei Nadeln, beide müssen vorkommen) | 33 | 33 |
| `h2apply` | 9 | **33** |
| `h2-apply` | 1 | **33** |
| `cannabis-net` | 60 | 60 |
| `cannabisnet` | 1 | **60** |

Wer den Namen so tippt, wie er ihn kennt, bekam je nach Schreibweise 1 oder 60
Zeilen. Das war der Befund — deterministisch behebbar, ohne Maß und ohne Raten.
Gebaut wurde er als **Namenskern**.

### 12.2 Der Namenskern (v4.125)

**Die Regel:** verglichen wird zusätzlich der Wert **ohne alles, was kein
Buchstabe und keine Ziffer ist**. Die Nadel darf damit über eine Fuge laufen —
**muss aber an einem Wortanfang des Originals beginnen**
([namensKern.ts](src/core/services/search/namensKern.ts)).

Die zweite Hälfte ist die Leitplanke. Ohne sie fände `bona` das Netzwerk „lab on
a chip" (`la·bona·chip`): der Kern hat keine Wortgrenzen mehr, an denen ein Fund
scheitern könnte. Der Kern ist damit in der Wortmitte **strenger** als der
gewöhnliche Vergleich, der zwei Zeichen Vorsilbe zulässt (§ „Die Wortgrenze") —
die Fuge zu überspringen ist die neue Fähigkeit, das Wort aufzubrechen war nie
eine.

**Wo er gilt:** an `akronym` und `netzwerk`, den beiden Feldern, deren ganzer
Inhalt EIN Name ist (`KERN_FELDER`). Nicht an `organisation` — dort steht ein
ganzer Satz („Gesellschaft zur Förderung von Medizin-, Bio- und
Umwelt-Technologien e.V.") und damit Fließtext. **Nicht** an Titel, Abstract
oder Snippet: fiele dort der Satzpunkt weg, träfe `einlaser` „…ein. Laser…" —
derselbe Fehler, den `.*` beim Stern gemacht hätte.

**Wo er nicht gilt:** in Anführungszeichen (`"nafatech"` → 0, zitiert ist
wörtlich gemeint), unter drei Zeichen, und **zusammen mit einem Platzhalter**.
Ein `?`/`*` fragt nach unbekannten ZEICHEN, der Kern nach einer unbekannten
FUGE; zusammen wäre `mob*technik` auf dem Kern wieder so weit wie `.*`.

**Was er einbringt**, am Bestand gemessen (14 225 Anträge, alle 40
Netzwerk-Namensgruppen mit Fugen-Drift, 75 realistische Nadeln = jede
Schreibweise zusammengeschrieben plus die Schreibweise selbst):

| | |
|---|---:|
| Nadeln, die mehr finden als vorher | 71 von 75 |
| zusätzlich gefundene Anträge | **991** |
| davon Nadeln, die vorher **null** Treffer hatten | 19 |

Einzelfälle: `nafatech` 0 → 29, `biomasse20` 0 → 62, `labonachip` 0 → 53,
`submusic` 0 → 30, `havimplantat` 0 → 31, `swsenergie` 14 → 26, `kipro` 6 → 10.

Beim Akronym liegt der Zugewinn anders: **innerhalb** eines Verbunds driftet es
nie (§ 12), zwischen Verbünden schon — 535 der 6 599 Schreibweisen haben einen
Zwilling, der sich nur in der Fuge unterscheidet (`mikro algen` ↔ `mikroalgen`,
`ki-pro` ↔ `kipro`, `(3d-sprüh)` ↔ `3d-sprüh`).

**Was er kostet.** Über die 400 häufigsten Wörter der Titel — also das, was
wirklich getippt wird — ändern **5 Nadeln** ihre Trefferzahl, um zusammen **12
Zeilen**. Fünf davon sind richtig (`mikroalgen` findet „Mikro Algen"), sieben
sind der Preis: `app` (905 → 909) erreicht „AP-Pellet", `modulare` (728 → 729)
„Modular Energy". Das ist kein Sonderfall, sondern die Regel selbst — der Kern
lässt einen getrennten Namen sich genau so verhalten wie seinen
zusammengeschriebenen Zwilling, Präfix-Treffer eingeschlossen. Sichtbar wird
dasselbe an `onachip` (0 → 53): „on" ist ein Wortanfang, also läuft die Nadel
durch. `bona` bleibt bei 17.

Rechenzeit: **+1 ms je Anfrage** (20,6–21,1 ms → 21,6–21,8 ms, Median aus 15
Läufen über fünf Anfragen). Der Kern liegt im Korpus vorberechnet neben dem
rohen Wert — Zeichen für Zeichen durch beide Felder zu laufen kostete das
Neunfache (8,4 statt 0,9 ms je Nadel). Trägt ein Wert keine Fuge, ist sein Kern
**dieselbe Zeichenkette**: 9 454 der 14 222 Akronyme kosten damit kein Byte.

**Die Vorschlagsliste hängt an derselben Feldmenge** (§ 9.1): `nw:cannabisnet`
schlägt „Cannabis-Net" vor, als **vierter und letzter Rang** hinter allen
Werten, die die getippte Zeichenkette wörtlich tragen. Ohne das schlüge die
Liste etwas anderes vor, als die Anfrage darunter findet — der Wertevorrat ist
gerade der Ort, an dem man einen Namen sucht, dessen Schreibweise man nicht
kennt.

**Die Fundstelle wird markiert** — `nafatech` zeichnet „NaFa-Tech" als EIN Stück
aus, Bindestrich eingeschlossen. Das schaltet der Aufrufer (`alsName`), nicht
der Text: derselbe Markierer zeichnet auch Titel und Snippet aus, und im Snippet
stehen drei Felder mit ` · ` aneinander — dort würde die Faltung über die
Feldgrenze laufen. Das Akronym bleibt deshalb im Snippet unmarkiert; sein Beleg
ist die Trefferstellen-Marke „Akronym".
