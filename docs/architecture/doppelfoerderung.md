# Doppelförderung — gemeldete Vorhaben gegen den Bestand halten

Zweimal im Monat kommt eine Excel-Liste gemeldeter Forschungsvorhaben zur
Frühkoordinierung. Sie muss inhaltlich gegen die im ZIM geförderten und
beantragten Vorhaben gehalten werden — Ziel ist die Vermeidung inhaltlicher
Doppelförderung und die Koordinierung gleichgerichteter Forschungsbestrebungen.

Flag `doppelfoerderung` (**dev + pl**), zusätzlich **Beta** im
[Sichtbarkeits-Katalog](sichtbarkeitsstufen.md). Code:
[src/plugins/doppelfoerderung/](../../src/plugins/doppelfoerderung/).

---

## 1. Der Weg durch die Seite

```
XLSX  →  Zeilen + Betragsfilter  →  je Zeile 3 Schlagworte (interne KI)
                                          ↓
                          Wortlaut-Stufe (3 Läufe, je 1 Schlagwort)
                          Ähnlichkeits-Stufe (1 Embedding je Zeile)
                                          ↓
                     Befunde mit Abdeckung  →  Urteil an der Schwelle
```

Der Einstieg ist der ⋯-Menüpunkt im Kopf der Suchseite
([SuchAktionenMenu.tsx](../../src/plugins/suche/SuchAktionenMenu.tsx)); die Seite
selbst steht nicht in der Navigation (`hideFromNav`), ihre Route bleibt aber
registriert.

## 2. Die Zahlen, an denen der Entwurf hängt

**Gemessen in der laufenden App** gegen den echten Bestand (14.225 Anträge,
23.08.2026) — nicht in einem Node-Skript daneben. Der Unterschied ist nicht
akademisch: eine erste Messung, die nur Verbundtitel, Titel und Kurzfassung
durchsuchte, kam auf ein Fünftel der Trefferzahlen. Die echte Wortlaut-Stufe
sucht in weit mehr Feldern (Deskriptoren, Akronym, Organisation, Netzwerk,
Notiz …) und mit Wortstamm-Varianten. Wer die Schwellen an einer Näherung
kalibriert, kalibriert sie falsch.

### Betrachtungsbereich

| Achse | verbleibend |
|---|---|
| alle drei zusammen | **4.327** von 14.225 |
| nur Jahresachse (Antrag ab 2021) | 6.365 (4 Anträge ohne Datum) |
| nur Phasenachse (1/2/3/5) | 13.593 |
| nur Statusachse | 10.131 (4.094 abgelehnt/zurückgezogen fallen) |

### Wie weit ein einzelnes Schlagwort trifft (im Bereich von 4.327)

| Wort | Treffer | Anteil |
|---|---|---|
| Entwicklung | 3.235 | 74,8 % |
| Technologie | 3.065 | 70,8 % |
| KI | 1.569 | 36,3 % |
| Sensor | 1.055 | 24,4 % |
| Künstliche Intelligenz | 1.046 | 24,2 % |
| Innovation | 347 | 8,0 % |
| Digitalisierung | 177 | 4,1 % |
| Mittelstand | 31 | 0,7 % |
| Cybersicherheit | 6 | 0,1 % |
| Mobile Fabrik | 2 | 0,0 % |

Aus dem Lauf über die 72er-Liste kamen sieben weitere Sammelbegriffe dazu — sie
klingen fachlich, benennen aber die Branche oder die Methodenfamilie:

| Wort | Treffer | Anteil | im Verbot |
|---|---|---|---|
| Automatisierung | 852 | 19,7 % | ja |
| Maschinenbau | 672 | 15,5 % | ja |
| Medizintechnik | 353 | 8,2 % | ja |
| Additive Fertigung | 343 | 7,9 % | ja |
| Logistik | 105 | 2,4 % | ja |
| Maschinelles Lernen | 86 | 2,0 % | ja |
| Demonstrator | 82 | 1,9 % | ja |
| Kreislaufwirtschaft | 76 | 1,8 % | nein — benennt eine Sache |
| Robotik | 48 | 1,1 % | nein — benennt eine Sache |
| Qualifizierung | 35 | 0,8 % | nein |
| Computer Vision | 14 | 0,3 % | nein |

Der Schnitt für die Marke „zu weit" in der Oberfläche liegt bei **1 %** des
Bereichs und ist damit weiter als das Verbot: „Kreislaufwirtschaft" darf ein
Schlagwort sein, aber der Nutzer sieht, dass es 76 Vorhaben trägt.

### Was die Schwelle bewirkt

| Trio der ersten Beispielzeile | ODER | ≥2 von 3 | alle 3 |
|---|---|---|---|
| weit: Digitalisierung / Künstliche Intelligenz / Mittelstand | **1.150** | **103** | **1** |
| eng: Mobile Fabrik / Demonstrationsinfrastruktur / Erfolgskontrolle | **2** | 0 | 0 |

Drei Läufe über 4.327 Einträge kosten zusammen rund 18 ms; eine ganze Zeile mit
beiden Stufen 145 ms (45 Zeilen am Stück in 6,5 s, WebGPU). Die Wartezeit einer
Prüfung liegt vollständig beim KI-Lauf.

### An einer ganzen Liste nachgemessen (23.08.2026)

Alle **45** Meldungen über der Betragsschwelle aus `Auszug_72_Zeilen_ 20260818`,
Schlagworte von Hand formuliert (die interne KI war nicht erreichbar), gefahren
durch den echten Suchpfad:

| Regler | Zeilen mit „Übereinstimmung" |
|---|---|
| 1 von 3 (das reine ODER der Anforderung) | **40 von 45** |
| 2 von 3 (Vorbelegung) | **10 von 45** |
| 3 von 3 | **0 von 45** |

Damit ist die Vorbelegung belegt — und zugleich zeigt der Lauf **zwei Grenzen**:

1. **Die dritte Reglerstufe ist an echten Listen leer.** Sie bleibt als
   Grenzfall stehen, aber sie ist keine „schärfere Prüfung", sie ist Stille.
2. **Die Abdeckung zählt Schlagworte, sie wiegt sie nicht.** Bei „2 von 3"
   trifft sie vor allem die Zeilen, deren Abdeckung an einem Sammelbegriff hängt
   (Automatisierung 852 Vorhaben, Maschinenbau 672, Medizintechnik 353, Additive
   Fertigung 343) — während eine Zeile mit einem einzigen, sehr engen Treffer
   („Wasserstoffversprödung", 2 Vorhaben; „Kryogener Wasserstoff", 2) als „keine
   Übereinstimmung" durchfällt, obwohl gerade sie den Blick lohnt.

Gegen (2) wirken zwei Dinge, beide ohne Änderung am Urteil: die sieben
nachgemessenen Sammelbegriffe stehen jetzt in der Verbotsliste des Prompts, und
jedes Schlagwort trägt in der Ergebniszeile seine Trefferzahl, ab einem Prozent
des Bereichs zusätzlich die Marke **„zu weit"**
([`WORT_ZU_WEIT_ANTEIL`](../../src/plugins/doppelfoerderung/services/abgleich.ts)).
Die Trefferliste steht in jeder Zeile offen, auch wenn das Urteil nein sagt.

**Warum das den Entwurf bestimmt:** Die Anforderung nennt eine ODER-Verknüpfung
der drei Schlagworte. Rein umgesetzt läge das Urteil „Übereinstimmung" bei fast
jeder Zeile an — 1.150 Treffer sind ein Viertel des Bereichs, also Rauschen und
keine Warnung. Deshalb trägt jeder Treffer seine **Abdeckung** (wie viele der
drei Schlagworte er führt), und die Schwelle steht auf 2. Das reine ODER bleibt
über den Regler erreichbar.

Die zweite Zeile der letzten Tabelle sagt aber ebenso deutlich: **die Schwelle
rettet ein schlechtes Schlagwort, sie macht kein gutes überflüssig.** Ein
spezifisches Trio steht schon ODER-verknüpft bei 2 Treffern. Deshalb steckt die
eigentliche Arbeit im Prompt, nicht im Regler.

## 3. Die Bausteine

| Datei | Verantwortung |
|---|---|
| [liste-lesen.ts](../../src/plugins/doppelfoerderung/services/liste-lesen.ts) | XLSX → Zeilen; Kopfsuche nach Namen, Betragsparser, Dreiteilung an der Schwelle |
| [schlagworte.ts](../../src/plugins/doppelfoerderung/services/schlagworte.ts) | Prompt + Parser, rein |
| [schlagworte-lauf.ts](../../src/plugins/doppelfoerderung/services/schlagworte-lauf.ts) | der eine KI-Aufruf je Zeile |
| [bereich.ts](../../src/plugins/doppelfoerderung/services/bereich.ts) | die drei Bereichs-Prädikate |
| [abgleich.ts](../../src/plugins/doppelfoerderung/services/abgleich.ts) | beide Suchstufen, Abdeckung, Urteil |
| [export.ts](../../src/plugins/doppelfoerderung/services/export.ts) | XLSX, eine Zeile je Meldung × Treffer |
| [useDoppelfoerderung.ts](../../src/plugins/doppelfoerderung/useDoppelfoerderung.ts) | Phasen, Fortschritt, Abbruch |

## 4. Spalten der Zuarbeit

Die Anforderung nennt sie mit Buchstaben (F = Thema, P = Aufgabenbeschreibung,
U = Bundesmittel), und an der Beispieldatei stimmen sie. Gelesen wird trotzdem
**nach Überschrift** über
[xlsx-tabelle.ts](../../src/core/status/import/xlsx-tabelle.ts): eine Zuarbeit
aus einem fremden Haus ändert zwischen Fassungen ihre Spaltenreihenfolge, und
ein Import auf festen Indizes liest dann klaglos die falsche Spalte — der
schlimmste Fehlermodus, weil er wie ein Erfolg aussieht. Pflichtspalten sind
Thema, Aufgabenbeschreibung und Bundesmittel (Alias „Zuwendung"); passt kein
Kopf, nennt die Meldung die gefundenen Überschriften.

**Beträge raten nicht.** `leseMappe` liefert formatierte Strings; in der
Beispieldatei steht dort `1850000` neben `899650.65`, in einer anderen Fassung
kann `1.850.000,00 €` stehen. Der Punkt ist mal Tausender-, mal Dezimaltrenner —
`parseGeldbetrag` entscheidet das an der Form der Zahl und gibt `null` zurück,
wo keine Entscheidung möglich ist. Solche Zeilen fallen **nicht** still unter die
Schwelle, sondern erscheinen als eigene, zuschaltbare Gruppe.

## 5. Der Betrachtungsbereich

Die drei Achsen aus dem Satz „abgeschlossene, bewilligte und beantragte
FuE-Vorhaben, Netzwerke und Studien der letzten 5 Jahre". Sie sind ein
**expliziter Parameter**, kein stiller Filter im Daten-Layer (Pitfall #46), und
stehen als Chips im Kopf der Aufnahme.

- **Zeit** — Antragsdatum ab heute − 5 Jahre. Ein Antrag **ohne** Datum bleibt
  drin: eine Lücke in den Stammdaten ist kein Beleg dafür, dass das Vorhaben alt
  ist. Gleiches gilt für die Phase.
- **Art** — `VB_PHASE` ∈ {1 NW1, 2 NW2, 3 FuE, 5 Studie}. Dienstleistung (4)
  nennt die Anforderung nicht, Irrläufer (9) sind kein Vorhaben.
- **Stand** — über **`isAbgelehntZurueckgezogenStatus`**, nicht über
  `getStatusCategory(...) === 'abgelehnt'`.

> **Die Falle beim Status.** Die Kategorie `abgelehnt` ist vom Förder-Katalog
> seit v4.87 **unbesetzt**: der amtliche Wert `abgelehnt/zurückgezogen` landet in
> `abgeschlossen`, weil er fachlich ein Endzustand ist. Ein Vergleich gegen
> `'abgelehnt'` liefe still ins Leere und liesse alle 4.094 abgelehnten Vorhaben
> im Bereich stehen — ohne Fehlermeldung, nur mit falschen Zahlen. Nicht
> betroffen sind „Ablehnung" (Kategorie `entscheidung`, 110) und
> „ablehnungsreif" (`in_pruefung`, 53): dort ist noch nichts entschieden.
> Festgehalten in `bereich.test.ts`.

## 6. Schlagworte

Ein KI-Lauf **je Zeile** über `fuehreEinSchussLauf`
([ein-schuss-lauf.ts](../../src/core/services/ai/ein-schuss-lauf.ts)) — damit
gelten dessen sechs Pflichten, darunter der frische Chat vor jedem Submit
(Pitfall #36) und der ausschliesslich interne Transport (Pitfall #30). Der Reset
je Zeile ist hier kein Aufwand, sondern die Bedingung: in einer Meldungsliste
stehen zehn Teilvorhaben desselben Verbunds untereinander, und Zeile 7 darf die
Schlagworte von Zeile 6 nicht erben.

Der Prompt **benennt die verbotenen Allerweltswörter** statt „sei spezifisch" zu
sagen, mit der gemessenen Begründung („‚KI' allein trifft 23 % aller Vorhaben").
Der Parser siebt sie **nicht** nach: stünden in der Zeile plötzlich zwei statt
drei Wörter, sähe der Nutzer nicht, warum. Er sieht stattdessen an jedem
Schlagwort-Chip dessen Trefferzahl und kann es überschreiben — das rechnet nur
die Wortlaut-Stufe dieser Zeile neu, ohne neuen KI-Lauf.

## 7. Die beiden Suchstufen

**Wortlaut** — ein `searchAntraegeSubstring` **je Schlagwort**, nicht ein
ODER-Lauf über alle drei. Die Vereinigung ist dasselbe, aber nur die getrennten
Läufe sagen, WELCHE Schlagworte einen Treffer getragen haben, und genau das ist
die Zahl, an der das Urteil hängt. Der Korpus wird einmal je Lauf auf den
Betrachtungsbereich geschnitten (4.327 statt 14.225 Einträge); drei Läufe kosten
danach zusammen 45–65 ms.

> **Der Lauf je Schlagwort verknüpft `und`, nicht `oder`.** Die Suchstufe zerlegt
> eine mehrwortige Anfrage in ihre Wörter — mit `oder` zerfällt das Schlagwort
> „Mobile Fabrik" in „mobile ODER fabrik" und trifft **535 statt 2** Vorhaben.
> Bei einem Prompt, der ein- bis zweiwortige Schlagworte verlangt, ist das der
> Normalfall, nicht die Ausnahme. Die ODER-Verknüpfung der Anforderung gilt
> ZWISCHEN den Schlagworten (das leistet die Vereinigung der drei Läufe), nicht
> innerhalb eines Schlagworts. `wortfolge` wäre zu streng: sie verlangt die
> Wörter nebeneinander und verlöre „Transformation der digitalen Prozesse".
> Festgehalten in `abgleich.test.ts`.

**Ähnlichkeit** — `embedQueryCached` über Thema + Aufgabenbeschreibung, dann
`searchAntraegeVector`. Findet dasselbe Vorhaben unter anderem Namen. Läuft nur
mit geladenem Embedding-Modell; sonst entfällt die Stufe mit sichtbarem Hinweis,
nicht die Prüfung. Treffer ausserhalb des Bereichs fallen heraus — die Stufe
läuft über alle Vektoren, der Korpus ist bereits geschnitten.

**Das Urteil entsteht beim Rendern, nicht beim Lauf.** Es hängt an der Schwelle,
und die stellt der Nutzer danach um; läge es im Zustand, gäbe es nach dem ersten
Zug am Regler zwei Wahrheiten. Die Befunde sind der Fund, das Urteil eine Ansicht
darauf.

## 8. Was NICHT gespeichert wird

Nichts. Die hochgeladene Liste lebt im Speicher der Seite — keine IndexedDB, kein
Share, kein Snapshot, kein `Antrag`-Record. Der Export ist eine Datei im
Download-Ordner. Die Meldungen stammen aus einer Ressort-Zuarbeit; sie
irgendwo abzulegen wäre eine Entscheidung, die diese Seite nicht zu treffen hat.

## 9. Die Ähnlichkeitsschwelle — gemessen, nicht geraten

Der Lauf über die 45 Meldungen hat auch die zweite Stufe kalibriert
(EmbeddingGemma-300M, 14.221 gespeicherte Vektoren, WebGPU). Gezählt wurde je
Zeile der höchste Ähnlichkeitswert eines Vorhabens, das **kein** Schlagwort
getroffen hatte:

| Schwelle | Zeilen darüber | davon neu (Wortlaut sagte nein) |
|---|---|---|
| 0,45 | 34 | 25 |
| 0,50 | 15 | 12 |
| **0,52** | **10** | **8** |
| 0,55 | 4 | 3 |
| 0,60 | 1 | 1 |
| 0,65 | 0 | 0 |
| 0,75 | 0 | 0 |

Der höchste Wert der ganzen Liste war **0,621**. Die frühere Vorbelegung 0,75 lag
damit über dem gesamten beobachteten Wertebereich: die Stufe lief, rechnete und
trug zu **keinem einzigen** Urteil bei — ein stiller Ausfall, der nur beim
Nachmessen auffällt.

0,52 greift genau die acht Zeilen auf, die der Wortlaut nicht sehen kann. Darunter
die inhaltlich nächste Paarung der ganzen Liste: `Multi-POCT-vet` (Multiparameter-
Assay für die Veterinärmedizin) → `VetDx / ZytoVet` bei 0,523. Die MDZ-Zeilen, die
das Rauschband füllen, bleiben mit einer Ausnahme unter 0,51.

Die Zahl gilt **für dieses Modell**. Ein Modellwechsel verschiebt die Skala und
verlangt dieselbe Messung erneut (Pitfall #19).

## 10. Offen

- Der **KI-Lauf selbst** ist noch nicht gegen die interne KI gefahren. Die
  Schlagworte des Messlaufs waren von Hand formuliert; wie gut das Modell sie
  trifft, ist damit nicht beantwortet. Die Qualität ist an **drei** Läufen
  derselben Zeile zu beurteilen — ein Lauf ist Rauschen.
- **Ohne erreichbare KI ist die Seite unbenutzbar**: der erste
  `verbindungFehlt` beendet den Stapel, und ohne Schlagworte gibt es keine
  Zeile, deren Wörter man von Hand nachtragen könnte. Ein Weg, die Schlagworte
  ohne KI einzutragen, wäre die naheliegende Ergänzung — er ist bewusst noch
  nicht gebaut.
