/**
 * Das Inventar: jedes Element, das sich als Beta oder Experten-Sache
 * kennzeichnen lässt, mit seiner **Vorbelegung**.
 *
 * Der Katalog ist Code (wie `widgetCatalog.ts`), die Kurator-Festlegung liegt
 * als Abweichungs-Overlay darüber (`sidecar.ts`). Beides zusammen ergibt, was
 * gilt — `effektiveMarken()` in `regel.ts`.
 *
 * **Leitsatz der Vorbelegung**
 * - `beta` = ändert sich noch. Wer den Schalter umlegt, will Neues sehen.
 * - `experte` = ausgereift, aber selten und tief. Wer den Schalter umlegt,
 *   arbeitet an der Mechanik, nicht am Vorgang.
 *
 * **Drei Regeln, nach denen hier NICHT markiert wird**
 * 1. *Keine Marke neben einer gleich engen Sperre.* Was ein dev-Flag oder
 *    `kuratorOnly` schon auf dieselbe Zielgruppe eingrenzt, bekommt keine
 *    zweite Abfrage obendrauf — sonst wären die DEV-Panels ausgerechnet im
 *    dev-Build standardmäßig weg. Ein Feature-Flag, das im pl-Build AN ist
 *    (`vorgangssystem`, `statusCockpit`, `anfragen`), grenzt dagegen keine
 *    Zielgruppe ein: dort trägt die Marke etwas bei.
 * 2. *Keine Marke doppelt zum Wirt.* Ein Reiter in einer Beta-Seite bekommt
 *    kein zweites `beta` — die Seite verbirgt ihn ohnehin mit. Markiert wird
 *    nur, was ZUSÄTZLICH einschränkt (Guard `sichtbarkeit-keine-doppelmarke`).
 * 3. *Unantastbares bleibt unantastbar.* Die Wege zu den Schaltern, zum
 *    Kurator-Zugang und zur Modul-Freischaltung tragen nie eine Marke.
 *
 * **Keine Ableitung aus `category: 'erprobung'`.** Die Beta-Menge deckt sich
 * heute mit dieser Sidebar-Gruppe, bleibt aber eine eigene Aussage — sonst
 * wechselte eine Seite ihre Sichtbarkeit als Nebenwirkung eines Umsortierens.
 */
import type { KatalogEintrag, Marken } from './types';
import { abschnittId, reiterId, seiteId, widgetId } from './types';

const OFFEN: Marken = {};
const BETA: Marken = { beta: true };
const EXPERTE: Marken = { experte: true };
const BEIDES: Marken = { beta: true, experte: true };

function seite(id: string, label: string, marken: Marken = OFFEN, unantastbar?: true): KatalogEintrag {
  return { id: seiteId(id), art: 'seite', label, seite: id, marken, ...(unantastbar ? { unantastbar } : {}) };
}

function reiter(wirt: string, key: string, label: string, marken: Marken = OFFEN, unantastbar?: true): KatalogEintrag {
  return { id: reiterId(wirt, key), art: 'reiter', label, seite: wirt, marken, ...(unantastbar ? { unantastbar } : {}) };
}

function abschnitt(wirt: string, key: string, label: string, marken: Marken = OFFEN, unantastbar?: true): KatalogEintrag {
  return { id: abschnittId(wirt, key), art: 'abschnitt', label, seite: wirt, marken, ...(unantastbar ? { unantastbar } : {}) };
}

function widget(typ: string, label: string, marken: Marken = OFFEN): KatalogEintrag {
  return { id: widgetId(typ), art: 'widget', label, seite: 'home', marken };
}

export const SICHTBARKEITS_KATALOG: readonly KatalogEintrag[] = [
  // ---------------------------------------------------------------- Seiten --
  seite('home', 'Home', OFFEN, true),
  seite('antraege', 'Förderanträge'),
  seite('suche', 'Suche'),
  // Hängt bereits am Modul-Schloss `auslastung` (Regel 1) — die Zielgruppe ist
  // dort schon entschieden.
  seite('auslastung', 'Auslastung'),
  // Die Volltext-Ablage neben dem Vorgang: nützlich, aber noch in Bewegung.
  seite('dokumente', 'Dokumente', BETA),
  seite('glossar', 'Glossar'),
  seite('feedback-board', 'Feedback'),
  seite('einstellungen', 'Einstellungen', OFFEN, true),
  seite('kuration', 'Datenpflege', OFFEN, true),
  // Neu, aber für jeden: Fristen betreffen alle Bearbeiter.
  seite('meilensteine', 'Fristen & Meilensteine', BETA),
  seite('zu-klaeren', 'Zu klären', BETA),
  seite('vorgangs-board', 'Vorgangs-Board', BETA),
  seite('anfragen', 'E-Mail Anfragen', BETA),
  // Eigene Route unter `/antraege/:az/aufbereitung`, kein eigenes Plugin.
  seite('aufbereitung', 'Antrag-Aufbereitung', BETA),
  // Neu UND nur für die, die Regeln pflegen — genau der Fall, für den es zwei
  // Achsen gibt.
  seite('status-cockpit', 'Vorgangs-Regeln', BEIDES),
  seite('map-foerderfaehig', 'Förderfähigkeit', BEIDES),
  // Steht im pl-Build für jeden in „Werkzeuge", wirkt aber team-weit
  // (`navHint: 'global'`): die Zielgruppe ist echt enger als die Sichtbarkeit.
  seite('skill-verwaltung-kuration', 'Skill-Verwaltung', EXPERTE),
  // `kuratorOnly` + `dokumentenscan` (Regel 1).
  seite('dokument-review', 'Dokument-Review'),
  // dev-Builds (Regel 1) — eine Marke machte sie dort standardmäßig unsichtbar.
  seite('dev-infrastructure-test', 'DEV: Infra'),
  seite('dev-state-inspector', 'DEV: State'),

  // ---------------------------------------------------------------- Reiter --
  reiter('antraege', 'meine_offenen', 'Antragsphase'),
  reiter('antraege', 'fristen', 'Fristen'),
  reiter('antraege', 'begleitung', 'Begleitung'),
  reiter('antraege', 'alle', 'Alle'),

  reiter('aufbereitung', 'uebersicht', 'Übersicht'),
  reiter('aufbereitung', 'steckbrief', 'Steckbrief'),
  reiter('aufbereitung', 'abdeckung', 'Abdeckung'),
  reiter('aufbereitung', 'zeitplan', 'Zeitplan'),
  reiter('aufbereitung', 'zahlen', 'Zahlen'),
  reiter('aufbereitung', 'verwertung', 'Verwertung/Markt'),
  reiter('aufbereitung', 'glossar', 'Glossar'),
  reiter('aufbereitung', 'fragen', 'Fragen'),
  // Schickt Aufträge an externe Recherche-Ziele — eine bewusste Handlung.
  reiter('aufbereitung', 'recherche', 'Recherche', EXPERTE),
  reiter('aufbereitung', 'lesemodus', 'Lesemodus'),

  reiter('status-cockpit', 'ebenen', 'Ebenen'),
  reiter('status-cockpit', 'katalog', 'Statuswerte'),
  reiter('status-cockpit', 'felder', 'Kürzel'),
  reiter('status-cockpit', 'regeln', 'To-do-Regeln'),
  reiter('status-cockpit', 'klaerfragen', 'Klärfragen'),

  reiter('auslastung', 'klassifizierung', 'Anträge klassifizieren'),
  reiter('auslastung', 'zuweisung', 'Anträge zuweisen'),
  reiter('auslastung', 'uebersicht', 'Auslastung MA'),
  reiter('auslastung', 'kompetenzen', 'Kompetenzen & Jahreskapazitäten'),
  // Kategorien, Zugangspasswörter, Embedding-Korpus — Mechanik, nicht Vorgang.
  reiter('auslastung', 'einstellungen', 'Verwaltung', EXPERTE),

  reiter('suche', 'alle', 'Alle'),
  reiter('suche', 'zuletzt', 'Zuletzt'),
  reiter('suche', 'suchsprache', 'Suchsprache'),
  reiter('suche', 'fragen', 'Fragen'),
  reiter('suche', 'stoebern', 'Stöbern'),

  // Die Entwickler-Sichten hängen schon an der Board-Rolle (Regel 1).
  reiter('feedback-board', 'alle', 'Alles'),
  reiter('feedback-board', 'meine', 'Meine Tickets'),
  reiter('feedback-board', 'wartet', 'Wartet auf mich'),
  reiter('feedback-board', 'neu7', 'Neu diese Woche'),
  reiter('feedback-board', 'fertig', 'Zuletzt umgesetzt'),
  reiter('feedback-board', 'offen', 'Alles offen'),
  reiter('feedback-board', 'mir', 'Mir zugewiesen'),
  reiter('feedback-board', 'triage', 'Triage · ungeschätzt'),
  reiter('feedback-board', 'rueck', 'Rückfragen offen'),
  reiter('feedback-board', 'top', 'Meiste Unterstützer'),

  reiter('kuration', 'uebersicht', 'Übersicht'),
  reiter('kuration', 'csv-quellen', 'CSV-Quellen'),
  reiter('kuration', 'foerderprogramme', 'Förderprogramme'),
  reiter('kuration', 'suche-index', 'Suche & Index'),
  // Konfiguriert die Gegenstelle des Anfragen-Moduls, das selbst `beta` ist.
  reiter('kuration', 'dienste', 'Dienste', BETA),
  reiter('kuration', 'sichtbarkeit', 'Sichtbarkeit', OFFEN, true),

  reiter('einstellungen', 'profil', 'Mein Profil', OFFEN, true),
  reiter('einstellungen', 'darstellung', 'Darstellung & Bedienung'),
  reiter('einstellungen', 'daten', 'Daten & Verbindungen'),
  reiter('einstellungen', 'ki', 'Interne KI'),

  reiter('vorgangs-board', 'arbeit', 'Arbeit'),
  reiter('vorgangs-board', 'fristen', 'Fristen'),
  reiter('vorgangs-board', 'auswertung', 'Auswertung', EXPERTE),

  reiter('map-foerderfaehig', 'einreichungen', 'Einreichungen'),
  reiter('map-foerderfaehig', 'portfolio', 'Portfolio (Prinzipansicht)'),

  reiter('skill-verwaltung-kuration', 'skills', 'Skills'),
  reiter('skill-verwaltung-kuration', 'regeln', 'Qualitätsregeln'),
  reiter('skill-verwaltung-kuration', 'workflows', 'Workflows'),
  reiter('skill-verwaltung-kuration', 'textbausteine', 'Textbausteine', BETA),
  // Nur im dev-Build (`devFixtures`, Regel 1).
  reiter('skill-verwaltung-kuration', 'eval', 'Skill-Eval'),

  reiter('meilensteine', 'uebersicht', 'Übersicht'),
  reiter('meilensteine', 'woche', 'Diese Woche'),
  reiter('meilensteine', 'auswertung', 'Auswertung'),
  reiter('meilensteine', 'konfiguration', 'Konfiguration', EXPERTE),

  reiter('glossar', 'nachschlagen', 'Nachschlagen'),
  reiter('glossar', 'rolle', 'Für meine Rolle wichtig'),

  reiter('zu-klaeren', 'alle', 'Alle Zuordnungen'),
  reiter('zu-klaeren', 'strittig', 'Nur strittige'),
  reiter('zu-klaeren', 'unklar', 'Offene Rückfragen'),
  reiter('zu-klaeren', 'nichtUmgesetzt', 'Nicht umgesetzt'),

  // --------------------------------------------- Abschnitte: Einstellungen --
  abschnitt('einstellungen', 'sec-account', 'Account'),
  abschnitt('einstellungen', 'sec-programm', 'Programmkennung'),
  abschnitt('einstellungen', 'sec-kategorien', 'Meine Kategorien'),
  abschnitt('einstellungen', 'sec-antragstypen', 'Antragstypen'),
  abschnitt('einstellungen', 'sec-themen', 'Themen aus deinen Anträgen'),
  abschnitt('einstellungen', 'sec-kompetenzen', 'Eigene Kompetenzen'),
  abschnitt('einstellungen', 'sec-filter', 'Bearbeiter-Filter'),
  abschnitt('einstellungen', 'sec-home', 'Anträge auf der Startseite'),
  // Die beiden Schalter selbst — eine Marke darauf hätte keinen Rückweg.
  abschnitt('einstellungen', 'sec-umfang', 'Umfang der Oberfläche', OFFEN, true),
  // Der einzige Kurator-Zugang in Builds ohne Schloss.
  abschnitt('einstellungen', 'sec-kurator', 'Kurator-Bereich', OFFEN, true),
  // Der einzige Weg zur Modul-Freischaltung; Ziel des `ModulSchlossGate`.
  abschnitt('einstellungen', 'sec-freischaltung', 'Module freischalten', OFFEN, true),
  abschnitt('einstellungen', 'sec-assistent-protokoll', 'Arbeitsprotokoll', BETA),
  abschnitt('einstellungen', 'sec-assistent-daten', 'Aufgezeichnete Daten', BETA),
  abschnitt('einstellungen', 'sec-assistent-gedaechtnis', 'Persönliches Gedächtnis', BETA),
  // Steckt in der Karte „Persönlicher Assistent" und trägt deren Marke: ohne
  // eigenen Eintrag gilt „unbekannt = sichtbar", und die Klappe stünde allein
  // in einer Karte, deren Schalter gerade ausgeblendet sind (v4.116).
  abschnitt('einstellungen', 'sec-gedaechtnis-eintraege', 'Gedächtnis-Einträge', BETA),

  abschnitt('einstellungen', 'sec-erscheinung', 'Farbschema'),
  abschnitt('einstellungen', 'sec-farbe', 'Primärfarbe'),
  // Eine Musterkarte der Statusfarben — Diagnose, kein Bedienelement.
  abschnitt('einstellungen', 'sec-farb-vorschau', 'Farb-Vorschau', EXPERTE),
  abschnitt('einstellungen', 'sec-tastatur', 'Alle Tastenkürzel'),
  abschnitt('einstellungen', 'sec-widgets', 'Alle Widgets verwalten'),

  abschnitt('einstellungen', 'sec-speicher', 'Ordner'),
  abschnitt('einstellungen', 'sec-verzeichnisse', 'Verbundene Verzeichnisse', EXPERTE),
  abschnitt('einstellungen', 'sec-arbeitsverlauf', 'Arbeitsverlauf', BETA),
  abschnitt('einstellungen', 'sec-doku', 'Persönliche Dokumentenquellen', EXPERTE),
  abschnitt('einstellungen', 'sec-tags', 'Tags'),
  abschnitt('einstellungen', 'sec-tags-liste', 'Alle Tags'),
  abschnitt('einstellungen', 'sec-team', 'Team-Status', BETA),
  abschnitt('einstellungen', 'sec-team-liste', 'Wer ist online', BETA),

  abschnitt('einstellungen', 'sec-kontext', 'Thinking nutzen', EXPERTE),
  abschnitt('einstellungen', 'sec-internki', 'Verbindung'),
  abschnitt('einstellungen', 'sec-internki-einrichtung', 'Verbindung einrichten'),
  // Die vier folgenden stehen nur im dev-Build (Regel 1).
  abschnitt('einstellungen', 'sec-provider', 'Provider'),
  abschnitt('einstellungen', 'sec-zweit-llm', 'Zweit-LLM (Erprobung, dev)'),
  abschnitt('einstellungen', 'sec-aufbereitung-eval', 'Aufbereitung: Baustein-Eval'),
  abschnitt('einstellungen', 'sec-gedaechtnis-eval', 'Gedächtnis: Eval'),
  abschnitt('einstellungen', 'sec-aufbereitung-recherche', 'Externe Recherche-Ziele', BEIDES),
  abschnitt('einstellungen', 'sec-recherche-adressen', 'Ziel-Adressen bearbeiten', BEIDES),

  // ------------------------------------------------ Abschnitte: Datenpflege --
  abschnitt('kuration', 'sec-lage', 'Zu tun'),
  abschnitt('kuration', 'sec-lage-index', 'Suchindex'),
  abschnitt('kuration', 'sec-lage-csv', 'CSV-Datenimport', EXPERTE),
  abschnitt('kuration', 'sec-lage-review', 'Dokument-Prüfung'),
  abschnitt('kuration', 'sec-sitzung', 'Kurator-Sitzung'),

  abschnitt('kuration', 'sec-csv-quellen', 'Registrierte Quellen'),
  abschnitt('kuration', 'sec-csv-zustand', 'Zustand'),
  // Beide stehen heute schon in einer Gruppe namens „Selten gebraucht".
  abschnitt('kuration', 'sec-csv-wartung', 'Antrags-Daten zurücksetzen', EXPERTE),
  abschnitt('kuration', 'sec-csv-wiederherstellen', 'CSV-Schemas wiederherstellen', EXPERTE),

  // Der äußerste Rahmen der Daten: wird selten angefasst, wiegt aber schwer.
  abschnitt('kuration', 'sec-programme', 'Programme', EXPERTE),
  abschnitt('kuration', 'sec-unterprogramme', 'Unterprogramme'),
  abschnitt('kuration', 'sec-filter', 'Filter verwalten'),
  abschnitt('kuration', 'sec-filter-kurator', 'Kurator-Filter'),
  abschnitt('kuration', 'sec-filter-system', 'System-Filter', EXPERTE),
  abschnitt('kuration', 'sec-filter-nutzer', 'Nutzer-Vorlagen', EXPERTE),

  // „Dokumenten-" ist nicht schmueckend: daneben steht 'sec-embedding-korpus',
  // und das ist ebenfalls ein Index. Die Id bleibt (Vertrag), das Label sagt,
  // welcher gemeint ist.
  abschnitt('kuration', 'sec-index', 'Dokumenten-Index pflegen'),
  abschnitt('kuration', 'sec-index-zustand', 'Zustand'),
  abschnitt('kuration', 'sec-dokumentenquellen', 'Dokumentenquellen'),
  abschnitt('kuration', 'sec-index-erweitert', 'Modelle, Suchqualität, Zurücksetzen', EXPERTE),
  abschnitt('kuration', 'sec-embedding-korpus', 'Vektoren der Ähnlichkeitssuche', EXPERTE),

  abschnitt('kuration', 'sec-anfragen', 'ZIM FAQ-Assistent'),
  abschnitt('kuration', 'sec-anfragen-url', 'URL des Assistenten'),

  abschnitt('kuration', 'sec-sichtbarkeit', 'Beta & Expertenmodus', OFFEN, true),
  // Erklärt genau diese Schalter — sie mit ihnen ausblenden zu können wäre
  // dieselbe Sackgasse wie der Schalter selbst.
  abschnitt('kuration', 'sec-sichtbarkeit-hilfe', 'Wie das gemeint ist', OFFEN, true),

  // --------------------------------------- Abschnitte: Verbund-Detailseite --
  abschnitt('antraege', 'detail-kurzbeschreibung', 'Kurzbeschreibung'),
  abschnitt('antraege', 'detail-status', 'Status'),
  abschnitt('antraege', 'detail-offeneAufgaben', 'Offene Aufgaben', BETA),
  abschnitt('antraege', 'detail-naechsteSchritte', 'Nächste Schritte', BETA),
  abschnitt('antraege', 'detail-statuseintraege', 'Statuseinträge', BETA),
  abschnitt('antraege', 'detail-meilensteine', 'Meilensteine'),
  // Der Gutachten-Workflow A–G steht offen: er ist das Tagesgeschäft der
  // Gutachtenden, nicht ihr Sonderwerkzeug.
  abschnitt('antraege', 'detail-gutachten', 'Gutachten'),
  abschnitt('antraege', 'detail-kurzfassung', 'Kurzfassung'),
  abschnitt('antraege', 'detail-antragsdaten', 'Antragsdaten'),
  abschnitt('antraege', 'detail-werkbank', 'Werkbank', BETA),
  abschnitt('antraege', 'detail-widerspruch', 'Widerspruch', BETA),
  abschnitt('antraege', 'detail-nachforderungen', 'Nachforderungen', BETA),
  abschnitt('antraege', 'detail-alleFelder', 'Alle Felder'),
  abschnitt('antraege', 'detail-historie', 'Historie'),

  // ------------------------------------- Karten auf den Fachseiten (v4.114) --
  // Bis hierher endete der Katalog bei Seite und Reiter; die Karten der großen
  // Fachseiten standen nur als JSX da. Sie tragen ihre Id jetzt über
  // `<WennSichtbar id={abschnittId(…)}>` (Guard `sichtbarkeit-ids-existieren`).
  //
  // **Fast alle stehen hier ohne Marke** — und das ist kein Versäumnis, sondern
  // Regel 2: ihre Wirte sind bereits markiert (Vorgangs-Regeln = beta+experte,
  // Aufbereitung und Vorgangs-Board = beta, „Verwaltung"/„Auswertung"/
  // „Recherche" = experte, Auslastung hängt am Modul-Schloss). Eine Marke am
  // Kind wäre dieselbe Aussage doppelt. Der Eintrag ist trotzdem da: er ist der
  // Griff, den der Kurator braucht, sobald er einen Wirt LOCKERT — genau wie
  // die fünf unmarkierten Reiter der Vorgangs-Regeln.
  abschnitt('status-cockpit', 'karte-referenzdaten', 'Referenzdaten (Vorgangssystem)'),
  abschnitt('status-cockpit', 'karte-versionen', 'Versionen'),

  abschnitt('auslastung', 'karte-statistik', 'Statistik-Übersicht'),
  abschnitt('auslastung', 'karte-ma-liste', 'Mitarbeiter & Kapazität'),
  abschnitt('auslastung', 'karte-kategorien', 'Überkategorien'),
  abschnitt('auslastung', 'karte-import-export', 'Import / Export'),
  abschnitt('auslastung', 'karte-konfiguration', 'Konfiguration'),
  abschnitt('auslastung', 'karte-themen-vektoren', 'Themen-Vektoren für Klassifizierung'),

  abschnitt('vorgangs-board', 'karte-phasenverteilung', 'Verteilung über die ZAH-Phasen'),
  abschnitt('vorgangs-board', 'karte-stau', 'Stau je Rolle'),
  abschnitt('vorgangs-board', 'karte-liegezeit', 'Liegezeit je Status'),
  abschnitt('vorgangs-board', 'karte-fristrisiko', 'Fristrisiko'),

  // Die einzige Karte mit eigener Marke: ein Wegweiser auf den Reiter
  // „Recherche", der `experte` ist. Ohne die Marke stünde auf der Übersicht ein
  // Verweis auf einen Reiter, den es für diesen Leser nicht gibt.
  abschnitt('aufbereitung', 'karte-externe-recherche', 'Externe Recherche', EXPERTE),
  abschnitt('aufbereitung', 'karte-interne-aufbereitung', 'Interne Aufbereitung'),
  abschnitt('aufbereitung', 'karte-deterministisch', 'Deterministische Aufbereitung'),
  abschnitt('aufbereitung', 'karte-deep-research', 'Deep Research starten'),
  abschnitt('aufbereitung', 'karte-marktzugang', 'Marktzugang des KMU'),
  abschnitt('aufbereitung', 'karte-ergebnis-import', 'Ergebnis zurückbringen'),
  abschnitt('aufbereitung', 'karte-einzelanfragen', 'Einzel-Suchanfragen aus dem Steckbrief'),

  // ------------------------------------------------- Startseiten-Widgets --
  widget('weitermachen', 'Weitermachen'),
  widget('meine-antraege', 'Meine Anträge'),
  widget('kanban', 'Kanban'),
  widget('antragseingang', 'Antragseingang'),
  widget('ai-assistent', 'KI-Assistent'),
  widget('notizen', 'Notizen'),
  widget('qs-freigaben', 'Meine Entwürfe in dieser App'),
  widget('feedback-news', 'Feedback-Neuigkeiten'),
  // Hängt am Modul-Schloss bzw. an der Kurator-Freischaltung (Regel 1).
  widget('auslastung', 'Auslastung'),
  widget('registry-aenderungen', 'Zuletzt geändert: Skills & Regeln'),
  widget('neue-antraege', 'Neue Anträge für dich'),
  // Dieselbe Marke wie die Seite, an deren Katalog es hängt.
  widget('status-verlauf', 'Status & Verlauf', BEIDES),
  widget('fristen', 'Fristen', BETA),
  widget('nachtlauf', 'Änderungen der letzten Nacht', BETA),
  // `verfuegbar: false` seit v4.87 — das vorhandene Flag entscheidet weiter.
  widget('meilensteine', 'Meilensteine diese Woche'),
  widget('haengt-fest', 'Hängt fest'),
];
