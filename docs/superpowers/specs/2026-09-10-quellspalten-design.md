# Quellspalten sichtbar machen + ein Meilenstein-Anker

Stand: 10.09.2026 · Ausgangspunkt: Fristen & Meilensteine → Konfiguration zeigt Bedingungen wie „TIB gefüllt UND BIB gefüllt", ohne zu sagen, aus welchen CSV-Spalten sie lesen.

## 0. Anlass

Nutzer, 10.09.2026, mit Screenshot der Meilenstein-Konfiguration:

> „überall wo status oder andere csv felder aus den quellen abgeleitet sind, soll für den pl user sichtbar sein (mit tooltip) aus welchen spalten genau (spalten name und label) das entsprechende feld oder die bedingung abgeleitet sind. Durch die vielzahl an quell spalten pro Antrag ist es selbt für Fachleute nicht immer leicht das zu erkennen und es sind evtl. auch noch viele bugs in der app, die darauf zurückzuführen sind das sie die falschen Spalten oder Kombination von spalten in ihre berechnung (z.b. fristen) einbeziehen."

## 1. Warum

Die Bitte heißt „Tooltip", der Bedarf heißt **Prüfbarkeit**: Wer eine abgeleitete Zahl oder Bedingung sieht, soll ohne Code-Lektüre erkennen, welche Quellspalten hineinlaufen — und damit Fehler der Klasse „falsche Spalte / falsche Kombination" selbst finden. Ein Tooltip, der von Hand abgeschrieben ist, würde genau diese Fehler verdecken; er muss aus derselben Auflösung kommen, die die Rechnung benutzt.

## 2. Befunde aus dem Bestand

- **Halb gebaut.** Die Fördertabelle erklärt ihre Spaltenköpfe (`SpaltenHilfe` + `SpaltenHilfeInhalt`, Felder aus dem Schema, `baueSpaltenHilfe`), ebenso Status-Cockpit-Katalog, Herleitungs-Popover und die offene Liste des `FeldWaehler`. Es fehlt: Meilenstein-Zusammenfassung (nur Label), zugeklappter `FeldWaehler` („Label · kanonischer Key" statt roher Spalte), To-do-Regeln, To-do „warum?" (nur roher `feldId`), Frist-Zelle (Codes ohne Label), Meilenstein-Übersicht/Leiste, Home-Fristen, „Alle Felder".
- **Kein zentraler Auflöser.** `rohSpaltenJeFeld` (canonical|custom) und `csvSpaltenJeFeld` (canonical + Rohname) lösen verschieden auf; sechs Label-Quellen.
- **Erster Rechenfehler dieser Klasse.** Der Meilenstein-Anker las nur `D_AAE` (`verbundAntragsdatum`, an drei Rechenstellen je für sich), die Frist-Spalte der Tabelle und der Bestandslauf dagegen `wirksamerEingang` = das spätere aus `D_AAE` und `D_XTE`.
- **Wirkung der Angleichung** (10.09.2026, dev:local, 14 225 Anträge, Plan-Fassung 30; alt und neu auf denselben Daten gerechnet): 28 von 2 082 offenen Verbünden (1,3 %) bekommen einen späteren Anker, +1 … +61 Tage (Median +8); kein Meilenstein-Zustand und keine Prognose kippt. Auswertung, ganzer Bestand: 125 von 5 969 Dauern kürzer (Median −5 T); Ø 132 → 131 T, Median 117 T, im Soll 32 → 33 %.
- **Nebenbefund (kein Code-Defekt).** Eine Messung während der Umstellung zeigte leere Anker: HMR hatte `bewertung.ts` (Signatur `b3`) vor `projektion.ts` geladen, die Projektion mit `b3` gecacht und nach dem Reload wiederverwendet. Nur im Dev-Server möglich; ein Build tauscht alle Module zugleich.

## 3. Entwurf

Grill-Entscheidungen: ein geteilter Baustein in drei Stufen, jede eine eigene Version; keine neue Sichtbarkeits-Achse; je Feld Code + Label aller Programme plus Lücken-Hinweis und Verbund-Satz; Code inline, wo Platz ist, sonst nur Tooltip; Begriff **Quellspalte**.

### Stufe A — ein Anker (v6.49)
`verbundWirksamerEingang` (frist.ts, Werte als Parameter), `baueAnkerLeser(schemas)` (anker.ts, `D_XTE` über `loeseFelderAuf`), genutzt von Projektion und Verbund-Detailseite; Auswertung über `alle_antraege_da` der Listen-Projektion. `VerbundMeilensteine.anker` / `AbschlussFall.anker` neu, `antragsdatum` bleibt für den Jahresfilter. `BEWERTUNGS_VERSION` 2 → 3. Beschriftung „ab wirksamem Eingang" mit Erklärung aus `ANKER_SPALTEN`.

### Stufe B — Baustein + Meilensteine + To-do
`baueQuellSpaltenIndex(schemas)` (alle drei Schlüssel-Konventionen, `fehltIn`), `rohSpaltenJeFeld` als Projektion davon; `bedingungQuellen(b, index, labelVon)` aus `bedingungFeldRefs` + `bedingungSatz`; `SpaltenHilfe.felder[].fuer` für die Gruppierung. Flächen: Konfigurations-Zeile, `FeldWaehler`-Auslöser, Gesamtfrist, Übersicht/Leiste/Diese Woche, `TodoRegelSatz`, `TodoHerleitung`. Guard: wer `bedingungSatz` rendert, rendert die Quellspalten.

### Stufe C — restliche Flächen
Frist-Zelle (Labels zu `FRIST_GRUND`), `FESTE_FELDER.frist` (Labels aus dem Index), Home-Fristen, „Alle Felder" (Code + Hinweis zu `frist_datum`), StatusVerlauf-Widget, Status-Filter.

## 4. Verifikation

Je Stufe: `check:quick` im Loop, `check` vor dem Commit, `build:devpl` im Hintergrund mit geprüftem Exit-Code. Abnahme in dev:local: jede Fläche per `read_page`/Screenshot, gerenderte Codes + Labels gegen `column_mapping`, `__tf.fehler() === 0`, Beta-Schalter aus. Die Anker-Umstellung wurde gepaart gemessen (siehe 2.). Nichts davon hängt an `file://`, FSAPI oder Share-Schreibrechten.
