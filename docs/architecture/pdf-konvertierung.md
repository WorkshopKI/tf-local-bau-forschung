# PDF → Markdown: die Leiter

**Warum es dieses Doc gibt**: 99 % der Dokumente, die ein Bearbeiter hochlädt, sind
PDFs. Alles, was die App danach mit einem Antrag tut — Aufbereitung, Gliederung,
Fundstellen, Relevanz-Map, Gutachten —, liest das Markdown, das hier entsteht.
Die Konvertierung ist **eine** Stelle ([converter/](../../src/core/services/converter/));
was sie verliert, ist überall verloren.

## Der Befund (24.08.2026)

Gemessen an den drei synthetischen Anträgen (`_reference/fzd-synthetische-antraege/`,
je als DOCX, PDF und — aus Word heraus erzeugt — als Referenz-Markdown):

| | PDF, bis v6.27 | PDF, ab v6.28 | Referenz-MD |
|---|---|---|---|
| Überschriften | **0 / 0 / 0** | 46 / 48 / 45 | 46 / 47 / 44 |
| Listenzeilen | 0 / 0 / 0 | 198 / 70 / 47 | 178 / 62 / 47 |
| `parseVbGliederung` | 40 / 45 / 47 | 47 / 49 / 46 | 47 / 48 / 45 |
| `parseVbHeadings` | **1 / 1 / 1** | 32 / 34 / 31 | 32 / 34 / 31 |

Die letzte Zeile war die teuerste: [`parseVbHeadings`](../../src/plugins/antraege/gutachten/relevanz-map.ts)
nimmt ausschließlich `^#{2,3}` und hat keine Nummern-Inferenz. Auf einem
PDF-Antrag fand sie **eine** Sektion („(Einleitung)") — die Relevanz-Map des
Gutachtens kostete einen LLM-Lauf und konnte nie etwas eingrenzen.
[`parseVbGliederung`](../../src/plugins/antraege/aufbereitung/gliederung.ts) überlebte
nur, weil sie Kapitelnummern im Fließtext erkennt.

**Die Ursache war nicht das PDF.** Alle drei tragen einen vollständigen Tag-Baum
(`H1`, `H2`, `P`, `L`/`LI`, `Table`/`TR`/`TH`/`TD`, teils `TOC`/`TOCI`) — Word setzt
ihn beim „Speichern unter → PDF" standardmäßig. Der Konverter las nur
`getTextContent()` (Zeichen + Position) und warf ihn weg.

## Die drei Sprossen

`leseAllePdfSeiten` ([index.ts](../../src/core/services/converter/index.ts)) probiert
sie in dieser Reihenfolge und schreibt das Ergebnis als `report.pdfStruktur`
sowie ins Frontmatter (`struktur:`).

### 1 · `strukturiert` — der Tag-Baum

[pdf-struktur.ts](../../src/core/services/converter/pdf-struktur.ts). `getStructTree()`
liefert den Baum, `getTextContent({ includeMarkedContent: true })` streut Marker
mit **Marked-Content-Ids** zwischen die Textstücke; die Ids verbinden beides. Ein
Lauf je Seite reicht für Sprosse 1 **und** die Fragmente der Sprossen 2/3.

Drei Eigenschaften, die nicht offensichtlich sind:

- **Kopf- und Fußzeilen sind Artefakte** und stehen nicht im Baum — sie fallen von
  selbst weg. Bisher stand die Kopfzeile auf jeder Seite mitten im Fließtext.
- **Die Knoten-Identität trennt Blöcke**, nicht die Rolle: zwei aufeinanderfolgende
  `P` bekommen verschiedene Laufindizes und verschmelzen dadurch nicht.
- **Das Inhaltsverzeichnis wird zur Liste.** Als blanke Zeilen gesetzt liest die
  Gliederungs-Erkennung jede IHV-Zeile als eigenes Kapitel (gemessen: 59 statt 47
  Sektionen). Erkannt wird es auf zwei Wegen, weil Word beide erzeugt: als
  `TOC`/`TOCI` **oder** als Absatz, dessen Text vollständig in einem `Link` steht
  (`imLink`). Ein Absatz mit einem Link *darin* bleibt Absatz.

**Gültigkeits-Schranke**: teilgetaggte PDFs liefern einen Baum, der nur ein paar
Absätze kennt. Trägt der Baum weniger als `MIN_STRUKTUR_ANTEIL` (0,6) des
Flattextes, oder findet er keine einzige Überschrift, geht es eine Sprosse tiefer.

### 2 · `geschaetzt` — Schriftgrößen

[pdf-ueberschriften.ts](../../src/core/services/converter/pdf-ueberschriften.ts).
Ein ungetaggtes PDF weiß nicht, was eine Überschrift ist; sichtbar ist sie
trotzdem. Die Skala wird über **alle** Seiten ermittelt (eine Seite ohne
Überschrift hätte sonst ihre eigene, falsche).

Drei Leitplanken, jede aus einer Messung:

- Grundgröße = die **zeichenstärkste** Größe, nicht die häufigste Zeile — sonst
  gewinnt eine dreißigzeilige Kopfzeile gegen den Fließtext.
- Umbrochene Überschriften werden wieder zusammengesetzt
  ([pdf-tables.ts](../../src/core/services/converter/pdf-tables.ts), `istFortsetzung`);
  ohne das stand „mit zugehörigem Lösungsweg" als eigenes Kapitel in der
  Gliederung (58 statt 44 Treffer).
- Über 25 % Trefferquote gilt das Signal als unbrauchbar und die Skala bleibt
  **leer**. Lieber keine Gliederung als eine falsche.

Am echten Bestand (die drei PDFs künstlich auf Sprosse 2 gezwungen): 46 / 48 / 31
Überschriften gegen 44 / 47 / 46. Das dritte Dokument setzt seine Unterkapitel zu
nah an der Grundgröße — die ehrliche Grenze einer Größen-Heuristik, und der Grund,
warum diese Sprosse im Bericht „geschätzt, bitte prüfen" heißt.

### 3 · `flach` — nur Text

Verhalten wie bis v6.27. Neu ist, dass der Bericht es **sagt**: „ALLE Überschriften
sind verloren — die KI sieht das Dokument als einen Block", dazu der Umweg über den
PDF-Client (`DOCX_UMWEG_MELDUNG`). Alle Mitarbeiter haben Kofax; PDF → DOCX → Upload
liefert die Gliederung immer vollständig.

## Was der Bericht sagt

`report.pdfStruktur` + eine Meldung je Sprosse
([conversion-report.ts](../../src/core/services/converter/conversion-report.ts)),
sichtbar unter „Konvertierung prüfen"
([KonvertierungReviewDialog.tsx](../../src/core/components/KonvertierungReviewDialog.tsx)):

| Sprosse | Stufe | Zeichen | Umweg-Hinweis |
|---|---|---|---|
| `strukturiert` | `gut` | ✓ grün | nein |
| `geschaetzt` | `hinweis` | ! gelb | ja |
| `flach` | `warnung` | ✕ rot | ja |

`gut` ist eine dritte `ConversionLevel`-Stufe, keine Warnung: eine Zusicherung mit
Warndreieck wäre eine Falschaussage. `maxConversionLevel` ordnet
`warnung` > `hinweis` > `gut` > `null`, damit eine grüne Meldung nie eine Zeile
alarmiert.

Bei **0 Zeichen** schweigt der Bericht über die Gliederung — dann ist der fehlende
Text das Problem (gescanntes PDF → OCR), nicht die Struktur.

## DOCX ist der Maßstab, nicht der Notnagel

Gegen das aus Word erzeugte Referenz-Markdown ist der DOCX-Weg (mammoth + turndown)
**strukturtreu**: 46/46, 47/47, 44/44 Überschriften, Tabellenzeilen exakt. Wer die
Wahl hat, lädt DOCX hoch. Die Leiter existiert, weil die Bearbeiter sie meistens
nicht haben.

## Wenn hier etwas geändert wird

- `pdf-struktur.ts` und `pdf-ueberschriften.ts` sind **rein** und tragen eigene,
  minimale Typen statt pdf.js-Typen — sie sind ohne echtes PDF unter Vitest prüfbar
  und sollen es bleiben.
- Neue Heuristik ⇒ **erst messen, dann setzen**: die Zahlen oben stammen aus einem
  Lauf des echten `DocConverter` im laufenden Dev-Server gegen die drei
  synthetischen Anträge, nicht aus einem Nachbau.
- Die Schwellen (`MIN_STRUKTUR_ANTEIL`, `FAKTOR`, `MAX_ANTEIL`) stehen als
  benannte Konstanten mit der gemessenen Begründung daneben.
