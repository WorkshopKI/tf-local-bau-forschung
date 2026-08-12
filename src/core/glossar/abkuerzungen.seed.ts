/**
 * Abkürzungen und Begriffe des Verfahrens — der Nachschlage-Bestand des Glossars.
 *
 * **Regel für diese Datei: nicht raten.** Jeder Eintrag hat eine Belegstelle im
 * Repo (Rollen-Tabelle, Code-Kommentar, Architektur-Doc, Seed-Label). Wo eine
 * Bedeutung nur naheliegt, aber nirgends ausgeschrieben steht, fehlt der Eintrag
 * lieber — eine falsche Auflösung im Glossar ist schlimmer als eine fehlende,
 * weil sie sich weiterträgt.
 *
 * Heute bewusst NICHT enthalten, weil im Repo nirgends aufgelöst: `TB`, `MAP`,
 * `DMS`, „Sonderstatus", „Irrläufer". Bei `TB` liegt die naheliegende Lesart
 * („Textbaustein") sogar nachweislich falsch — Textbaustein wird nie abgekürzt,
 * und `TB` steht in den Kürzel-Labels der fachlichen Seite gegenüber `BB`.
 * Ergänzt werden sie, sobald die Fachseite die Langform nennt.
 */
import type { GlossarBegriff } from './typen';

export const GLOSSAR_BEGRIFFE: readonly GlossarBegriff[] = [
  // ── Antrag und Struktur ────────────────────────────────────────────────────
  {
    id: 'antrag',
    begriff: 'Antrag',
    erklaerung:
      'Ein Förderantrag, geführt über sein Förderkennzeichen. Er kann Teil eines '
      + 'Verbunds oder eigenständig sein.',
    verwandt: ['fkz', 'tv', 'verbund', 'vorgang'],
  },
  {
    id: 'fkz',
    begriff: 'FKZ',
    lang: 'Förderkennzeichen',
    erklaerung:
      'Die Nummer, unter der ein Förderantrag geführt wird, im Format 16KN###### oder '
      + '16EP######. Jedes Teilvorhaben trägt ein eigenes.',
    verwandt: ['tv', 'verbund'],
  },
  {
    id: 'tv',
    begriff: 'TV',
    lang: 'Teilvorhaben',
    erklaerung:
      'Der Antrag eines einzelnen Partners innerhalb eines Verbundprojekts. Das '
      + 'Teilvorhaben ist die Arbeitseinheit: Status, Kürzel, Aufgaben und Zieltage '
      + 'gelten je Teilvorhaben, nicht je Verbund.',
    verwandt: ['verbund', 'vorgang'],
  },
  {
    id: 'verbund',
    begriff: 'Verbund',
    lang: 'Verbundprojekt',
    erklaerung:
      'Mehrere Teilvorhaben unter einer gemeinsamen Projektbeschreibung. Ein Antrag '
      + 'kann Teil eines Verbunds oder eigenständig sein.',
    verwandt: ['tv', 'vb-verbund'],
  },
  {
    id: 'vb-verbund',
    begriff: 'VB',
    lang: 'Verbund',
    erklaerung:
      'Kurzform für Verbund, vor allem in Spaltennamen und Statusangaben: der '
      + 'VB-Status ist der Status des Verbunds, der TV-Status der eines einzelnen '
      + 'Teilvorhabens. Beide können auseinanderlaufen.',
    verwandt: ['verbund', 'vb-vorhabensbeschreibung'],
  },
  {
    id: 'vb-vorhabensbeschreibung',
    begriff: 'VB',
    lang: 'Vorhabensbeschreibung',
    erklaerung:
      'In der Antrag-Aufbereitung und in der Gutachten-Werkstatt steht VB für das '
      + 'eingereichte Dokument, nicht für den Verbund. Gleiche Buchstaben, andere '
      + 'Bedeutung — welche gemeint ist, sagt der Zusammenhang.',
    verwandt: ['vb-verbund', 'ga'],
  },
  {
    id: 'foerdervariante',
    begriff: 'Fördervariante',
    erklaerung:
      'Der Antragstyp: NW 1, NW 2, FuE, DL, DS — dazu „Irrläufer" für das, was hier '
      + 'nicht hingehört.',
  },
  {
    id: 'richtlinie',
    begriff: 'Richtlinie',
    erklaerung:
      'Die Förderrichtlinie, unter der ein Antrag läuft; ihre Nummer ist zugleich die '
      + 'Programm-Nummer. Trigger gelten je Richtlinie — dasselbe Kürzel kann unter '
      + 'zwei Richtlinien verschieden wirken.',
    verwandt: ['trigger', 'betrachtungsbereich'],
  },

  // ── Artefakte und Schriftstücke ────────────────────────────────────────────
  {
    id: 'ga',
    begriff: 'GA',
    lang: 'Gutachten',
    erklaerung:
      'Das fachliche Gutachten zum Vorhaben, gegliedert in die Abschnitte A bis G.',
    verwandt: ['vb-vorhabensbeschreibung', 'qs'],
  },
  {
    id: 'nf',
    begriff: 'NF',
    lang: 'Nachforderung',
    erklaerung:
      'Die Aufforderung an den Antragsteller, Unterlagen oder Angaben nachzureichen. '
      + 'Die Textbausteine dafür sind kuratiert und werden wortgetreu verwendet.',
    verwandt: ['nl', 'ast'],
  },
  {
    id: 'nl',
    begriff: 'NL',
    lang: 'Nachlieferung',
    erklaerung:
      'Die Unterlagen, die der Antragsteller nachgereicht hat. Ist sie eingegangen, '
      + 'steht „NL prüfen" an.',
    verwandt: ['nf', 'ast'],
  },
  {
    id: 'rne',
    begriff: 'RNE',
    lang: 'Rücknahmeempfehlung',
    erklaerung:
      'Die Empfehlung, den Antrag zurückzunehmen. Sie bildet einen eigenen Strang: '
      + 'solange sie läuft, ruhen die übrigen Aufgaben zu diesem Vorgang.',
    verwandt: ['abl', 'strang', 'sv'],
  },
  {
    id: 'abl',
    begriff: 'ABL',
    lang: 'Ablehnung',
    erklaerung:
      'Der ablehnende Bescheid. Wie die Rücknahmeempfehlung ein eigener Strang, der '
      + 'die übrigen Aufgaben stilllegt, solange er läuft.',
    verwandt: ['rne', 'strang'],
  },
  {
    id: 'sv',
    begriff: 'SV',
    lang: 'Schlussvermerk',
    erklaerung:
      'Der abschließende Vermerk zu einem Vorgang. Vor der Bewilligung wird er von '
      + 'der administrativen Bearbeitung signiert; nach einer Rücknahme schließt er '
      + 'den Vorgang ab.',
    verwandt: ['ab', 'rne'],
  },
  {
    id: 'zuwb',
    begriff: 'ZuwB',
    lang: 'Zuwendungsbescheid',
    erklaerung:
      'Der Bescheid, mit dem die Förderung bewilligt wird. Ist ein Antrag bewilligt, '
      + 'der Bescheid aber noch nicht erstellt, steht „ZuwB erstellen" an.',
    verwandt: ['vn'],
  },
  {
    id: 'vn',
    begriff: 'VN',
    lang: 'Verwendungsnachweis',
    erklaerung:
      'Der Nachweis darüber, wofür die Zuwendung verwendet wurde. Statuswerte, die '
      + 'mit „VN" beginnen, betreffen diesen Nachweis; „ZB" steht daneben für den '
      + 'Zwischenbericht.',
    verwandt: ['zuwb'],
  },
  {
    id: 'precheck',
    begriff: 'PreCheck',
    erklaerung:
      'Die Erstsichtung vor der Hauptprüfung; ihr Ergebnis steuert die Prüftiefe. Sie '
      + 'hat zwei Teile mit verschiedenen Rollen: der TV-PreCheck ist die '
      + 'betriebswirtschaftliche Vorprüfung der administrativen Bearbeitung, der '
      + 'Verbund-PreCheck die inhaltliche Vorprüfung der fachlichen Bearbeitung.',
    verwandt: ['ab', 'fb'],
  },

  // ── Rollen und Ausgaben ────────────────────────────────────────────────────
  {
    id: 'fachrolle',
    begriff: 'Fachrolle',
    erklaerung:
      'Wer im Verfahren zuständig ist: AB, FB, PA, QS, Juristen. Die Fachrolle stammt '
      + 'aus dem Kürzel-Katalog des Fachsystems und steuert, welche Aufgaben als eigene '
      + 'und welche als „wartet auf …" erscheinen; Einträge ohne Rollenvermerk darf '
      + 'jeder setzen und sie bleiben unter jeder Rollenwahl sichtbar.',
    verwandt: ['ausgabe', 'ab', 'fb', 'pa', 'qs', 'regelsatz'],
  },
  {
    id: 'ausgabe',
    begriff: 'Ausgabe und Berechtigung',
    erklaerung:
      'Welche Fassung der App jemand benutzt und was er darin ändern darf: die normale '
      + 'Ausgabe liest mit und schreibt nur in die eigenen Bereiche, die Projektleitung '
      + 'pflegt zusätzlich die Kurations-Daten des Teams, der Kurator kommt nach '
      + 'Passwort-Login an die Verwaltung. Von der Fachrolle unabhängig: dieselbe Person '
      + 'kann AB sein und zugleich die Projektleitungs-Ausgabe benutzen.',
    verwandt: ['fachrolle', 'pl'],
  },
  {
    id: 'ab',
    begriff: 'AB',
    lang: 'administrative Bearbeitung',
    erklaerung:
      'Die Fachrolle für den verwaltenden Teil des Verfahrens — Vollständigkeit, '
      + 'Bescheide, Fristen.',
    verwandt: ['fachrolle', 'fb', 'regelsatz'],
  },
  {
    id: 'fb',
    begriff: 'FB',
    lang: 'fachliche Bearbeitung',
    erklaerung:
      'Die Fachrolle für den inhaltlichen Teil des Verfahrens — Begutachtung, '
      + 'fachliche Nachforderungen.',
    verwandt: ['fachrolle', 'ab', 'ga'],
  },
  {
    id: 'pa',
    begriff: 'PA',
    lang: 'Projektadministration',
    erklaerung: 'Eine der Fachrollen des Verfahrens.',
    verwandt: ['fachrolle'],
  },
  {
    id: 'qs',
    begriff: 'QS',
    lang: 'Qualitätssicherung',
    erklaerung:
      'Eine der Fachrollen des Verfahrens. Kürzel, die QS als setzende Rolle tragen, '
      + 'werden von ihr eingetragen.',
    verwandt: ['fachrolle'],
  },
  {
    id: 'pl',
    begriff: 'PL',
    lang: 'Projektleitung',
    erklaerung:
      'Die Ausgabe der App, die die Kurations-Daten des Teams schreibt — Statuswerte, '
      + 'Kürzel, Regeln, Skills. Keine Fachrolle: PL sagt, was jemand in der App darf, '
      + 'nicht wer im Verfahren zuständig ist.',
    verwandt: ['fachrolle', 'fassung'],
  },
  {
    id: 'ast',
    begriff: 'ASt',
    lang: 'Antragsteller',
    erklaerung:
      'Wer den Antrag gestellt hat — außerhalb des Hauses, deshalb keine Fachrolle. '
      + 'Aufgaben, die auf den Antragsteller warten, kann niemand im Team abarbeiten; '
      + 'sie stehen darum getrennt.',
    verwandt: ['nf', 'nl', 'fachrolle'],
  },

  // ── Systeme ────────────────────────────────────────────────────────────────
  {
    id: 'zah',
    begriff: 'ZAH',
    lang: 'ZIM-Arbeitshilfe',
    erklaerung: 'Diese App — die Arbeitshilfe zum ZIM-Verfahren.',
    verwandt: ['zim', 'c16'],
  },
  {
    id: 'zim',
    begriff: 'ZIM',
    lang: 'Zentrales Innovationsprogramm Mittelstand',
    erklaerung: 'Das Förderprogramm, um dessen Anträge es hier geht.',
    verwandt: ['zah', 'richtlinie'],
  },
  {
    id: 'c16',
    begriff: 'C16',
    erklaerung:
      'Das Fachsystem, in dem die Vorgänge geführt werden: dort werden Kürzel gesetzt, '
      + 'Trigger ändern daraufhin den Status und versenden Mails. Diese App liest den '
      + 'nächtlichen Export und ändert dort nichts. Wofür die Buchstaben stehen, ist '
      + 'hier nicht hinterlegt.',
    verwandt: ['trigger', 'kuerzel', 'status'],
  },

  // ── Die Begriffe des Vorgangssystems ───────────────────────────────────────
  {
    id: 'status',
    begriff: 'Status',
    erklaerung:
      'Der amtliche Zustand eines Antrags im Fachsystem. Dort wird er nicht von Hand '
      + 'gesetzt: jemand trägt ein Kürzel ein, und ein Trigger setzt daraufhin den '
      + 'Status. Diese App liest nur das Ergebnis und kann zeigen, wodurch es '
      + 'entstanden ist.',
    verwandt: ['kuerzel', 'trigger', 'verfahrensschritt', 'arbeitsliste', 'c16'],
  },
  {
    id: 'vorgang',
    begriff: 'Vorgang',
    erklaerung:
      'Ein Teilvorhaben in der Bearbeitung — die Einheit, auf die sich Aufgaben, '
      + 'Kürzel und Zieltage beziehen. Nicht der Verbund: die Regeln lesen überwiegend '
      + 'Spalten des Teilvorhabens.',
    verwandt: ['tv', 'kuerzel'],
  },
  {
    id: 'kuerzel',
    begriff: 'Kürzel',
    erklaerung:
      'Ein Kurzzeichen des Fachsystems für einen Arbeitsschritt (AAE, ABB, XPC). Wer '
      + 'es einträgt, hält fest, dass der Schritt passiert ist; mitgeführt wird meist '
      + 'das Datum dazu.',
    verwandt: ['trigger', 'c16', 'fachrolle'],
  },
  {
    id: 'trigger',
    begriff: 'Trigger',
    erklaerung:
      'Eine Regel des Fachsystems, die an einem Kürzel hängt: wird das Kürzel gesetzt, '
      + 'ändert der Trigger den Status oder verschickt eine Mail. Diese App wertet die '
      + 'importierte Trigger-Tabelle nur aus, um zu erklären, wodurch ein Status '
      + 'entstanden ist.',
    verwandt: ['kuerzel', 'status', 'richtlinie'],
  },
  {
    id: 'verfahrensschritt',
    begriff: 'Verfahrensschritt',
    // Die Schritte werden hier bewusst NICHT aufgezählt: welche es gibt und wie
    // sie heißen, entscheidet die Katalog-Fassung. Eine Liste an dieser Stelle
    // wäre beim nächsten Zuschnitt still falsch — und stünde ausgerechnet im
    // Glossar, das erklären soll.
    erklaerung:
      'Die Gliederung des Verfahrens, die die App über die Status legt — vom Eingang '
      + 'bis zum Abschluss. Keine amtliche Einteilung, sondern eine mit der Fachseite '
      + 'abgestimmte und im Katalog änderbare Lesebrille: welche Schritte gelten und '
      + 'wie sie heißen, steht in den Vorgangs-Regeln und ist an der Verfahrensleiste '
      + 'eines Antrags abzulesen. Im Datenmodell heißt sie ZAH-Phase.',
    verwandt: ['arbeitsliste', 'status', 'marker', 'zieltage'],
  },
  {
    id: 'arbeitsliste',
    begriff: 'Arbeitsliste',
    erklaerung:
      'Die gröbere Einteilung danach, wer am Zug ist; sie bestimmt Reiter, Gruppierung '
      + 'und Farbe in „Förderanträge". Sie steht fest, während der Verfahrensschritt '
      + 'beweglich ist — genau darin unterscheiden sich die beiden.',
    verwandt: ['verfahrensschritt', 'status'],
  },
  {
    id: 'marker',
    begriff: 'Marker',
    erklaerung:
      'Ein Statuswert, der bewusst ohne Verfahrensschritt neben dem Verfahren '
      + 'mitläuft: Irrläufer, Sonderstatus, assoziierter und internationaler Partner. '
      + 'Ein gültiger Zustand, kein Fehler.',
    verwandt: ['verfahrensschritt', 'status'],
  },
  {
    id: 'zieltage',
    begriff: 'Zieltage',
    erklaerung:
      'Nach wie vielen Tagen ohne Vorgangs-Aktivität ein Antrag in diesem Status als '
      + 'hängend gilt. Sind für einen Status keine gepflegt, sagt der '
      + 'Stillstands-Wächter „nicht prüfbar" — nicht „in Ordnung".',
    verwandt: ['verfahrensschritt', 'meilenstein'],
  },
  {
    id: 'meilenstein',
    begriff: 'Meilenstein',
    erklaerung:
      'Zwei Dinge heißen so. Ein Bearbeitungs-Meilenstein ist eine Soll-Frist im '
      + 'Verfahren, gemessen ab Antragseingang — er sagt, ob ein Verbund rechtzeitig '
      + 'dort steht, wo er steht. Projekt-Meilensteine dagegen gehören zum bewilligten '
      + 'Vorhaben und stammen aus dem Antrag selbst.',
    verwandt: ['zieltage'],
  },
  {
    id: 'regelsatz',
    begriff: 'Regelsatz',
    erklaerung:
      'Welche Rolle eine To-do-Kaskade abarbeitet. Fehlt die Angabe an einer Regel, '
      + 'gilt sie für die administrative Bearbeitung.',
    verwandt: ['fachrolle', 'strang'],
  },
  {
    id: 'strang',
    begriff: 'Strang',
    erklaerung:
      'Eine fachliche Kette von Regeln — Rücknahmeempfehlung, Ablehnung, '
      + 'Nachforderung. Eine Sperre kann einen ganzen Strang stilllegen, statt jede '
      + 'Regel einzeln zu benennen.',
    verwandt: ['regelsatz', 'rne', 'abl'],
  },
  {
    id: 'fassung',
    begriff: 'Fassung',
    erklaerung:
      'Ein gespeicherter, aktivierbarer Stand des Katalogs — Statuswerte, Kürzel, '
      + 'Ordner, Regeln. Änderungen sind zunächst ein Entwurf; erst das Speichern für '
      + 'das Team macht daraus eine Fassung, die alle sehen.',
    verwandt: ['pl', 'kuerzel'],
  },
  {
    id: 'betrachtungsbereich',
    begriff: 'Betrachtungsbereich',
    erklaerung:
      'Welche Förder-Richtlinien zum Arbeitsvorrat zählen — die jüngsten '
      + 'Richtlinien-Generationen. Er filtert Listen, Zähler und Fristen; die Suche '
      + 'bleibt am Vollbestand, und jeder Antrag ist über einen Direktlink erreichbar.',
    verwandt: ['richtlinie'],
  },
];
