/**
 * Seed der Förderfähigkeits-Checkliste (Einzelprojekt / KMU-Teilvorhaben).
 *
 * Abgeleitet aus den Papier-Checklisten der Fachprüfung. Die Kriterien und die
 * Bewertungsanker sind WÖRTLICH übernommen — die Prüferinnen und Prüfer sollen
 * ihr Formular wiedererkennen. Umformuliert wird nichts; ergänzte Items tragen
 * `herkunft: 'app'` und sind damit von der Vorlage unterscheidbar.
 *
 * Zwei Vorlagen liegen zugrunde:
 *   `check-KMU`   — die binären Kriterien samt bedingter Blöcke
 *   `Inno-Score`  — die Entscheidungshilfe mit den drei Skala-Kategorien B0…B3
 *
 * Nicht abgebildet (bewusst ausserhalb dieses Moduls): die Verbund-Gesamtprüfung,
 * die Variante für Forschungseinrichtungen und der vorgelagerte PreCheck.
 *
 * Kohärentes Daten-File — die Länge ist Inhalt, nicht vermischte Verantwortung.
 */
import type { MapChecklistenDefinition, MapChecklistenItem, MapSkalaAnker } from './typen';

/** Ab dieser Punktzahl entfällt die vertiefte Einzelprüfung (Z-Items). */
export const INNO_SCORE_KURZPFAD = 8;

/** Ab dieser Auftragssumme verlangt die Praxis drei prüffähige Angebote. */
export const ANGEBOTE_PFLICHT_AB_EUR = 15000;

// ---------------------------------------------------------------------------
// Entscheidungshilfe Innovationsgrad — Anker wörtlich
// ---------------------------------------------------------------------------

const ANKER_ZIELSTELLUNG: readonly MapSkalaAnker[] = [
  {
    stufe: 'B0', punkte: 0, kurz: 'unzureichend',
    merkmale: [
      'Kein Übertreffen des SdT',
      'Zielparameter / Zielfunktionen übertreffen Parameter bestehender Erzeugnisse nicht oder nur gering',
    ],
  },
  {
    stufe: 'B1', punkte: 1, kurz: 'ausreichend',
    merkmale: [
      'Orientierung am SdT',
      'wesentlichsten Zielparameter / Zielfunktionen übertreffen die Parameter / Funktionen bestehender Erzeugnisse am Markt',
      'Verbesserungen vorwiegend qualitativ beschrieben',
    ],
  },
  {
    stufe: 'B2', punkte: 2, kurz: 'übertroffen',
    merkmale: [
      'Übertreffen des SdT',
      'Großteil der Zielparameter / Zielfunktionen übertrifft die Parameter / Funktionen bestehender Erzeugnisse am Markt',
      'wesentliche Merkmale messbar und vorwiegend quantitativ beschrieben',
    ],
  },
  {
    stufe: 'B3', punkte: 3, kurz: 'deutlich übertroffen',
    merkmale: [
      'Deutliches Übertreffen des SdT',
      'Parameter / Funktionen bestehender Erzeugnisse am Markt werden vollumfänglich übertroffen',
      'alle wesentlichen Merkmale messbar und quantitativ beschrieben',
    ],
  },
];

const ANKER_LOESUNGSANSATZ: readonly MapSkalaAnker[] = [
  {
    stufe: 'B0', punkte: 0, kurz: 'unzureichend',
    merkmale: [
      'Keine neuartigen Entwicklungsansätze',
      'lediglich geringfügige Anpassungen bzw. Weiterentwicklungen',
      'Ansätze nicht plausibel',
    ],
  },
  {
    stufe: 'B1', punkte: 1, kurz: 'ausreichend',
    merkmale: [
      'Neue Kombination bestehender Lösungsansätze unter Einsatz neuer Technologien im Unternehmen',
    ],
  },
  {
    stufe: 'B2', punkte: 2, kurz: 'übertroffen',
    merkmale: [
      'Übertragung des Lösungsansatzes aus anderen Anwendungen unter Einsatz neuer Technologien',
      'Neuer Lösungsansatz basierend auf der Anwendungsorientierten Forschung oder einem Demonstrator',
    ],
  },
  {
    stufe: 'B3', punkte: 3, kurz: 'deutlich übertroffen',
    merkmale: ['Völlig neuer Lösungsansatz basierend auf Grundlagenforschung'],
  },
];

const ANKER_RISIKEN: readonly MapSkalaAnker[] = [
  {
    stufe: 'B0', punkte: 0, kurz: 'unzureichend',
    merkmale: [
      'Keine erheblichen Risiken erkennbar oder Risiken nicht überwindbar',
      'Realisierbarkeit nicht nachgewiesen oder erkennbar',
      'keine oder geringe Erfolgschancen',
      'Markteinführungskonzept nicht plausibel',
    ],
  },
  {
    stufe: 'B1', punkte: 1, kurz: 'ausreichend',
    merkmale: [
      'beherrschbare Risiken ansatzweise erkennbar',
      'Erfolgschancen erkennbar',
      'Erfüllt Mindestvoraussetzungen zum Markteinführungskonzept',
    ],
  },
  {
    stufe: 'B2', punkte: 2, kurz: 'übertroffen',
    merkmale: [
      'Erhebliche Risiken erkennbar',
      'mittlere Erfolgschancen',
      'Markteinführungskonzept plausibel',
    ],
  },
  {
    stufe: 'B3', punkte: 3, kurz: 'deutlich übertroffen',
    merkmale: [
      'erhebliche Risiken erkennbar (deutlicher Projektbezug)',
      'hohe Erfolgschancen',
      'Markteinführungskonzept überzeugend und herausragend',
    ],
  },
];

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const GRUPPE_INNO = 'Innovationsgehalt, Risiken und Chancen des FuE-Projekts';
const GRUPPE_AUFTRAEGE = 'Projektbezogene Aufträge an Dritte';

const ITEMS: readonly MapChecklistenItem[] = [
  // --- Innovationsgrad (Entscheidungshilfe) ---------------------------------
  {
    id: 'inno.zielstellung',
    gruppe: 'Innovationsgrad (Entscheidungshilfe)',
    kriterium: 'Zielstellung im Vergleich zum Stand der Technik (Parameter und Produktmerkmale)',
    art: 'skala', klasse: 'S', herkunft: 'inno-score', aktiv: true,
    fundstelle: 'Entscheidungshilfe Innovationsgrad',
    anker: ANKER_ZIELSTELLUNG,
  },
  {
    id: 'inno.loesungsansatz',
    gruppe: 'Innovationsgrad (Entscheidungshilfe)',
    kriterium: 'Entwicklungs- / Lösungsansatz',
    art: 'skala', klasse: 'S', herkunft: 'inno-score', aktiv: true,
    fundstelle: 'Entscheidungshilfe Innovationsgrad',
    anker: ANKER_LOESUNGSANSATZ,
  },
  {
    id: 'inno.risiken',
    gruppe: 'Innovationsgrad (Entscheidungshilfe)',
    kriterium: 'Technische Risiken und Erfolgschancen',
    art: 'skala', klasse: 'S', herkunft: 'inno-score', aktiv: true,
    fundstelle: 'Entscheidungshilfe Innovationsgrad',
    anker: ANKER_RISIKEN,
  },

  // --- Zuwendungsvoraussetzungen -------------------------------------------
  {
    id: 'zuwendung.website',
    gruppe: 'Zuwendungsvoraussetzungen',
    kriterium: 'Das Produkt/Verfahren/die DL wird noch nicht auf der Website des Antragstellers beworben',
    art: 'binaer', klasse: 'E', herkunft: 'check-kmu', aktiv: true,
    hinweis: 'Website des Antragstellers prüfen.',
  },
  {
    id: 'zuwendung.doppelfoerderung',
    gruppe: 'Zuwendungsvoraussetzungen',
    kriterium: 'Nachlieferungen sowie erneuter Abgleich mit Anlage 3 und ZIM-Statusmonitor widerlegen Anhaltspunkte auf Doppelförderung.',
    art: 'binaer', klasse: 'E', herkunft: 'check-kmu', aktiv: true,
    bedingung: {
      art: 'manuell',
      frage: 'Zeigten sich im PreCheck bereits Anhaltspunkte auf Doppelförderung?',
    },
    fundstelle: 'Anlage 3 · ZIM-Statusmonitor',
  },

  // --- Innovationsgehalt ----------------------------------------------------
  {
    id: 'inno.eigenstaendig',
    gruppe: GRUPPE_INNO,
    kriterium: 'Das TV ist als eigenständiger Antrag im Verbund sinnvoll und erforderlich',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
  },
  {
    id: 'inno.schutzrechte',
    gruppe: GRUPPE_INNO,
    kriterium: 'Die Schutz- und Nutzungsrechte wurden ausreichend geprüft (siehe Anlage 4)',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    fundstelle: 'Anlage 4',
  },
  {
    id: 'inno.risiko-beherrschbar',
    gruppe: GRUPPE_INNO,
    kriterium: 'Es liegt ein hohes, aber beherrschbares Risiko vor',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    bedingung: { art: 'innoScoreUnter', schwelle: INNO_SCORE_KURZPFAD },
  },
  {
    id: 'inno.loesung-plausibel',
    gruppe: GRUPPE_INNO,
    kriterium: 'Der Lösungsansatz ist nachvollziehbar und plausibel',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    bedingung: { art: 'innoScoreUnter', schwelle: INNO_SCORE_KURZPFAD },
  },
  {
    id: 'inno.zielkriterien',
    gruppe: GRUPPE_INNO,
    kriterium: 'Es sind plausible und kontrollierbare Zielkriterien benannt',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    bedingung: { art: 'innoScoreUnter', schwelle: INNO_SCORE_KURZPFAD },
  },

  // --- Wirtschaftliche Entwicklung -----------------------------------------
  {
    id: 'wirtschaft.wirkungen-dargestellt',
    gruppe: 'Wirtschaftliche Entwicklung bei erfolgreichem Projektabschluss',
    kriterium: 'Der Antragsteller hat die projektbezogenen Wirkungen nachvollziehbar verbal, plausibel und quantifiziert dargestellt (Schaffung AP; Umsatz, Konsistenz der Angaben)',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
  },
  {
    id: 'wirtschaft.wirkungen-rechtfertigen',
    gruppe: 'Wirtschaftliche Entwicklung bei erfolgreichem Projektabschluss',
    kriterium: 'Die geplanten projektbezogenen Wirkungen rechtfertigen die Förderung',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    hinweis: 'Richtwert: projektbezogene Umsätze ≥ Projektkosten TV | Personalzuwachs > 0 — Ausnahmen möglich, dann plausible Begründung erforderlich',
  },

  // --- Arbeitsplanung -------------------------------------------------------
  {
    id: 'arbeitsplan.ap-untersetzt',
    gruppe: 'Arbeitsplanung',
    kriterium: 'Es liegen ausreichend untersetzte Arbeitspakete (AP) vor (keine AP mit mehr als 6 PM)',
    art: 'binaer', klasse: 'K', herkunft: 'check-kmu', aktiv: true,
    vorbelegung: { befundPraefixe: ['ap-pm-grenze'] },
  },
  {
    id: 'arbeitsplan.inhalte-eindeutig',
    gruppe: 'Arbeitsplanung',
    kriterium: 'Die dargestellten Arbeitsinhalte sind eindeutig und plausibel',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
  },
  {
    id: 'arbeitsplan.relationen',
    gruppe: 'Arbeitsplanung',
    kriterium: 'Die Relationen zwischen den AP ist stimmig. (vorbereitende Tätigkeiten: Entwicklungsaufgabe: Tests/Auswertung)',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
  },
  {
    id: 'arbeitsplan.aufwand-angemessen',
    gruppe: 'Arbeitsplanung',
    kriterium: 'Der geplante Aufwand für alle Arbeitspakete ist angemessen (ggfs. kürzen)',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
  },
  {
    id: 'arbeitsplan.ap-foerderfaehig',
    gruppe: 'Arbeitsplanung',
    kriterium: 'Alle Arbeitspakete sind förderfähig (ggfs. streichen)',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
  },

  // --- Eignung des Unternehmens --------------------------------------------
  {
    id: 'eignung.qualifikation',
    gruppe: 'Eignung des Unternehmens',
    kriterium: 'Die Qualifikation des Personals (einschließlich nicht benannter MA) entspricht den Anforderungen im geplanten Vorhaben',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
  },
  {
    id: 'eignung.benanntes-personal',
    gruppe: 'Eignung des Unternehmens',
    kriterium: 'Die wesentlichen FuE-Aufgaben sind durch namentlich benanntes Personal abgedeckt (nicht nur N.N. Mitarbeiter, Verhältnis N.N. zu benanntem Personal bezogen auf die Aufgaben muss stimmen)',
    art: 'binaer', klasse: 'K', herkunft: 'check-kmu', aktiv: true,
    vorbelegung: { nnAnteil: true },
  },
  {
    id: 'eignung.darstellung',
    gruppe: 'Eignung des Unternehmens',
    kriterium: 'Es liegt eine ausreichende Darstellung des Antragstellers und seiner Entwicklung vor und das Potenzial entspricht den Projektanforderungen (fachliche Kompetenz / firmeneigenes Know-how, technologische Infrastruktur etc. – siehe Anlage 2)',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    fundstelle: 'Anlage 2',
  },
  {
    id: 'eignung.fue-personal',
    gruppe: 'Eignung des Unternehmens',
    kriterium: 'Der Antragsteller beschäftigt FuE-Personal (Mantelbogen S. 2 bzw. Anlage 2: FuE-Beschäftigte JAE > 0)',
    art: 'binaer', klasse: 'E', herkunft: 'check-kmu', aktiv: true,
    fundstelle: 'Mantelbogen S. 2 · Anlage 2',
  },
  {
    id: 'eignung.verwertungspflicht',
    gruppe: 'Eignung des Unternehmens',
    kriterium: 'Das Unternehmen ist in der Vergangenheit seiner Verwertungspflicht nachgekommen (siehe Anlage 3, ggf. auch Anlage 2)',
    art: 'binaer', klasse: 'E', herkunft: 'check-kmu', aktiv: true,
    hinweis: 'Hier geht es nicht allein um erbrachte VN, sondern um die Umsetzung der Ergebnisse bisheriger Förderungen!',
    fundstelle: 'Anlage 3 · Anlage 2',
  },
  {
    id: 'eignung.effekte',
    gruppe: 'Eignung des Unternehmens',
    kriterium: 'Bisherige Förderungen haben zu positiven wirtschaftlichen Effekten beim Unternehmen geführt',
    art: 'binaer', klasse: 'E', herkunft: 'check-kmu', aktiv: true,
  },

  // --- Aufträge an Dritte (bedingter Block) --------------------------------
  {
    id: 'auftraege.angebote',
    gruppe: GRUPPE_AUFTRAEGE,
    kriterium: 'Es liegen prüffähige Angebote oder Inhaltsbeschreibungen vor',
    art: 'binaer', klasse: 'E', herkunft: 'check-kmu', aktiv: true,
    bedingung: { art: 'auftraegeDritteGeplant' },
    hinweis: `Ggf. Nachforderung / MS / Projektcontrolling (3 Angebote ab ${(ANGEBOTE_PFLICHT_AB_EUR / 1000).toLocaleString('de-DE')} T€-Grenze) — Hinweis an AB als Erinnerung`,
    fundstelle: 'Anlage 6.3 a',
  },
  {
    id: 'auftraege.foerderfaehig',
    gruppe: GRUPPE_AUFTRAEGE,
    kriterium: 'Die Aufträge sind inhaltlich förderfähig und plausibel',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    bedingung: { art: 'auftraegeDritteGeplant' },
  },
  {
    id: 'auftraege.kostenrahmen',
    gruppe: GRUPPE_AUFTRAEGE,
    kriterium: 'Der Kostenrahmen ist angemessen',
    art: 'binaer', klasse: 'S', herkunft: 'check-kmu', aktiv: true,
    bedingung: { art: 'auftraegeDritteGeplant' },
  },
  {
    id: 'auftraege.auftragnehmer-benannt',
    gruppe: GRUPPE_AUFTRAEGE,
    kriterium: 'Alle projektbezogenen Auftragnehmer sind benannt',
    art: 'binaer', klasse: 'E', herkunft: 'check-kmu', aktiv: true,
    bedingung: { art: 'auftraegeDritteGeplant' },
    hinweis: 'Ggf. Nachforderung Anlage 7',
    fundstelle: 'Anlage 7',
  },

  // --- Ergänzung der App ----------------------------------------------------
  {
    id: 'kalkulation.rechnerisch',
    gruppe: 'Kalkulation',
    kriterium: 'Die Kalkulation ist rechnerisch schlüssig (Kostensumme, Fördersatz, Personenmonate)',
    art: 'binaer', klasse: 'R', herkunft: 'app', aktiv: true,
    hinweis: 'Ergänzung der App: bündelt die deterministischen Rechenchecks des Imports. Nicht Teil der Papiervorlage.',
    vorbelegung: {
      befundPraefixe: ['kosten-summe', 'zuwendung-foerdersatz', 'pm-summe', 'ap-zeitraum', 'einsatz-jahr', 'ap-ref-verwaist'],
    },
  },
];

/**
 * Zuordnung Kriterium → Themen der Nachforderungs-Bausteine.
 *
 * Getrennt von der Item-Liste, weil es genau das ist: eine Zuordnungstabelle
 * zwischen zwei kuratierten Beständen. Die Werte sind Themen aus
 * `nf-bausteine.seed.ts` — die Suche gleicht sie gegen Thema und Text ab.
 * Fehlt ein Eintrag, sucht der Abschluss mit dem Kriteriumstext selbst.
 */
const NF_SUCHBEGRIFFE: Readonly<Record<string, readonly string[]>> = {
  'inno.zielstellung': ['Innovationsgehalt Innovationshöhe'],
  'inno.loesungsansatz': ['Vorhabensbeschreibung', 'Technische Erfolgswahrscheinlichkeit'],
  'inno.risiken': ['Technische Risiken'],
  'inno.eigenstaendig': ['Vorhabensbeschreibung'],
  'inno.schutzrechte': ['Schutzrechte'],
  'inno.risiko-beherrschbar': ['Technische Risiken'],
  'inno.loesung-plausibel': ['Vorhabensbeschreibung', 'Technische Erfolgswahrscheinlichkeit'],
  'inno.zielkriterien': ['Zielkriterien', 'Meilensteine'],
  'wirtschaft.wirkungen-dargestellt': ['Umsätze nicht nachvollziehbar', 'Marktbeschreibung'],
  'wirtschaft.wirkungen-rechtfertigen': ['Niedrige Umsätze', 'Verzögerte Vermarktung'],
  'arbeitsplan.ap-untersetzt': ['Große Arbeitspakete'],
  'arbeitsplan.inhalte-eindeutig': ['Vorhabensbeschreibung', 'Arbeitsaufwand'],
  'arbeitsplan.relationen': ['Unausgewogene Relation'],
  'arbeitsplan.aufwand-angemessen': ['Hoher Aufwand', 'Arbeitsaufwand'],
  'arbeitsplan.ap-foerderfaehig': ['Nicht förderfähige Arbeitspakete'],
  'eignung.qualifikation': ['Qualifikation benanntes Personal'],
  'eignung.benanntes-personal': ['Nur N.N.-Personal', 'Projektpersonal'],
  'eignung.darstellung': ['Kompetenz des Antragstellers'],
  'eignung.fue-personal': ['FuE-Personal-Angaben'],
  'eignung.effekte': ['Positive Effekte bisheriger Projekte'],
  'auftraege.angebote': ['Zu projektbezogenen Aufträgen an Dritte'],
  'auftraege.foerderfaehig': ['Zu projektbezogenen Aufträgen an Dritte'],
  'auftraege.kostenrahmen': ['Zu projektbezogenen Aufträgen an Dritte'],
  'auftraege.auftragnehmer-benannt': ['Zu projektbezogenen Aufträgen an Dritte'],
};

/**
 * Zuordnung Kriterium → Prüfaspekte A–J der Antrag-Aufbereitung.
 *
 * Über diese Achse bezieht ein Kriterium seine Fundstellen in der
 * Vorhabensbeschreibung. Kriterien ohne Eintrag (etwa die rein externen
 * Recherchen) zeigen bewusst keine Fundstellen — beliebige wären schlechter
 * als keine.
 *
 * A Ausgangssituation · B Projektgegenstand · C Technische Funktionalitäten ·
 * D Technische Risiken · E Stand der Technik · F Realisierbarkeit ·
 * G Fachliche Eignung · H Projektplan · I Märkte · J Meilensteine
 */
const ASPEKTE: Readonly<Record<string, readonly string[]>> = {
  'inno.zielstellung': ['E', 'C'],
  'inno.loesungsansatz': ['B', 'C', 'F'],
  'inno.risiken': ['D', 'F'],
  'inno.eigenstaendig': ['B'],
  'inno.risiko-beherrschbar': ['D'],
  'inno.loesung-plausibel': ['B', 'C', 'F'],
  'inno.zielkriterien': ['J'],
  'wirtschaft.wirkungen-dargestellt': ['I'],
  'wirtschaft.wirkungen-rechtfertigen': ['I', 'J'],
  'arbeitsplan.ap-untersetzt': ['H'],
  'arbeitsplan.inhalte-eindeutig': ['H', 'C'],
  'arbeitsplan.relationen': ['H'],
  'arbeitsplan.aufwand-angemessen': ['H'],
  'arbeitsplan.ap-foerderfaehig': ['H', 'B'],
  'eignung.qualifikation': ['G'],
  'eignung.benanntes-personal': ['G', 'H'],
  'eignung.darstellung': ['G', 'F'],
};

/** Startfassung der Checkliste. Version 1 — der Editor zählt ab hier hoch. */
export const CHECKLISTE_SEED: MapChecklistenDefinition = {
  id: 'zim-fachpruefung-ep',
  titel: 'Fachprüfung Förderfähigkeit (Einzelprojekt)',
  version: 1,
  geaendertAm: '2026-07-20T00:00:00.000Z',
  geaendertVon: null,
  quellen: ['check-KMU', 'Entscheidungshilfe Innovationsgrad'],
  innoScoreKurzpfad: INNO_SCORE_KURZPFAD,
  items: ITEMS.map(item => ({
    ...item,
    ...(NF_SUCHBEGRIFFE[item.id] ? { nfSuchbegriffe: NF_SUCHBEGRIFFE[item.id] } : {}),
    ...(ASPEKTE[item.id] ? { aspekte: ASPEKTE[item.id] } : {}),
  })),
};
