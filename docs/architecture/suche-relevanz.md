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
| `aehnlichkeit` | Spalten „Suche" / „Score" |
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

- **Platzhalter und Vergleiche** (`fkz:16KN*`, `jahr:>2024`) — die Feldsuche
  seit v4.49 nennt ein Feld und einen Wert, mehr nicht
  ([feldpraefix.ts](../../src/core/services/search/feldpraefix.ts)). Ein `*` ist
  überflüssig, weil ohnehin im Wort gesucht wird; Vergleiche wären eine
  Abfragesprache und gehören zu den Facetten, nicht ins Suchfeld.
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

Modul: [frageplan.ts](../../src/core/services/search/frageplan.ts) (rein, ohne
Uhr und ohne Plugin-Import), Lauf:
[frageplan-lauf.ts](../../src/core/services/search/frageplan-lauf.ts) (ein
Aufruf, nur intern, `ziel: 'standard'`, kein Retry). Flag
`sucheNatuerlicheSprache`, dev + pl.

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
**ordnete** die Liste bis v4.87; seither sortiert sie alphabetisch (§9.4) und die
Häufigkeit dient nur noch dem Reiter „Stöbern" als Größenangabe. Was als Zahl
neben einem Vorschlag steht, kommt aus `searchAntraegeSubstring` mit den
eingestellten Reglern, also aus derselben Maschinerie, die nach dem Klick läuft. Der Unterschied ist nicht theoretisch: nach den Rohspalten tragen 485
Anträge den Ort „Dresden", die Suche findet 451.

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
| **Sortierung** — alphabetisch statt nach Häufigkeit ([wert-index.ts](../../src/plugins/antraege/services/wert-index.ts)) | die Häufigkeit ordnete, WELCHE 50 zu sehen sind | sie beziffert nur noch; gefunden wird nach Namen |

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
