# Die beiden Status-Achsen

Über einem Antrag stehen zwei Angaben, die leicht für dasselbe gehalten werden:
sein **Verfahrensschritt** und seine **Arbeitsliste**. Sie beantworten
verschiedene Fragen, gehören verschiedenen Leuten, und genau eine von ihnen ist
beweglich.

| | Verfahrensschritt (ZAH-Phase) | Arbeitsliste (`StatusCategory`) |
|---|---|---|
| **Frage** | Wo im Verfahren steht der Vorgang? | Wer ist am Zug — oder ist es erledigt? |
| **Wirkt auf** | Verfahrensleiste, Filter-Gruppierung, Zieltage, Stillstands-Wächter, Fristlauf im Vorgangs-Board | Reiter, Abschnitte, Farben und Kanban-Lanes in *Förderanträge*, Gutachten-Karte am Verbund |
| **Wohnt in** | der Katalog-Fassung (`MappingVersion.zahPhasen`) | dem Code (`core/utils/status-canonical.ts`) |
| **Ändert wer** | die PL im Baum-Editor der Vorgangs-Regeln | niemand zur Laufzeit |
| **Anzahl** | 3 bis 9, ausgeliefert 6 | fest 9 |

Beide hängen zusammen, aber nur in eine Richtung: jede Phase trägt eine
`kategorieVorgabe` — die PL entscheidet, in **welche** Arbeitsliste ein Schritt
einzahlt, nicht **welche** Arbeitslisten es gibt.

```
Rohtext → amtlicher Code → Verfahrensschritt → Arbeitsliste
          (status-codes)    (zahPhasen,         (KATEGORIE_ANKER am Code,
                             kuratierbar)        sonst kategorieVorgabe)
```

Sechs Codes gehen den zweiten Pfeil **nicht** mit: 33–37 (der
Vollständigkeits-Zyklus) und 59 (bewilligt) tragen ihre Arbeitsliste am Code,
nicht an der Phase — `KATEGORIE_ANKER` in
[kategorie-ableitung.ts](../../src/core/status/kategorie-ableitung.ts). Warum,
steht unten.

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

Festgehalten von `status-category-not-curated`: kein Feld der Fassung führt eine
Liste von `StatusCategory`.

## Was v3.25 gelehrt hat: `kategorieVorgabe` war das Schlupfloch

Der Absatz darüber beschreibt genau den Schaden, der am 05.08.2026 eintrat — der
Wächter stand nur an der falschen Tür. Er verbot der Fassung eine **Liste** von
Kategorien; verschoben wurde die Arbeitsliste aber über den erlaubten Weg, den
Phasenschnitt.

Die **Katalog-Fassung 19** löste die Phase „Vollständigkeit" auf und hängte ihre
Codes 33–37 an „Prüfung" — ein gewollter Schnitt (fünf statt sechs Phasen) aus
der AB/FB-Abstimmung. Weil `pruefung` die Arbeitsliste `in_pruefung` vorgibt und
`snapshot.ts` die Kategorie aus Phase + Code neu rechnet, wanderten **448
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

**Die Lehre:** Wessen Arbeitsliste fachlich feststeht, hängt am Code, nicht an
der Phase. Ein Anker, der eine Phasen-Id nennt, ist kein Anker, sondern eine
Sollbruchstelle. Die Kuration bleibt für alle übrigen Codes unberührt — die
Anker-Tabelle ist eine Untergrenze, kein Ausschalter (Gegenprobe im Test
`nicht verankerte Codes folgen weiter dem kuratierten Schnitt`).

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
| `nachforderung` | Wartet auf Antragsteller | Bei Antragst. |
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
| `nachforderung` | nachforderung | Wartet auf Antragsteller | 1:1 |
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
| Die Handlung „nächster Schritt" (nur die Aktion) | [naechsterSchritt.ts](../../src/core/utils/naechsterSchritt.ts) |
| Grenzen, Umhängen, Verwaiste | [zah-phasen-edit.ts](../../src/core/status/zah-phasen-edit.ts) |
| Der Schnitt als transportables Paket | [phasen-paket.ts](../../src/core/status/phasen-paket.ts) |
| Phase + Code → Kategorie | [kategorie-ableitung.ts](../../src/core/status/kategorie-ableitung.ts) |
| Die sieben Abschnitte | [antragGroups.ts](../../src/plugins/antraege/antragGroups.ts) |
| Der Baum-Editor | [PhasenBaum.tsx](../../src/plugins/status-cockpit/PhasenBaum.tsx) |

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
