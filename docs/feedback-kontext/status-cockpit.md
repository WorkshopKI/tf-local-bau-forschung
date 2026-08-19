# Vorgangs-Regeln

Vollbild-Verwaltungsseite für Kuratoren: die Grundlagen, auf denen Status,
Fristen und To-dos beruhen. Der Ordner im Code heißt weiter `status-cockpit`,
die Seite hieß bis v2.412 „Status-Katalog" — unter dem Namen vermutete niemand
die Regeln, und das Paar *Vorgangs-Board* / *Vorgangs-Regeln* macht sichtbar,
dass das eine die To-dos zeigt, die das andere definiert.

## Zweck

Der Statuswert-Katalog ordnet jedem Statuswert seinen **Verfahrensschritt** (die ZAH-Phase)
und seine **Zieltage** zu — mehr wird nicht kuratiert.

**Die Arbeitsliste wird hier NICHT gesetzt.** In welchen Reiter von Förderanträge
ein Antrag fällt (Zu bearbeiten, In Arbeit, Wartet auf Antragsteller …), hängt am
Statuscode selbst und steht damit fest. Bis dahin gab ein Verfahrensschritt sie
vor, und ein neuer Zuschnitt verschob nebenbei Hunderte Anträge zwischen Reitern,
ohne dass jemand das entschieden hätte. Wer den Schnitt heute umbaut, ändert
Leiste, Gruppierung, Zieltage und Fristlauf — die Arbeitslisten bleiben stehen.

**Der Verfahrensschnitt selbst ist kuratierbar**: zwischen 3 und 9 Schritte,
Beschriftung frei. Ausgeliefert werden sechs (Eingang → Vollständigkeit → Prüfung
→ Entscheidung → Begleitung → Abgeschlossen). Jeder Schritt trägt zusätzlich, ob
**Zieltage** für ihn eine sinnvolle Frage sind und ob in ihm die
**Bearbeitungsfrist läuft**. Vorher stand das in fest verdrahteten Tabellen, und
jede Änderung brauchte ein Release.

Was hier beschriftet oder umgehängt wird, gilt sofort in der ganzen App:
Verfahrensleiste am Antrag, Gruppierung und Filter der Förderanträge, Zieltage,
Stillstands-Wächter und der Fristlauf im Vorgangs-Board. Eine gespeicherte
Fassung wirkt unmittelbar — anders als der Meilenstein-Plan, der erst freigegeben
werden muss.

**Die App leitet keinen Status ab.** Bis v2.384 rechnete sie aus allen gesetzten
Datumsfeldern eine eigene Verfahrensposition aus (Rang, terminal-Flag,
Konflikt-Meldung) — die lief dem Status im Fachsystem regelmäßig voraus. Das ist
entfallen: angezeigt wird, was das Fachsystem führt.

## Bereiche

Fünf Reiter, jeder mit einem Zwecksatz darunter, der sagt, was dort gepflegt
wird.

- **Ebenen** — der einzige Reiter, der nichts pflegt. Er beantwortet die Frage,
  die keiner der anderen beantwortet: welche Angaben über einem Antrag liegen,
  wer sie pflegt und was passiert, wenn man eine ändert. Vier Blöcke mit den
  Zahlen des **Entwurfs**: was aus dem Fachsystem kommt (Kürzel, Status,
  Trigger), was wir darüber legen (Verfahrensschritt, Arbeitsliste,
  To-do-Regeln), eine Gegenüberstellung **Verfahrensschritt × Arbeitsliste**, und
  wann etwas zu spät ist (Zieltage gegen Meilenstein-Plan).
  - Die Gegenüberstellung ist der Beleg dafür, dass die beiden Achsen getrennt
    sind: ein Schritt trägt oft mehrere Arbeitslisten, und ein anderer Zuschnitt
    ändert daran nichts.
  - **Sie zeigt den Entwurf, nicht die gespeicherte Fassung** (v4.120): ein im
    Baum umgehängter Statuswert verschiebt die Zahlen hier sofort. Bis dahin las
    dieser Reiter die Zuordnung aus der aktiven Fassung und widersprach dem Baum
    im Nachbarreiter, bis gespeichert wurde ([Pitfall #55](../architecture/pitfalls.md)).
  - Die Gruppe **„Ohne Verfahrensschritt"** steht als eigene Zeile mit derselben
    Aufschlüsselung wie jeder Schritt. Sie ist weder pauschal „Marker" noch
    pauschal „Ohne Zuordnung": das Marker-Kennzeichen ist ein eigenes Feld, und
    die Arbeitsliste hängt am Code.
  - Die Ruhe-Zeile nennt **beide** Gründe getrennt („ohne Spalte im Export" /
    „von der PL stillgelegt"); ohne geladene CSV-Quellen steht dort der Grund
    statt einer Zahl.

- **Statuswerte** (bis v2.412 „Katalog") — zwei Sichten, umschaltbar oben; der
  Baum ist vorbelegt.
  - Ganz oben, über der Umschaltung, steht **„Gegenüber der Auslieferung"** —
    eine Zeile, die zusammenzählt, wie weit die gepflegte Fassung vom
    ausgelieferten Stand entfernt ist: entfernte, hinzugefügte, umbenannte oder
    umsortierte Verfahrensschritte, geänderte Zuordnungen, gepflegte Zieltage,
    stillgelegte Werte, geänderte Prominenz. Aufgeklappt stehen die Einzelheiten
    nach Gruppen. Ist alles gleich, erscheint sie gar nicht.
    - **Das ist keine Mängelliste.** Drift ist der erwartete Zustand: kuratiert
      wird laufend, ausgeliefert wird nur mit einer neuen Programm-Fassung. Die
      Zeile ist die Grundlage für den späteren Abgleich mit dem Programm — es
      gibt dort bewusst keinen Knopf, der etwas zurücksetzt.
    - Gezählt werden **Status, keine Katalogzeilen**: derselbe Status steht unter
      TV- und Verbund-Feld. Sagen beide dasselbe, zählt es einmal; sagen sie
      Verschiedenes, stehen beide da.
    - **Dieselbe Sprache sprechen jetzt alle drei Zähler**: Reiter, Umschalter
      und Baum sagen 30. Bis v4.95 sagte der Reiter 60 (Katalogzeilen) und der
      Baum daneben 30 (Codes).
  - **Phasen und Zuordnung** (Baum): Ebene 1 sind die Verfahrensschritte, Ebene 2
    die Statuswerte darunter. Ein Statuswert wird per **Ziehen** auf einen anderen
    Schritt gehängt; Schritte selbst werden untereinander sortiert, per F2 oder
    Doppelklick umbenannt. Ein Blatt steht für einen **Code**, nicht für eine
    Katalogzeile: derselbe Status steht unter TV- und Verbund-Feld, und beide
    Zeilen ziehen gemeinsam um. Rechts steht der Editor zum ausgewählten Knoten —
    bei einem Schritt Beschriftung, Zieltage-Relevanz und Fristlauf, bei einem
    Statuswert Label, Prominenz, Zieltage und aktiv. Wo früher die Arbeitsliste
    einstellbar war, steht jetzt ein Satz, der sagt, wo sie herkommt.
    - Am Schritt steht **„Datum für ,seit wann'"**: die Kürzel, deren Datum die
      Erklärung für Status dieses Schritts zeigen kann. Ist keines zugeordnet,
      steht das rot da — dann fehlt die „seit"-Zeile im ganzen Bestand. Nur
      lesend; umgehängt wird am Kürzel. Über dem Baum nennt eine Zeile die
      Gesamtzahl und **namentlich** die Schritte ohne Datum.
    - Unter den Feldern eines Statuswerts steht **„Wodurch dieser Status
      entsteht"** — die einzige nur lesende Angabe hier und die einzige, die
      nicht aus unserer Kuration stammt: welche Kürzel des Fachsystems diesen
      Status setzen, mit Bezeichnung, Rolle, ob TV- oder Verbund-Status, und in
      welchen Richtlinien der Weg besteht. Gleiche Wirkung über mehrere
      Richtlinien steht als EINE Zeile („in 131, 133 und 137"). Kennt die
      Trigger-Tabelle keinen Weg, steht das als Satz da — eine Aussage, kein
      Fehler. Ist die Tabelle gar nicht eingelesen, verweist der Block auf
      „Referenzdaten".
    - **Schritt anlegen** bis zur Obergrenze 9; darüber ist der Knopf mit
      Begründung deaktiviert. **Entfernen** fragt immer „wohin mit den n
      Statuswerten?" — sie verschwinden nie, sie ziehen um. Unter 3 Schritten
      wird nicht mehr entfernt.
    - Die Gruppe **„Ohne Phase"** steht am Ende und ist abgesetzt: Irrläufer,
      Sonderstatus und Partner-Kennzeichen laufen bewusst neben dem Verfahren.
      Das ist ein gültiger Zustand, kein Fehler. Was dort als **verwaist**
      markiert ist, zeigt dagegen auf einen gelöschten Schritt und gehört zurück
      ins Verfahren.
  - **Tabelle**: eine Zeile je **Status**, nicht je Katalogzeile. Die erste
    Spalte heißt **Ebene** und sagt „TV · Verbund" — vorher stand dort der
    Feldname, und jeder Status kam zweimal untereinander mit identischen Werten.
    Eine Änderung an der Zeile trifft **beide** Katalogzeilen; ein Status
    bedeutet auf beiden Ebenen dasselbe.
    - Laufen die beiden doch einmal auseinander, steht ein **≠** neben der
      Ebene und der Tooltip nennt die Felder. Verschwiegen würde aus der
      Faltung sonst eine stille Halbwahrheit. Im Bestand vom 18.08.2026 tritt
      der Fall bei keinem der 30 Status auf.
  - Rechts neben der Umschaltung stehen **„Phasen exportieren"** und **„Phasen
    importieren"**. Die Datei enthält nur den Verfahrensschnitt: die Schritte,
    welcher Statuswert in welchem hängt und die Zieltage. Kürzel, Ordner und
    Regeln sind nicht darin. Gedacht ist sie für den Fall, dass Schritte und
    Kürzel auf verschiedenen Ständen richtig sind — Schritte ändern sich selten,
    an den Kürzeln wird laufend gearbeitet.
    - Exportiert wird der Stand, den die Seite gerade **zeigt** — samt
      ungespeicherter Änderungen. Die Datei heißt dann `…-entwurf.json`, damit
      die Fassungsnummer im Namen nichts verspricht, was der Inhalt nicht hält.
      Das gilt genauso für „Exportieren" im Seitenkopf.
    - „Phasen importieren" öffnet denselben Dialog wie **„Importieren"** im
      Seitenkopf; der nimmt beide Formate an, weil die Datei selbst sagt, was
      sie ist. Danach steht ein Satz über der Seite, was sich dadurch geändert
      hat, und ob die Datei Status kannte, die es hier nicht gibt.
    - Übernommen wird in den Entwurf. Nichts gilt für das Team, bevor „Für das
      Team speichern" gedrückt wurde; wer es sich anders überlegt, lädt eine
      Fassung neu.
    - Weil die Schritte dabei **ersetzt** werden, kann es passieren, dass danach
      Zuordnungen auf einen Schritt zeigen, den es nicht mehr gibt. Das steht in
      derselben Meldung und ist kein Fehler — die betroffenen Einträge stehen im
      Baum unter „Ohne Phase" als verwaist und lassen sich von dort zurück ins
      Verfahren hängen.
  - **Tabelle**: alle Statuswerte mit Inline-Bearbeitung (Label, **Kurzform**,
    Kategorie, Prominenz, **Zieltage**, aktiv), **Vorkommen**, **zuletzt
    gesehen**, Feldname und **CSV-Spalte** als Herkunft, dazu Filterchips und
    Suche. Der Verfahrensschritt steht hier nur zum Lesen. Leeres Label heißt:
    Rohwert gilt. Neue Werte erscheinen als **unkuratiert** und werden per
    „Übernehmen" geholt, nie automatisch.
    - Die **Arbeitsliste** trägt den Zusatz „folgt dem Code" — nicht dem
      Verfahrensschritt: seit v4.87 hängt sie allein am amtlichen Code, Umhängen
      im Baum ändert sie nicht.
    - Die **Suche filtert nach dem Falten**, nie davor: ein Suchwort wie
      „verbund" darf die Zahlen einer Zeile nicht ändern, nur entscheiden, ob sie
      dasteht.
    - Die **Filterchips tragen ihre Trefferzahl** und sind ausgegraut, wenn sie
      im Bestand nichts treffen — ein wählbarer Chip, der die Tabelle immer
      leert, war der häufigste Fehlalarm hier.
    - Die Zahl der wartenden unkuratierten Werte nennt **keinen Zeitraum**: der
      Puffer wird beim Import nur ergänzt, nie geleert. Das Datum steht an jeder
      Karte. Was inzwischen kuratiert wurde, fällt beim Laden heraus.
  - **Kurzform** ist die Beschriftung für enge Flächen — Status-Pille,
    Kanban-Lane, die 90-px-Spalte der Suche. Leeres Feld heißt „es gilt die
    Auslieferung"; der Platzhalter zeigt sie an. Gepflegt wird je **Code**, also
    für TV- und Verbund-Zeile gemeinsam.
    - Richtwert 14 Zeichen; über 18 steht ein Hinweis darunter — gemeldet, nicht
      erzwungen, das Speichern bleibt möglich.
    - Wo nichts gepflegt ist, zeigt die App den gekürzten vollen Bezeichner mit
      „…", also sichtbar unfertig, statt still etwas zu erfinden.
    - Über der Tabelle steht die **Kurzlabel-Pflegeliste**: dieselben Angaben,
      aber **nach Vorkommen im Bestand sortiert**, damit oben angefangen werden
      kann. Vorbelegt zeigt sie nur Offenes und lässt sich aufklappen.
  - **Zieltage** speisen den Stillstands-Wächter: nach wie vielen Tagen ohne
    Vorgangs-Aktivität gilt dieser Status als hängend? Leer heißt „nicht
    bewertbar", nicht „unauffällig". Neben dem Feld steht ein ⌀-Vorschlag aus
    der Ist-Verteilung (Median, Stichprobengröße im Tooltip); er wird pro Zeile
    einzeln übernommen.
    - Über der Tabelle steht zusätzlich „Vorschläge ansehen": Vorschau
      (alt → neu, Stichprobe) und Übernahme in einem Schritt — erst ab fünf
      Beobachtungen; kleinere Stichproben stehen namentlich als „zu wenig Daten".
    - **Für welche Schritte ein Zieltag überhaupt gilt, entscheidet die PL** am
      Schritt selbst. Text und Vorschau nennen diese Schritte mit ihrer
      aktuellen Beschriftung, statt eine feste Liste zu behaupten.
- **Kürzel**: der **Ordnerbaum des Fachsystems** (505 Einträge), Verbund und
  Teilvorhaben getrennt.
  - **In der Zeile** steht nur, was hier auch entschieden wird: Code, CSV-Spalte,
    Bezeichnung, **relevant**, Typ, **wird gesetzt von** (AB/FB/QS/PA/Juristen,
    Mehrfachauswahl; leer = jeder darf) und aktiv.
  - **In der Klappe der Zeile** (Pfeil vor dem Code, immer vorhanden) stehen
    **Ordner**, **Prominenz** und der **Verfahrensschritt des Datums** — dazu
    die Trigger-Wirkung, falls es welche gibt. Sie stehen dort, seit gemessen
    wurde, dass an Ordner und Prominenz über 23 Fassungen hinweg **keine
    einzige** Änderung vorgenommen wurde: beide kommen richtig aus der
    Kürzel-Zuarbeit. Ein Satz in der Klappe sagt das, damit niemand eine
    Entscheidung sucht, die das Fachsystem schon getroffen hat.
  - Der Verfahrensschritt beantwortet „welches Datum gehört zum aktuellen
    Status?" — er speist die „seit"-Angabe der Status-Erklärung und die Marke
    in der Chronik. Leer heißt ehrlich „trägt nichts bei"; für die große
    Mehrheit der Kürzel gibt es gar keine ableitbare Antwort. Welche Datumsfelder
    einen Schritt speisen — und welcher Schritt leer ausgeht — steht am Schritt
    selbst im Reiter **Statuswerte**. Bei Wert-Feldern hängt die Phase am Wert.
  - Zwei **Phasenvorschläge** über der Tabelle, je mit Vorschau, Beleg als Satz
    und zeilenweiser Auswahl: einer aus der **Trigger-Tabelle** (das Kürzel setzt
    Status X, X liegt in Phase P), einer aus der **Auslieferung** — nur dort, wo
    die Trigger-Tabelle schweigt, denn sie hat Vorrang.
  - Uneinigkeit wird benannt, nicht geglättet: verschiedene Phasen über die
    Richtlinien oder Widerspruch zwischen beiden Quellen ergeben **keinen**
    Vorschlag. Kürzel ohne Vorschlag stehen nach Grund gruppiert; ein Satz unter
    der Kopfzeile nennt, wie viele Kürzel überhaupt einen Status setzen — die
    verbleibende Lücke ist keine offene Arbeit.
  - Das **Relevanz-Häkchen** markiert die Kürzel, die für die
    Antragsbearbeitung zählen; es grenzt Navigator, Wächter und die
    Status-Erklärung ein.
  - Trägt ein Kürzel Trigger-Zeilen, steht neben dem Code ein **Blitz mit
    Anzahl**; die Klappe zeigt unten, was das Setzen in C16 auslöst (Satzform).
    Jede Zeile beginnt mit `Richtlinie/Folge`, weil dasselbe Kürzel je
    Richtlinie etwas anderes auslöst.
  - „Ordner bearbeiten" ist ein **Baum**: Zweige klappen zu, Ziehen **am Griff**
    hängt um, F2 benennt um, Rechtsklick öffnet Umbenennen · Stilllegen ·
    Entfernen. Verbund und Teilvorhaben bleiben getrennte Bäume — ein Ordner
    wechselt die Ebene nicht.
    - Darüber steht, **was der Baum bewirkt**: „15 von 19 Ordnern tragen eine
      Spalte in der Fördertabelle · ohne Spalte: internationale Projekte,
      Betreuung, Vor-Ort-Besuch, SV - Keller - Archiv". Aus jedem Ordner
      entsteht eine **Ordner-Spalte der Fördertabelle**; ein Ordner ohne
      tragendes Kürzel ist deshalb eine Spalte, die nie erscheinen kann. Wer sie
      vermisst, soll den Grund hier lesen und nicht im Spaltenpicker suchen.
    - Am Ordner selbst steht dann **„ohne Spalte"**. Nötig ist mindestens ein
      **aktives Datums-Kürzel**, dessen Prominenz nicht „Ignoriert" ist — „leer"
      und „ohne Spalte" fallen also auseinander, sobald in einem Ordner nur
      Text-Kürzel liegen. Stillgelegte Ordner tragen die Marke nicht: dass aus
      ihnen nichts wird, ist ihr Zweck.
  - Übernahme-Blöcke erscheinen nur, solange sie etwas bewirken: Auslieferung
    nachziehen, Bezeichnung/Rollen der Kürzel-Zuarbeit übernehmen, die beiden
    Phasenvorschläge, **AB-Dashboard-Spalten als relevant markieren** (setzt nur,
    nimmt nie weg), gefundene CSV-Spalten einsortieren. Für die übrigen Rollen
    dieselbe Aktion, gespeist aus „wird gesetzt von" statt aus einer erfundenen
    Liste; Kürzel, die jeder setzen darf, bleiben außen vor.
  - Filter: Ebene, Rolle, „nur relevante", „nur mit CSV-Spalte", „ohne Phase".
  - Über der Tabelle steht der **Bestandslauf** — ein Knopf („Am Bestand
    messen"), der Verlaufsableitung und Haltedatum in einem Durchgang über den
    Betrachtungsbereich rechnet (~15 s + ~15 s). Er gehört hierher, weil er über
    die Kürzel und ihre Statuswirkung Auskunft gibt, nur über den Bestand statt
    über den Katalog.
    - Zuerst der **Befund in Sätzen**: ✓ für die beiden Zusagen (der Frist-
      Zustand bewegt sich nicht, nichts wird umdatiert), ⚠ für Auffälligkeiten
      (Zielcodes ohne Katalog-Eintrag, Widersprüche zwischen Ableitung und
      Export, negative Dauern, strittige geliehene Bezeichnungen). Kennzahlen —
      Deckung der Bahn, Herkunft der Haltedaten — stehen darunter **ohne**
      Symbol, weil sie beschreiben statt zu werten.
    - Auffälligkeiten tragen bis zu drei **Belege**. Ist der Beleg ein Kürzel,
      filtert ein Klick die Tabelle darunter darauf; Aktenzeichen bleiben Text.
    - „**Zahlen im Detail**" klappt die vollständige Auswertung auf (Spuren,
      Übergänge, Bedingungen, Abschnitte, Verweildauern, Projektform, was C16
      überhaupt führt). Default zu; der Zustand bleibt gerätelokal erhalten.
- **To-do-Regeln** (bis v2.412 „To-dos"): die To-do-Kaskade — geordnet, die
  erste zutreffende Regel gewinnt. Die Reihenfolge IST das Ergebnis, deshalb
  wird sie über Pfeile gesetzt, nicht per Ziehen. Jede Regel liest sich als
  deutscher Satz („WENN Status 71 und D_ARQ leer → To-do «RNE ergänzen»,
  zuständig AB").

  - Der Reiter heißt bewusst nicht mehr „To-dos": wer das liest, erwartet seine
    Aufgaben, und die stehen im Vorgangs-Board. Von dort führt ein Verweis
    „Regeln bearbeiten" direkt hierher, zurück geht es über „Wirkung im
    Vorgangs-Board ansehen".
  - Weicht der ausgelieferte Regelsatz von der gepflegten Fassung ab, steht das
    oben mit Bilanz („4 neue Regeln · 6 geändert · 1 entfallen") und einem
    Nachziehen-Knopf; Nachziehen ersetzt die gelieferten Regeln, legt entfallene
    still und lässt eigene unangetastet.
  - Eine Bedingung auf eine Spalte, die der Katalog nicht führt, wird als Fehler
    angezeigt („trifft nie zu").
  - **Wirkung am Bestand messen** (Knopf, nie automatisch — der Lauf kostet
    Sekunden): je Regel steht danach, auf wie viele Vorgänge ihre Bedingung
    zutrifft und bei wie vielen sie die Kaskade gewinnt. Sind beide Zahlen
    gleich, steht nur eine da; an einer Sperre steht stattdessen, wie oft sie
    greift. Ohne Lauf steht nichts. Wird danach umsortiert oder bearbeitet,
    gelten die Zahlen als „Stand vor der letzten Änderung" — neu gerechnet wird
    nur auf Knopfdruck.
    - Am Ende derselben Zeile steht die **Bilanz der Kaskade**, und sie nennt
      die wirkungslosen Regeln **namentlich**: „2 Regeln bleiben ohne Wirkung:
      R10 (trifft nie) · R23b (immer verdeckt)". Eine Anzahl allein schickte
      jemanden durch dreißig Zeilen. Die drei Gründe sind drei verschiedene
      Fehler — eine Bedingung, die etwas anderes beschreibt als gemeint; eine
      richtige Bedingung an der falschen Kaskaden-Position; eine Sperre, die
      nirgends greift. Wirkt alles, steht das ausdrücklich da, denn Schweigen
      läse sich als „noch nicht geprüft".
    - **Stillgelegte Regeln bleiben draußen.** Sie tun erwartungsgemäß nichts;
      mitgezählt wäre die Bilanz eine Anzeige des eigenen aktiv-Hakens.
  - **Probe am Fall**: ein Aktenzeichen eingeben, und es steht da, welche Regel
    bei diesem Vorgang gewinnt, welche Sperren griffen und mit welchen
    Feldwerten — dieselbe Ansicht wie am Antrag. Ein unbekanntes Aktenzeichen
    und eines außerhalb des Betrachtungsbereichs werden getrennt benannt.
  - **Änderung am Bestand messen** steht in der Speicherleiste, weil
    veröffentlichte Regeln sofort für alle scharf sind: bei wie vielen Vorgängen
    sich das To-do ändert, gruppiert alt → neu mit Beispiel-Aktenzeichen.
    Gemessen, nicht geschätzt; das Speichern wird nicht blockiert.
  - **Strang** je Regel („PreCheck", „Nachforderung", „RNE", … frei ergänzbar):
    Sperren legen ganze Stränge still statt einzelne Regeln aufzuzählen. Eine
    Regel ohne Strang wird von keiner Strang-Sperre erfasst — darauf weist der
    Editor hin, wo tatsächlich eine greift.
  - **Begründung** je Regel — woher sie stammt und wer sie beschlossen hat. In
    der Liste als gedämpfte zweite Zeile.
  - **Zwei Ansichten, ein Reiter**: ohne geöffnete Regel steht die ganze Kaskade
    als Karten über die volle Breite (Nummer, Pfeile, Satz, Zustand,
    „Bearbeiten"). Ein Klick teilt die Ansicht: links die schlanke Liste mit
    Markern für Sperre, stillgelegt und „trifft nie zu", rechts die Regel mit
    Editor. Die Trennlinie ist ziehbar und ihre Lage bleibt erhalten; Esc bringt
    die Karten zurück.
  - In der geteilten Ansicht stehen die **Positions-Pfeile im Regel-Kopf**
    („Position 5 von 27"), weil die schlanken Zeilen selbst nur die Auswahl
    tragen. Erklärtext, Nachziehen-Hinweis und die Tagesordnung erscheinen nur,
    solange keine Regel geöffnet ist — sie brauchen die volle Breite.
  - **Regelsatz je Rolle**: über der Liste stehen Reiter (AB, FB, weitere sobald
    dort Regeln existieren). Ausgewertet wird immer genau ein Satz. Sperren
    gelten vorgangsweit und erscheinen deshalb in jedem Reiter, dort mit dem
    Hinweis „gilt für alle Regelsätze" und ohne Pfeile — verschoben werden sie
    in ihrem eigenen Satz.
  - **Rollout-Sperre**: Regeln außerhalb von AB entstehen stillgelegt, Aktivieren
    fragt nach. Grund steht am Reiter: die Katalog-Datei gilt für alle
    Installationen gleichzeitig, und ältere App-Fassungen würden eine fremde
    Regel in der AB-Kaskade mitwerten.
  - **Tagesordnung statt Leerzustand**: für einen Satz ohne eigene Regeln zeigt
    der Reiter, in welchen Situationen die bestehenden Regeln heute auf diese
    Rolle warten — mit Anzahl, Herkunftsregel und Beispiel-Aktenzeichen. Aus
    jeder Zeile lässt sich die fehlende Regel direkt anlegen, vorbefüllt mit der
    Bedingung, die schon feststeht. Jede Zeile trägt **zwei** Zahlen: wie oft die
    Rolle das To-do heute abgeleitet sieht, und wie oft die Bedingung der
    Herkunftsregel im Bestand überhaupt zutrifft. Die zweite ist die Reichweite
    einer eigenen Regel und regelmäßig ein Vielfaches der ersten.
  - Daneben die Zahl der Vorgänge **ohne To-do in jedem Regelsatz**, bei denen
    ein Kürzel-Paar einseitig offen steht — die fachlichen Lagen, für die die
    bestehende Kaskade blind ist, mit Median-Standzeit je Paar.
  - **Erhebung exportieren** legt diese drei Auswertungen als Arbeitsmappe ab,
    plus eine Kurzfassung für die Einladung zum Fachtermin. Der Export braucht
    kein Schreibrecht — er nimmt nichts mit auf den Daten-Ordner.

## Versionen

Änderungen sind ein **Entwurf**; „Für das Team speichern" legt eine Fassung an.
Ältere Fassungen sind als Entwurf ladbar.

Je Fassung stehen dafür zwei Knöpfe. **Als Entwurf laden** holt sie ganz zurück,
mit allem, was sie enthält. **Nur Phasen übernehmen** holt allein den
Verfahrensschnitt — die Schritte, ihre Zuordnungen und die Zieltage; Kürzel,
Ordner und Regeln des aktuellen Standes bleiben, wie sie sind. Das ist der Weg,
wenn eine ältere Fassung die richtigen Schritte hat und die heutige die richtigen
Kürzel. Auch hier steht danach ein Satz über der Seite, was sich geändert hat.

Weil den Katalog mehrere Personen pflegen, wird vor dem Veröffentlichen
nachgesehen, was inzwischen auf dem Daten-Ordner liegt. Fremde Fassungen, die
dieser Rechner nicht kennt, wandern dabei in die Fassungsliste — sie gehen nie
verloren, auch wenn danach eine andere gilt.

Hat jemand anderes zwischenzeitlich veröffentlicht, wird **nichts geschrieben**;
eine Meldung nennt Nummer, Kürzel und Zeitpunkt der fremden Fassung. Die eigene
Arbeit ist da bereits als neue Fassung gespeichert — offen ist nur die
Veröffentlichung. Zwei Wege:

- **Fremde Fassung laden** — sie gilt danach für das Team; vorher steht da, in
  wie vielen Einträgen sich beide unterscheiden. Die eigene bleibt in der Liste
  und ist wieder als Entwurf ladbar.
- **Trotzdem veröffentlichen** — die eigene gilt danach; die Änderungen der
  fremden sind darin nicht enthalten, sie bleibt aber erhalten.

„Später entscheiden" schließt die Meldung; im Seitenkopf bleibt der Hinweis, dass
die eigene Fassung noch nicht veröffentlicht ist. Liegt beim Zurückkommen ins
Fenster eine neuere Fassung vor, steht auch das im Seitenkopf — mit Knopf zum
Laden. Umgeschaltet wird nie von allein.

## Wichtig

- Der Katalog gilt **team-weit**: Speichern legt ihn auf dem Daten-Share ab, alle
  übernehmen ihn beim nächsten App-Start. Ohne erreichbaren Share bleibt die
  Fassung lokal — die Seite sagt das und bietet „Erneut veröffentlichen" an.
- Zwei Fassungen werden **nie inhaltlich zusammengeführt**. Zusammengeführt wird
  allein die Liste der Fassungen; welche gilt, entscheidet ein Mensch.
- Die **Historie** (Statusverlauf) bleibt auf dem eigenen Rechner: sie hält fest,
  wann er eine Änderung gesehen hat.
- JSON-Export/Import dient der Sicherung, nicht dem Team-Abgleich.
- Ändert nichts am Legacy-System — reine Anzeige und Einordnung.
- Die **Parametertabelle** („Erklärung Parameter") ist eine Legende ohne
  Kopfzeile: Wert · Erklärung · Kategorie. Codes entstehen **nur** aus den Zeilen
  der Kategorie „Status"; was übersprungen wird, nennt die Vorschau nach Art
  („4 Statuscodes übernommen · übersprungen: 2 Textbausteine, 3 Bearbeiter").
  Bearbeiter-Kürzel und die Nummern 210/211 werden gegen die Annahme der App
  geprüft; Abweichungen stehen als Hinweis, gespeichert wird davon nichts. Eine
  reine Code/Text-Tabelle wird weiter gelesen.
- Die **Trigger-Tabelle gilt je Richtlinie**. Der Bereich „Referenzdaten" nennt
  Stand, Zeilenzahl und Programme; die Vorschau zählt Zeilen und Kürzel je
  Programm und nennt die Programme des Bestands, für die die Datei nichts führt
  (mit Antragszahl). Zeilen aus einem Import vor v2.380 tragen keine Richtlinie
  und greifen an keinem Vorhaben — die Seite bittet um einen neuen Import. Kürzel
  ohne Katalog-Eintrag meldet die Vorschau als Warnung, die vier geklärten
  (`ID` = Rollenvergabe, `TTV1`/`TTV2`/`TVB1` = Testkürzel) nur als Hinweis.
- Die **Journal-Frische** steht als dritte Angabe unter „Referenzdaten", schon in
  der Kopfzeile: letzter Stempel mit Alter, Einträge des laufenden Monats,
  Nullpunkt. Nach mehr als drei Tagen ohne journalisierten Export warnt die Seite
  und nennt die Folge — Änderungen aus dieser Zeit sind danach nur noch als
  **Zeitraum** erfassbar, nicht als Datum. Ohne Journal steht „noch nicht
  angelegt" statt einer leeren Angabe. Keine Bearbeiter-Angabe — das Journal
  führt keine.
- **Referenzdaten** und **Versionen** stehen in den Reitern Katalog und Kürzel.
  Der Reiter To-dos füllt die Höhe stattdessen mit der geteilten Regel-Ansicht,
  deren beide Spalten für sich scrollen.

- **Der Bestandslauf wird für die Sitzung behalten** (seit v4.103): der Gang über
  alle Verbünde kostet Sekunden, und die Seite wird bei jeder Rückkehr neu
  aufgebaut. Unter der Reiterleiste steht deshalb, wie alt die Zahlen sind
  („7.535 Verbünde · berechnet vor 2 min"), daneben **„neu berechnen"**.
  **Gecacht wird nur der Bestand, nie die Fassung** — die ist hier das
  Arbeitsstück und wird immer frisch gelesen.

## Technik

**Route & Sichtbarkeit:** `/status-cockpit`, Flag `statusCockpit`; dev/pl/kurator.

**Datenmodell dahinter:** Katalog als Team-Sidecar `_intern/status-katalog.json` (Zugriff nur über `katalog-share.ts`), Event-Log `status_event` + Unkuratiert-Puffer gerätelokal. Die Ordner-Spalten der Fördertabelle entstehen aus `kategorieId`. Siehe `docs/status-system/README.md` und `KATALOG-CODES.md`.
