# Die Status-Ebenen: was woran hängt

Über einem Antrag liegen mehrere Angaben übereinander, die leicht für dasselbe
gehalten werden. Dieses Doc ist die Karte dazu: **wer sie pflegt, was sie
steuern, und was passiert, wenn man eine ändert.**

## Die Ebenen und wer sie pflegt

Die erste Frage ist nicht „wie viele Begriffe gibt es", sondern **wem sie
gehören**. Drei der fünf Ebenen sind Fremddaten aus dem Fachsystem C16 und
kosten uns keine Pflege — sie kommen per Import, und die App leitet aus ihnen
nichts ab ([Pitfall #44](vorgangssystem.md)).

| Ebene | Umfang | Herkunft | Wer pflegt |
|---|---|---|---|
| **Kürzel** (`D_AAE`, `T_HINT`) | 509 | Kürzel-Zuarbeit | C16 — wir kuratieren nur Ordner, Relevanz, Ruhe, Kurzform |
| **Status** (11 Skizze … 99 Schlussvermerk) | ~30 | Nachtexport `STATUS_TV`/`STATUS_VB` | C16 — gilt wie importiert |
| **Trigger** (Kürzel → Statuswechsel + Mail) | ~2450 Zeilen / 9 Richtlinien | XLSX-Import | C16 |
| **Verfahrensschritt** (ZAH-Phase) | 3–9, ausgeliefert 6 | **unsere Erfindung** | PL im Baum-Editor, jederzeit |
| **Arbeitsliste** (`StatusCategory`) | fest 9 | **unsere Erfindung** | niemand zur Laufzeit — sie steht im Code |
| **To-do-Regeln** (wer ist als Nächstes dran) | ~30 je Regelsatz | **unsere Erfindung** | PL im Reiter To-do-Regeln |

Die letzten drei Zeilen stehen im Reiter „Ebenen" unter *Was wir darüber legen*.
Die To-do-Regeln standen dort bis v4.120 bei den Fremddaten — sie sind
PL-editierbare Fassungsdaten, C16 kennt sie nicht.

Dazu zwei Ebenen, die nicht „wo steht er", sondern „ist er zu spät" beantworten
— getrennt gerechnet, seit v4.87 gemeinsam gezeigt:

| Ebene | Frage | Gepflegt in | Gilt ab |
|---|---|---|---|
| **Zieltage** je Status | Liegt der Vorgang zu lange still? | Katalog-Fassung | dem Speichern |
| **Meilenstein**-Sollwoche | Ist ein Termin ab Eingang gerissen? | [Meilenstein-Plan](meilensteine.md) | der **Freigabe** |

Beide laufen in **eine** Liste (Home-Widget „Fristen",
[fristAnlaesse.ts](../../src/plugins/home/widgets/fristAnlaesse.ts)) — zusammen
gezeigt, nicht zusammen gerechnet: sie messen Verschiedenes, und jede Zeile
nennt deshalb ihre Herkunft.

## Was an den Kürzeln überhaupt Handarbeit ist (v4.92)

Die Kollegen meldeten, die Pflege der Kürzel falle schwer: zu viele neue
Begriffe. Genannt wurden **relevant**, **Ordner**, **Prominenz** und
**ZAH-Phase**; als klar und gut gepflegt galt **wird gesetzt von**.

Die Messung der laufenden Fassung 23 gegen die Auslieferung erklärt beides —
das Unbehagen wie das Wohlgefühl:

| Spalte | von Hand geändert | woher der Wert kommt |
|---|---|---|
| wird gesetzt von | **0** von 509 | Kürzel-Zuarbeit, Spalte „wird gesetzt von:" |
| Ordner | **0** von 509 (auch der Baum: 19 Ordner, 0 umbenannt, 0 verschoben) | Kürzel-Zuarbeit, Ordnerstruktur |
| Prominenz | **0** von 509 | Auslieferung (32 Ausnahmen im Code kuratiert) |
| ZAH-Phase | 22 | 24 aus der Auslieferung + 22 von Hand |
| relevant | **224** | ausschließlich Handarbeit (Auslieferung: 0) |

„Wird gesetzt von" fühlt sich gut gepflegt an, **weil sie es ist** — nur nicht
durch uns: sie kam so aus der Zuarbeit. Ordner und Prominenz sind derselbe Fall,
mit einem Unterschied: sie **sahen bedienbar aus**. Ein Auswahlfeld in einer
Zeile ist eine Aufforderung; 509 Zeilen mal zwei Felder waren über 1.000
Aufforderungen zu einer Entscheidung, die nie nötig war.

Die ZAH-Phase am Kürzel ist ein dritter Fall: sie **kann** für die meisten gar
keine Antwort haben. Der Phasenvorschlag gegen die 2.447 Trigger-Zeilen ist
erschöpft — von 479 Kürzeln mit Code kämen noch **3** Vorschläge dazu; 293
haben keinen Trigger, 178 setzen mit ihren Triggern keinen Status. 463 leere
Zellen bleiben leer, und das ist richtig so: das „seit wann" braucht **ein**
Datumsfeld je Schritt, nicht 509.

**Konsequenz.** Die Zeile führt nur noch, was hier entschieden wird; Ordner,
Prominenz und Verfahrensschritt stehen in der Klappe der Zeile, mit ihrer
Herkunft dabei. **Entfernt wurde keine der drei** — und beim Ordner
wäre das ein Fehler gewesen: aus `kategorieId` leitet
[kategorie-projektion.ts](../../src/core/status/kategorie-projektion.ts) die
**Ordner-Spalten der Fördertabelle** ab, und jeder CSV-Import schreibt sie in
die Slim-Projektion. Die Drift-Messung sagt, wer eine Achse *pflegt* — nicht,
wer sie *liest*. Statt Rückbau sagt der Ordner-Editor seit v4.99, welche Ordner
gar keine Spalte tragen können
([ordnerBilanz.ts](../../src/plugins/status-cockpit/ordnerBilanz.ts): 15 von 19,
ohne Spalte sind *internationale Projekte*, *Betreuung*, *Vor-Ort-Besuch*,
*SV - Keller - Archiv*). Die Frage „welches Datum speist einen Schritt — und welcher
Schritt geht leer aus?" steht am **Schritt** statt am Kürzel
([phasenDatumsfelder.ts](../../src/plugins/status-cockpit/phasenDatumsfelder.ts)):
dort sind es fünf Zeilen statt 509, und dort ist die Lücke eine Aussage.
Gezählt wird nur, was auch wirkt — ein stillgelegtes oder als `ignoriert`
ausgeblendetes Kürzel erscheint gar nicht in der Chronik und deckt deshalb
keinen Schritt.

### Ein Wort, zwei Bedeutungen

Der Prominenz-Wert `meilenstein` hieß **„Meilenstein"** und stand damit im
Kürzel-Verzeichnis neben einem Meilenstein-Modul, das etwas völlig anderes
meint (Sollwochen ab Eingang, eigener Plan, eigene Freigabe). Er heißt jetzt
**„Hauptereignis"** — er sagt nur, wie stark ein Punkt in der Chronik gezeichnet
wird. Der Bezeichner bleibt `meilenstein`, weil er in jeder gespeicherten
Fassung steht; ein Test hält die Beschriftung fest.

## Verfahrensschritt gegen Arbeitsliste

Die beiden werden am häufigsten verwechselt. Sie beantworten verschiedene
Fragen, gehören verschiedenen Leuten, und genau eine von ihnen ist beweglich.

| | Verfahrensschritt (ZAH-Phase) | Arbeitsliste (`StatusCategory`) |
|---|---|---|
| **Frage** | Wo im Verfahren steht der Vorgang? | Wer ist am Zug — oder ist es erledigt? |
| **Wirkt auf** | Verfahrensleiste, Filter-Gruppierung, Zieltage, Stillstands-Wächter, Fristlauf im Vorgangs-Board | Reiter, Abschnitte, Farben und Kanban-Lanes in *Förderanträge*, Gutachten-Karte am Verbund |
| **Wohnt in** | der Katalog-Fassung (`MappingVersion.zahPhasen`) | dem Code (`core/status/kategorie-ableitung.ts`) |
| **Ändert wer** | die PL im Baum-Editor der Vorgangs-Regeln | niemand zur Laufzeit |
| **Anzahl** | 3 bis 9, ausgeliefert 6 | fest 9 |

**Sie hängen seit v4.87 nicht mehr zusammen.** Beide führen vom amtlichen Code
weg, keine über die andere:

```
                        ┌→ Verfahrensschritt   (zahPhasen, kuratierbar)
Rohtext → amtlicher Code ┤
        (status-codes)   └→ Arbeitsliste       (CODE_ZU_ARBEITSLISTE, im Code)
```

Bis v4.86 stand der Verfahrensschritt **zwischen** Code und Arbeitsliste: jede
Phase trug eine `kategorieVorgabe`. Damit steuerte die bewegliche Achse die
feste — was das kostet, steht unten.

## Warum die eine beweglich ist

Der Phasenzuschnitt ist **strittig**. Die Abstimmung mit AB und FB hat ergeben,
dass er mehrfach geändert werden wird — ein Code-Release je Iteration ist dafür
zu langsam. Seit v2.409 ist er deshalb Fassungs-Daten: Anzahl zwischen 3 und 9,
Beschriftung frei, Zuordnung per Zug im Baum.

## Warum die andere fest ist

Die Arbeitsliste ist das, worauf die ABs **täglich** schauen. Wären beide Achsen
frei, könnte eine Iteration am Verfahrensschnitt nebenbei ganze Reiter leeren —
und niemand sähe den Zusammenhang. Zwei frei einstellbare Achsen mit
überlappenden Wörtern wären außerdem genau das Durcheinander, gegen das die
Umbenennung unten geschrieben ist.

Festgehalten von `status-category-not-curated`: **kein** Feld der Fassung trägt
eine `StatusCategory` — weder einzeln noch als Liste. Bis v4.86 verbot der
Wächter nur die Liste, und durch die verbliebene Tür lief der Schaden unten.

## Warum die Kopplung weg ist (v4.87)

Der Absatz darüber beschreibt einen Schaden, der am 05.08.2026 tatsächlich
eintrat — der Wächter stand nur an der falschen Tür. Er verbot der Fassung eine
**Liste** von Kategorien; verschoben wurde die Arbeitsliste aber über den
erlaubten Weg, den Phasenschnitt.

Die **Katalog-Fassung 19** löste die Phase „Vollständigkeit" auf und hängte ihre
Codes 33–37 an „Prüfung" — ein gewollter Schnitt (fünf statt sechs Phasen) aus
der AB/FB-Abstimmung. Weil `pruefung` die Arbeitsliste `in_pruefung` vorgab und
`snapshot.ts` die Kategorie aus Phase + Code neu rechnete, wanderten **448
Anträge** mit: „Wartet auf Antragsteller" fiel von 52 auf **0**, „Zu bearbeiten"
verlor rund 400 seiner Einträge. Niemand hatte das entschieden; es war die
Nebenwirkung einer Entscheidung über etwas anderes.

Zwei Dinge machten es unsichtbar:

- Die Reiter zeigten nichts, weil das Aggregat „Vor Entscheidung" `offen`,
  `in_pruefung` und `entscheidung` bündelt — die Verschiebung lief **innerhalb**
  eines Aggregats. Auffällig wurde nur, wo eine Kategorie allein steht.
- Der Anker für Code 35 hing an der Phasen-**Id** `'vollstaendigkeit'`. Mit der
  Phase verschwand er, ohne dass irgendwo etwas fehlschlug.

Gemeldet hat es am Ende der **Altanträge-Balken der Auslastung** (395 → 22
Teilvorhaben, bei 22 von 32 MAs ganz leer) — ein Modul, das die Kategorie nur
mitbenutzte.

Die Reparatur von v3.25 war eine **Ausnahmeliste**: sechs Codes bekamen ihre
Arbeitsliste direkt am Code. Sie nannte sich selbst „eine Untergrenze, kein
Ersatz" — also ein vierter Mechanismus neben der Kopplung statt ihrer
Abschaffung. Ein Jahr später stand dieselbe Frage wieder an, und die Antwort war
diesmal, etwas **wegzunehmen**:

- `kategorieVorgabe` ist entfallen. Die Ausnahmeliste ist vollständig geworden
  ([`CODE_ZU_ARBEITSLISTE`](../../src/core/status/kategorie-ableitung.ts), 26
  Codes + 4 Marker). Kein Phasenschnitt kann eine Arbeitsliste mehr bewegen.
- Der Wächter `status-category-not-curated` ist absolut: in `typen.ts` darf
  **kein** Fassungs-Typ ein Feld vom Typ `StatusCategory` führen, weder einzeln
  noch als Liste. Die Gegenprobe steht daneben — der Test
  *„ein anderer Phasen-Zuschnitt ändert KEINE einzige Arbeitsliste"* legt alle
  30 Codes auf eine einzige Phase und vergleicht vorher/nachher.
- Eine `kategorieVorgabe` aus einer Fassung vor v4.87 wird beim Lesen verworfen
  (`normalisiere` in `zah-phasen.ts`) — keine Migration nötig, und genau das ist
  der Gewinn: eine alte Fassung kann die Arbeitslisten nicht mehr verschieben.

**Die Lehre:** Ein Wächter, der einen Weg verbietet und einen zweiten offen
lässt, bewacht nichts. Und wo eine Kopplung wiederholt Schaden anrichtet, ist die
richtige Antwort, sie zu entfernen — nicht, sie abzufedern.

### Was die Umstellung an den Daten gefunden hat

Die Ankerwerte mussten aus einer der beiden Quellen kommen, und sie waren sich
uneinig: der ausgelieferte Seed (`prod`) und die gelebte Katalog-Fassung 23
(`pl`) ordneten **fünf Codes** verschieden ein. Gemessen an den drei
Import-Quellen (64 385 Zeilen):

| Code | Fassung 23 → | Seed → | STATUS_VB | STATUS_TV |
|---|---|---|---|---|
| 91 beendet | Begleitung | Erledigt | 2 187 | 806 |
| 32 ablehnungsreif | In Arbeit | Zu entscheiden | 457 | 138 |
| 90 abgebrochen | Begleitung | Erledigt | 25 | 6 |
| 75 Widerspruch z. Abl. | In Arbeit | Zu entscheiden | 19 | 18 |
| 72 Stellungnahme RNE | In Arbeit | Zu entscheiden | 13 | 43 |

Solange die Arbeitsliste an der Phase hing, konnte diese Uneinigkeit unbemerkt
bestehen — `prod` läuft ohne Fassung, `pl` mit. Am Code hängt sie an genau einer
Stelle, also musste entschieden werden. **Die Fassung hat gewonnen**: sie ist der
spätere, im Team abgestimmte Stand. Fachlich gelesen heißt das: nach „beendet"
(91) und „abgebrochen" (90) steht der Schlussvermerk (99) noch aus, der Vorgang
bleibt also im Arbeitsvorrat; „ablehnungsreif" (32) ist Arbeit, keine anstehende
Entscheidung — die Ablehnung muss erst geschrieben werden.

Für `pl` und `local` ändert sich dadurch nichts. `prod` zieht nach.

## Die Umbenennung von v2.409

Vier der neun Arbeitslisten hießen wortgleich wie ein Verfahrensschritt
(„Prüfung", „Entscheidung", „Begleitung", „Abgeschlossen"). Zwei Spalten
nebeneinander, halb dieselben Wörter, und keine sagte wozu — das liest jeder als
Widerspruch. Die Wortwahl folgt jetzt der Frage, die die Arbeitsliste
beantwortet:

| Schlüssel | Bezeichnung | Kurzform |
|---|---|---|
| `offen` | Zu bearbeiten | Zu bearb. |
| `in_pruefung` | In Arbeit | In Arbeit |
| `nachforderung` | Nachforderung läuft | Nachforderung |
| `entscheidung` | Zu entscheiden | Zu entsch. |
| `bewilligt` | Bewilligt | Bewilligt |
| `begleitung` | Begleitung | Begleitung |
| `abgelehnt` | Abgelehnt | Abgelehnt |
| `abgeschlossen` | Erledigt | Erledigt |
| `sonstige` | Ohne Zuordnung | Ohne Zuord. |

**Nachtrag v2.413.1:** `entscheidung` hieß zunächst „Entscheidungsreif". Das war ein
unschrumpfbares Einzelwort von 117 px und passte in die 170-px-Lanes des Kanban
nur mit Ellipse — abgekürzt las es sich wieder wie der Verfahrensschritt
„Entscheidung", also genau die Verwechslung, die v2.409 beseitigt hat. Die
Verbform „Zu entscheiden" bricht an der Wortgrenze (83 px, zweizeilig) und reiht
sich neben `offen` in dieselbe Frageform ein. Gemessen bei 1280 und 1024 px über
sieben Lanes: keine Bezeichnung kürzt mehr ab.

`begleitung` bleibt bewusst stehen, obwohl es mit einem Phasennamen kollidiert:
es ist das eingeführte Wort der Fachseite. Diese eine Dopplung wird
gegebenenfalls über die **Phasen**beschriftung aufgelöst — die ist beweglich.

Die Schlüssel im Datenmodell sind unverändert; nur die Anzeige heißt anders.

## Die abgeleiteten Achsen

*Förderanträge* zeigt die Arbeitslisten nicht einzeln, sondern in gröberen
Töpfen: eine 5er-Pille und sieben Abschnitte. Dafür gilt **eine** Regel:

- Was **1:1** einer Kategorie entspricht, erbt deren Namen
  (`getStatusCategoryLabel`). Kein zweites Vokabular.
- **Zusammenfassungen** bekommen einen eigenen Namen, der mit keiner
  Kategoriebezeichnung übereinstimmt. Ein Reiter „Zu bearbeiten", der drei
  Kategorien meint, von denen eine ebenfalls so heißt, wäre die Verwechslung nur
  eine Ebene höher.

| Abschnitt | Kategorien | Name | Art |
|---|---|---|---|
| `vor-entscheidung` | offen + in_pruefung + entscheidung | **Vor Entscheidung** | Aggregat |
| `nachforderung` | nachforderung | Nachforderung läuft | 1:1 |
| `bewilligt` | bewilligt | Bewilligt | 1:1 |
| `begleitung` | begleitung | Begleitung | 1:1 |
| `beendet` | abgeschlossen + abgelehnt | **Beendet** | Aggregat |
| `abgelehnt-zurueckgezogen` | Rohwert `abgelehnt/zurückgezogen` | Abgelehnt/Zurückgezogen | Rohwert-Schnitt |
| `ohne-zuordnung` | sonstige | Ohne Zuordnung | 1:1 |

Der Arbeitsvorrat/Archiv-Split des „Alle"-Reiters erbt: **Arbeitsvorrat**
(nicht-terminal) und **Beendet** — dieselbe Menge wie der gleichnamige Bucket,
also derselbe Name.

Festgehalten von `status-labels-single-source` (keine Kategoriebezeichnung als
Literal außerhalb der Einzelquelle) und `status-label-namensraeume-disjunkt`
(Aggregatnamen decken sich mit keiner Kategoriebezeichnung).

## Die dritte Beschriftung: der ROHSTATUS (v3.16)

Unter beiden Achsen liegt der rohe Statuswert aus dem Export — und der hatte
dieselbe Krankheit eine Ebene tiefer. Bis v3.16 führten **drei** Module ihre
eigene Kurzform desselben Werts: `STATUS_LABELS` (26 Paare),
`STATUS_LABEL_OVERRIDES` in der Suche (4 Paare, abweichende Schreibweise, ein
Tippfehler „Wiederspr.") und ein Literal im Arbeitsvorrat. Derselbe Status sah
je nach Ansicht anders aus, und die `STATUS_LABELS`-Fassung für Code 72 war auf
eine Schreibweise geschlüsselt, die im Produktivbestand gar nicht vorkommt — sie
hat dort **nie** gegriffen (29 Fälle).

Dieselbe Auflösung wie bei den Kategorien, nur mit einer Kurationsstufe mehr:

| Stufe | Wo | Wer pflegt |
|---|---|---|
| `fassung` | `StatusWertEintrag.kurzLabel` | die PL, je **Code** (`setzeKurzLabel`) |
| `katalog` | `StatusCodeEintrag.kurz` | wir, mit der Auslieferung |
| `ohne` | gekürzter Bezeichner + „…" | niemand — sichtbar unfertig |

Gelesen wird über **`statusKurzLabel()`** (enge Flächen) und **`statusLabel()`**
(Tooltip, Export, Prompt) aus [status-wert-labels.ts](../../src/core/utils/status-wert-labels.ts).
Zwei Eigenschaften unterscheiden das von der Kategorie-Fassade:

- **Je Schlüssel durchfallen**, nicht die ganze Map tauschen. Sonst nähme eine
  Fassung, die eine Schreibweise nicht führt, ihr die Kurzform weg — der Fehler,
  den `mitAmtlichenSchreibweisen` für die Kategorie beheben musste.
- **Kuratiert wird am CODE**, nicht an der Wert-Id: derselbe Code steht unter
  `status` UND `verbund_status`, und `snapshot.ts` kollabiert beide auf einen
  Schlüssel („letzter gewinnt"). Dieselbe Begründung wie bei `setzeCodePhasen`.

Die Kurzform ist **unsere** Beschriftung und deshalb groß geschrieben, wo `text`
amtlich klein ist (`bewilligt` → `Bewilligt`). Der Tooltip zeigt den amtlichen
Text — das ist kein Fehler, sondern die Trennung von Fremddaten und Kuration
(Pitfall #43). Wer die Schreibweise im Tooltip ändern will, pflegt das
kuratierte `label` am Statuswert.

Festgehalten von `status-kurzlabel-single-source` (Herkunft + Literal-Sperre) und
`label-identitaet.test.ts` (Snapshot-Pfad = eingebauter Pfad).

## Wer den Verfahrensschritt beschriftet (v4.3)

Dieselbe Einzelquelle-Regel gilt für die **obere** Achse, und sie fehlte bis v4.3.
Der Schnitt ist seit v2.409 kuratierbar — aber drei Stellen führten weiter ihre
eigene Kopie, und keine fiel auf:

- Die Handlungs-Formel „nächster Schritt" gab ein **drittes** Vokabular aus:
  „Fachprüfung" und „Nachforderung" waren in keiner Fassung ein Phasenlabel, und
  `bearbeitungsreif` stand dort unter „Eingang", laut Auslieferung aber unter
  „Vollständigkeit". Die Formel zeigt jetzt nur noch die **Handlung**; wer den
  Schritt sehen will, liest ihn an der Verfahrensleiste. Ohne hinterlegte
  Handlung steht dort die Status-Kurzform (`schrittText`).
  **Seit v4.132 ist sie nur noch der Rückfall** — siehe unten.
- Das **Vorgangs-Board** maß den Fristlauf an vier eingetippten Phasen-Ids statt
  an `fristLaeuft` der Phase. Es liest jetzt `fristLaeuftVon` — mit der
  Nebenwirkung, dass die Auslieferung die Uhr in der Entscheidung anhält (so war
  `fristLaeuft` von Anfang an gemeint, es kam nur nie an). Die PL steuert das je
  Phase im Baum-Editor.
- Die **Gutachten-Karte** am Verbund fragte zwei Phasen-Ids ab. Sie fragt jetzt
  die Arbeitsliste — „wer ist am Zug" ist genau deren Frage, und die steht im
  Code (`istGutachtenPhase`).

Festgehalten von **`zah-phase-single-source`**: in einer Datei, die überhaupt von
`zahPhase` spricht, ist weder eine feste Phasen-Id noch eine Phasen-Beschriftung
als Literal erlaubt. Ausgenommen sind die drei Auslieferungs-Seeds
(`zah-phasen.ts`, `seed-codes.ts`, `seed-kanonisch.ts`); alles andere braucht
`// allow-zah-phase-literal: <grund>` in derselben Zeile.

## Was ist zu tun? — eine Antwort, drei Leser (v4.132)

Die letzte doppelte Achse. Bis v4.131 beantworteten **zwei** Motoren dieselbe
Frage, und niemand sagte, welcher gerade sprach:

| | Motor | liest | wo sichtbar |
|---|---|---|---|
| A | `naechsterSchritt()` | eine 10-Zeilen-Tabelle über den **Rohstatus** + zwei PreCheck-Regeln | Startseite, Kanban, Tabellenspalte, Assistent |
| B | `ermittleTodo` / `ermittleTodosAlleRollen` | die 27-Regel-**Kaskade über die gesetzten Kürzel** samt Sperren, `zustaendig`, `wartetAuf` | Vorgangs-Board, Ausklapp, Verbund-Detail |

Motor A kennt die Kürzel nicht — und genau an ihnen sieht man, dass ein
Gutachten außerhalb der App geschrieben und abgegeben wurde. Gemessen am
Nachtexport vom 20.08.2026 über 845 offene Vorgänge:

| Befund | Zahl |
|---|---:|
| Status „Gutachten fertig" **mit** `D_AT4` + `D_AK4` → A sagte „Gutachten freigeben", B sagt „in QS" | **101 von 102** |
| Ablehnung/RNE versandt, keine Reaktion → B: „wartet auf Antragsteller" | 159 |
| PreCheck negativ offen → A sagte „PreCheck-Ergebnis klären"; davon mit bereits geschriebener Abl/RNE | 211 / davon **144** |
| Schlussvermerk gesetzt, `STATUS_TV` trotzdem offen → B sperrt (S0), A zeigte Rückstand | 3 |
| **Union der drei eindeutigen Töpfe** | **262 = 31 %** |

**B ist die Antwort, A der Rückfall.** Fünf Zustände, jeder nennt seine Herkunft
([aufgaben-anzeige.ts](../../src/core/status/aufgaben-anzeige.ts)):
`kaskade` (eine Regel des **eigenen** Satzes trifft) · `fremd` (nur ein fremder
Satz trifft, siehe unten) · `gesperrt` (kein To-do, aber eine Sperre — nur
gemeldet, wo sie nicht erwartbar ist, siehe `SPERRE_IST_ERWARTBAR`) ·
`rueckfall` (gar keine Regel trifft) · `laedt` (der Bestandslauf ist unterwegs).

Drei Festlegungen, die wichtiger sind als die Tabelle:

1. **Nie zwei Antworten hintereinander.** Solange gerechnet wird, steht „…" da
   und nicht der Rückfall — ein Text, der sich nach fünf Sekunden in einen
   anderen verwandelt, ist schlimmer als einer, der auf sich warten lässt.
2. **Nie unter den bisherigen Stand.** Wo die Kaskade nichts sagt, bleibt die
   alte Formel; der Rückfall verschwindet erst, wenn Regeln ihn ersetzen.
3. **Eine Rechnung, eine Ablage.** Der Bestandslauf lag bis v4.131 im
   Vorgangs-Board und war für die anderen unerreichbar. Er steht jetzt in
   [bestands-lauf.ts](../../src/core/status/bestands-lauf.ts), sein Ergebnis in
   [useBestandsAufgaben.ts](../../src/core/hooks/useBestandsAufgaben.ts) — mit
   demselben Schlüssel und derselben TTL wie vorher (Fassung · Bereich ·
   Bestands-Generation · Stichtag-TAG, 5 min). Wer ihn nur ergänzend braucht,
   stößt ihn im Leerlauf an und blockiert nicht.

**Die Faltung gibt sich zu erkennen.** Eine Verbundzeile wertet **je
Teilvorhaben** aus und faltet danach (`baueAufgabe`); tragen nicht alle dieselbe
Aufgabe, steht „3 von 4 TV" daneben.

### Schweigt der eigene Satz, wird der AB-Satz gelesen (v4.136)

Festlegung 2 („nie unter den bisherigen Stand") hatte eine Kehrseite, die erst
in der FB-Sicht sichtbar wurde: **für den FB schweigt die Kaskade fast immer**,
und dann sprach wieder Motor A. R19 („in QS") wartet auf die QS, R21 („GA
schreiben") ist die AB zuständig — keine der beiden nennt den FB, also greift
auch kein Leihweg ([vorgangssystem §11.2](vorgangssystem.md)). Von 19 offenen
Vorgängen mit Kürzel THü nannten so **17** wieder „Gutachten freigeben" bzw.
„Fachprüfung beginnen", also genau die Formel, die an 101 von 102 Vorgängen
widerlegt ist.

Deshalb liest `baueAufgabe` den **AB-Satz**, wenn der eigene nichts sagt, und
gibt das an: `Aufgabe.gelesenAls` trägt den Satz, aus dem der Text stammt.
Weicht er von `rolle` ab, ist die Anzeige `fremd`.

| | zeigt | Beispiel |
|---|---|---|
| `kaskade` | die eigene Aufgabe | CALYPSO · „Widerspruch gg Abl bearbeiten · liegt bei FB" |
| `fremd` | was läuft, und wer am Zug ist | AIWOOD · „in QS · wartet auf QS" |

Drei Regeln halten das ehrlich:

1. **Der eigene Treffer schlägt den fremden immer** — auch ein abgeleiteter
   Platzhalter, denn der nennt die eigene Rolle ausdrücklich.
2. **Eine greifende Sperre der eigenen Rolle geht vor.** Wo das Verfahren für
   sie geschlossen ist, wäre die fremde Aufgabe ein Rückschritt hinter ein
   Ergebnis, das die Kaskade schon hat.
3. **Der fremde Satz wird benannt**, nicht stillschweigend gelesen: der Ausklapp
   schreibt „Aufgabe · Regelsatz AB · nicht FB", die Zeile trägt die Adresse.

**Keine Graustufe als Träger.** Dass die Aufgabe einer anderen Rolle gehört,
sagt die Adresse in Worten („wartet auf QS"). Sie zusätzlich zu dämpfen wäre
`--tf-text-tertiary` = 2,62:1 gegen den hellen Grund, also unter AA — und in der
FB-Sicht beträfe das 17 von 19 Zeilen. Gedämpft bleibt allein `gesperrt`, wo
„Keine Aufgabe mehr" steht und nichts verloren geht.

**Erledigt mit v4.134** (war eine fachliche Frage, keine Code-Frage): die
Kategorie `nachforderung` hieß „Wartet auf Antragsteller", umfasst aber genau
EINEN Status — „NF gestellt" (bestandsweit 46 Vorgänge). Auf derselben
Bildschirmseite warteten zehn Vorgänge laut Kaskade auf den Antragsteller, ohne
in dieser Kategorie zu liegen; die Bahn stand auf 0 und widersprach den Karten
neben ihr. Sie heißt jetzt **„Nachforderung läuft"**. Die Bahnen an `wartetAuf`
zu hängen war die Alternative und ist verworfen: es bräche den Klickweg in die
Liste (er filtert nach Kategorie) und zählte Karten doppelt. **Wer wartet, sagt
die Kaskade je Zeile; wo im Verfahren der Vorgang steht, sagt die Kategorie** —
zwei Fragen, zwei Antworten, und der Kategoriename täuscht die zweite nicht mehr
vor.

## Der Verfahrensschnitt reist allein (v4.79)

Die beiden kuratierten Achsen — **Phasen** und **Kürzel** — ändern sich in ganz
verschiedenem Takt. Der Schnitt steht monatelang; an den Kürzeln wird laufend
gearbeitet. Bis v4.78 gab es trotzdem nur einen Transportweg, und der nahm immer
beides mit: `exportiereVersion` / `validiereImport` sowie „Als Entwurf laden" im
Versions-Panel arbeiten auf der ganzen `MappingVersion`.

Das fiel auf, als es schiefging: ein neu aufgesetzter Rechner lud nicht die
jüngste Fassung, auf diesem Stand wurden viele Kürzel gepflegt und
veröffentlicht — die live geltende Fassung trug danach die richtigen Kürzel und
den zurückgefallenen Schnitt. Eine ältere Fassung zu laden hätte die Phasen
zurückgeholt und die Kürzel-Arbeit verworfen.

Seither ist die Phasen-Achse ein eigenes Gepäckstück
([phasen-paket.ts](../../src/core/status/phasen-paket.ts)):

| Im Paket | Nicht im Paket |
|---|---|
| Die Phasenliste (`zahPhasen`) vollständig | Kürzel-Stammdaten (Bezeichnung, Rollen, Ordner, Relevanz) |
| Code → Phase, je Code einmal, `null` = Marker | Kategorien / Ordnerbaum |
| Kürzel → Phase, nur das Feld `zahPhaseId` | `kurzLabel`, `prominenz`, `aktiv` |
| Zieltage je Code (nur gesetzte) | To-do-Regeln, Textbausteine, Betrachtungsbereich, Trigger |

Vier Festlegungen, die dabei wichtiger sind als die Liste selbst:

1. **Der Schlüssel ist der Code bzw. die `feldId`, nie die Wert-Id.** `wertId()`
   ist `${feldId}::${normalisiert(wert)}`; weicht die Schreibweise eines Rohwerts
   zwischen zwei Installationen ab, liefe ein Id-Abgleich ins Leere.
2. **Merge, kein Rundumschlag.** Das Paket ist eine Aussage über die Einträge,
   die es nennt. Was es nicht nennt, bleibt; was das Ziel nicht kennt, wird
   gemeldet statt angelegt — ein Paket erzeugt keine Katalogzeilen.
3. **Nur ausdrückliche Aussagen reisen.** Ein Statuswert ohne `zahPhaseId`
   (`undefined` = „hat noch niemand entschieden") kommt nicht ins Paket; sonst
   würde am Zielort aus einer offenen Frage eine Antwort. `null` dagegen ist
   gepflegt und reist mit. Ebenso wenig reist eine **verwaiste** Zuordnung — dazu
   unten.
4. **Alles oder nichts.** Grenzverletzung (`pruefeZahPhasen`) oder ein Paket, das
   Einträge Phasen zuordnet, die es selbst nicht führt ⇒ es wird *nichts*
   angewendet. Ein halb übernommener Schnitt sähe gepflegt aus und wäre verwaist.

### Verwaiste Zuordnungen: getragen, nicht verboten (v4.79.1)

Die erste Fassung des Pakets brach an einer echten Katalogfassung ab: v21 führte
fünf Phasen, aber drei Datums-Kürzel zeigten noch auf die entfernte
`vollstaendigkeit`. Das Paket erklärte sich daraufhin für in sich widersprüchlich
— an einem Zustand, den die App an jeder anderen Stelle ausdrücklich trägt
(`verwaisteZuordnungen`: „gelesen wie *ohne Phase*, nicht stillschweigend
umgeschrieben"). Eine Regel, die einen normalen Katalogzustand wie einen
Formatfehler behandelt, ist die falsche Regel.

Seither gilt: **ein Verweis ins Leere ist keine Aussage.** `bauePhasenPaket`
nimmt ihn gar nicht erst auf — er wäre wertlos und schädlich zugleich, weil er
einen toten Verweis in eine Fassung trüge, in der derselbe Eintrag vielleicht
sauber zugeordnet ist. Der Abbruch-Guard bleibt und trifft jetzt nur noch von
Hand verbogene Dateien.

Die Gegenrichtung braucht dafür eine Meldung: weil die Phasenliste **ersetzt**
wird, können im Ziel neue Verwaiste entstehen — dort, wo es Einträge an einer
Phase führt, die das Paket abschafft, und das Paket zu deren Codes nichts sagt.
Auch das ist kein Abbruchgrund, aber `uebernimmPhasen` zählt es am Ergebnis und
der Satz sagt es, statt es der Kuratorin drei Klicks später im Kopf des
Katalog-Tabs zu überlassen.

Bedienung: **„Phasen exportieren" und „Phasen importieren"** stehen als Paar
neben dem Ansichtsumschalter im Reiter „Statuswerte", also dort, wo der Schnitt
gepflegt wird. Ohne Dateiweg geht es über **„Nur Phasen übernehmen"** je Zeile im
Versions-Panel (Fassung aus IDB oder Archiv).

**Eine Weiche, zwei Beschriftungen** (v4.85.5). Es gibt nur EINEN Import: die
Datei trägt die Marke `art: "zah-phasen"` und sagt selbst, was sie ist, also
nimmt der vorhandene „Importieren"-Knopf im Seitenkopf beide Formate. Genau
deshalb stand hier zuerst kein zweiter Knopf — und genau deshalb suchte der
erste Nutzer vergeblich nach dem Gegenstück zu „Phasen exportieren". Ein Knopf
ohne sichtbares Gegenstück schickt Monate später jemanden auf die Suche nach
einer Funktion, die es nur unter anderem Namen gibt. `PhasenAustausch` ruft
daher dieselbe `api.importieren()` wie der Seitenkopf: die Logik bleibt eine, die
Beschriftung steht dort, wo gesucht wird.

Angewendet wird auf den **Entwurf**, nicht auf den Team-Stand: die Speicherleiste
bleibt das Gate, „Als Entwurf laden" der Rückweg. Statt einer Rückfrage davor
steht ein Ergebnissatz danach, und zwar in der Grammatik der Katalog-Bilanz
(`driftSatz` über *nachher* gegen *vorher*, nicht über die Auslieferung):

> Phasen aus v16 übernommen: 1 Phase entfernt · 2 umbenannt · 10 Zuordnungen
> geändert · 22 Zieltage gepflegt.

Am echten Katalog gemessen (v21 → v22): 5 Phasen, 26 Code-Zuordnungen, 40
Kürzel-Zuordnungen und 22 Zieltage im Paket; davon geändert 10 Codes, 10 Kürzel,
22 Zieltage — bei 5 danach verwaisten Zuordnungen und allen 509 Kürzeln
byte-gleich. Das Paket wiegt 3,7 KB gegen 152,8 KB Voll-Export.

### Der Export nimmt, was auf dem Bildschirm steht (v4.86.1)

Beide Exporte dieser Seite lasen bis v4.86.0 die **gespeicherte** Fassung
(`aktiveVersion`), während der Baum daneben den **Entwurf** zeigt. Bei
ungesichertem Stand lieferten sie damit etwas anderes aus als das, worauf der
Nutzer sah — und zwar lautlos: „Phasen exportieren" schrieb den alten Schnitt in
die Datei, der Import am Zielort meldete korrekt Erfolg, und die Kuratierung war
trotzdem nicht angekommen. Zwei Symptome („der Export geht nicht", „der Import
tut nichts"), eine Wurzel.

Seither gilt: **exportiert wird der Entwurf.** Zwei Gründe, unabhängig
voneinander:

1. Ein Export, der etwas anderes ausliefert als die Seite zeigt, ist kein Export,
   sondern eine Falle.
2. Wo niemand speichern darf (`darfSchreiben === false`), gäbe es sonst gar
   keinen Weg, den gesehenen Stand aus der Installation herauszubekommen.

Damit der Name nicht lügt, trägt eine Datei mit ungespeichertem Stand `-entwurf`
(`status-phasen-v22-entwurf.json`, `exportDateiname` in
[katalogExport.ts](../../src/plugins/status-cockpit/katalogExport.ts)) — die
Fassungsnummer allein wäre eine Zusage, die der Inhalt nicht hält.

## Wo was steht

| Was | Wo |
|---|---|
| Die neun Bezeichnungen + Farben | [status-category-labels.ts](../../src/core/utils/status-category-labels.ts) |
| Die Rohstatus-Beschriftung (kurz + voll) | [status-wert-labels.ts](../../src/core/utils/status-wert-labels.ts) |
| Die ausgelieferten Kurzformen | [status-codes.ts](../../src/core/status/status-codes.ts) |
| Die Kategorie-Achse selbst | [status-canonical.ts](../../src/core/utils/status-canonical.ts) |
| Die Phasen-Tabelle + das Register | [zah-phasen.ts](../../src/core/status/zah-phasen.ts) |
| **Die Aufgabe eines Vorgangs** (die Antwort) | [aufgabe.ts](../../src/core/status/aufgabe.ts) + [aufgaben-anzeige.ts](../../src/core/status/aufgaben-anzeige.ts) |
| Der Bestandslauf + seine Ablage | [bestands-lauf.ts](../../src/core/status/bestands-lauf.ts) + [useBestandsAufgaben.ts](../../src/core/hooks/useBestandsAufgaben.ts) |
| Die Handlung „nächster Schritt" (nur der **Rückfall**) | [naechsterSchritt.ts](../../src/core/utils/naechsterSchritt.ts) |
| Grenzen, Umhängen, Verwaiste | [zah-phasen-edit.ts](../../src/core/status/zah-phasen-edit.ts) |
| Der Schnitt als transportables Paket | [phasen-paket.ts](../../src/core/status/phasen-paket.ts) |
| **Code → Arbeitsliste** (die eine Tabelle) | [kategorie-ableitung.ts](../../src/core/status/kategorie-ableitung.ts) |
| Die sieben Abschnitte | [antragGroups.ts](../../src/plugins/antraege/antragGroups.ts) |
| Der Baum-Editor | [PhasenBaum.tsx](../../src/plugins/status-cockpit/PhasenBaum.tsx) |
| Die Ebenen-Übersicht mit Live-Zahlen | [ebenenModell.ts](../../src/plugins/status-cockpit/ebenenModell.ts) + [EbenenUebersicht.tsx](../../src/plugins/status-cockpit/EbenenUebersicht.tsx) |
| Die zwei Fristsysteme in einer Liste | [fristAnlaesse.ts](../../src/plugins/home/widgets/fristAnlaesse.ts) |
| Die Kürzel-Ebene (509 Codes, Ordner, Rollen, Ruhe) | [KATALOG-CODES.md](../status-system/KATALOG-CODES.md) |
| Die Meilenstein-Ebene | [meilensteine.md](meilensteine.md) |

## Ids statt Namen als Schlüssel

Die Abschnitte werden über eine stabile `id` gekeyt, nicht über ihren
Anzeigenamen. Vorher standen die Namen selbst im `localStorage` (Zuklapp-Zustand
je Abschnitt), samt einer Migration, die beim Hinzukommen eines Abschnitts
nachrüstete — Namen als Schlüssel zu führen war die eigentliche Ursache dieser
Migration.

Der Umstieg lief **ohne** Migration: alte Einträge tragen Namen, die keiner Id
entsprechen, und werden beim Lesen verworfen. Der gespeicherte Zuklapp-Zustand
ging damit einmalig verloren.

## In `prod`

`statusCockpit` ist in `dev`, `pl`, `kurator`, `as` und `local` an — nur `prod`
läuft ohne Fassung. Dort gilt der ausgelieferte Phasenschnitt aus
`SEED_ZAH_PHASEN`, und die Kategorie-Ableitung läuft über die eingebaute
`CATEGORY_MAP`. Ein kuratierter Schnitt kommt dort über den nächsten Release an;
bis dahin verhält sich `prod` exakt wie vor v2.409 (`byte-identitaet`).
