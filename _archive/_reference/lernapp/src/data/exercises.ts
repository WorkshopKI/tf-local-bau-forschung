import type { Exercise } from "@/types";

export type { Exercise } from "@/types";

export const exercises: Exercise[] = [
  {
    id: 1,
    level: 1,
    badPrompt: "Was soll ich kochen?",
    context: "Fragen - Rezeptsuche",
    improvementHints: [
      "Füge Informationen über verfügbare Zutaten hinzu",
      "Gib an, für wie viele Personen gekocht werden soll",
      "Erwähne Ernährungspräferenzen oder Allergien",
      "Definiere die Art der Mahlzeit (Frühstück, Mittag, Abend)"
    ],
    goodExample: "Suche ein vegetarisches Abendessen-Rezept für 4 Personen mit Tomaten, Pasta und Zwiebeln, die ich zu Hause habe. Keine Milchprodukte.",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true },
    departmentVariants: [
      {
        department: "legal",
        badPrompt: "Prüf mal den Vertrag.",
        context: "Fragen - Vertragsprüfung",
        improvementHints: [
          "Benenne den Vertragstyp und die Parteien",
          "Gib an, welche Klauseln geprüft werden sollen",
          "Erwähne das anwendbare Recht (BGB, HGB, etc.)",
          "Definiere das Prüfziel (Risiken, Vollständigkeit, AGBs)"
        ],
        goodExample: "Prüfe den beigefügten Dienstleistungsvertrag zwischen unserer Behörde und {{Auftragnehmer}} auf: Haftungsklauseln, Kündigungsfristen, DSGVO-Konformität der Auftragsverarbeitung. Markiere kritische Stellen und schlage Alternativformulierungen vor. [JURIST:IN PRÜFEN]"
      },
      {
        department: "oeffentlichkeitsarbeit",
        badPrompt: "Schreib eine Pressemitteilung.",
        context: "Fragen - Pressearbeit",
        improvementHints: [
          "Benenne das konkrete Thema oder Ereignis",
          "Gib die Zielgruppe (lokale Medien, Fachpresse) an",
          "Erwähne Kernbotschaft und Zitat-Geber:in",
          "Definiere Länge und Aufbau"
        ],
        goodExample: "Erstelle eine Pressemitteilung (max. 300 Wörter) zum neuen Bürgerservice-Portal unserer Kommune. Kernbotschaft: 24/7 Online-Zugang zu 50 Verwaltungsleistungen. Zitat von Bürgermeister:in {{Name}}. Aufbau: Lead, Details, Zitat, Hintergrund, Kontakt. [PRESSESTELLE FREIGABE]"
      },
      {
        department: "hr",
        badPrompt: "Schreib eine Stellenanzeige.",
        context: "Fragen - Personalgewinnung",
        improvementHints: [
          "Benenne die konkrete Stelle und Entgeltgruppe",
          "Gib Muss- und Kann-Anforderungen an",
          "Erwähne AGG-konforme Formulierung",
          "Definiere Aufgabenschwerpunkte"
        ],
        goodExample: "Erstelle eine Stellenausschreibung für Sachbearbeiter:in Haushalt (m/w/d), EG 9b TVöD, in der Kämmerei. 5 Kernaufgaben, Muss: Verwaltungsfachwirt:in, Kann: SAP-Kenntnisse. AGG-konform, Schwerbehinderten-Hinweis. [HR-LEITUNG PRÜFEN]"
      },
      {
        department: "it",
        badPrompt: "Da ist ein Fehler im System.",
        context: "Fragen - IT-Störungsmeldung",
        improvementHints: [
          "Benenne das betroffene System genau",
          "Beschreibe das Fehlverhalten und erwartetes Verhalten",
          "Gib Reproduktionsschritte an",
          "Erwähne Auswirkungen und betroffene Nutzer"
        ],
        goodExample: "Störungsmeldung: Das Fachverfahren {{Name}} zeigt seit heute 8:00 Uhr Timeout-Fehler beim Speichern von Vorgängen. Betroffen: 15 Sachbearbeiter:innen. Reproduzierbar: Ja, bei Vorgängen >10 Seiten. Erwartetes Verhalten: Speicherung in <5 Sekunden. Workaround: Vorgänge in Teilen speichern."
      },
      {
        department: "bauverfahren",
        badPrompt: "Prüf den Bauantrag.",
        context: "Fragen - Bauantragsprüfung",
        improvementHints: [
          "Benenne die Art des Bauvorhabens",
          "Gib den Prüfungsumfang an (Vollständigkeit, Baurecht)",
          "Erwähne die relevante Landesbauordnung",
          "Definiere die zu prüfenden Unterlagen"
        ],
        goodExample: "Prüfe den Bauantrag {{Aktenzeichen}} auf Vollständigkeit nach BauO NRW. Bauvorhaben: Nutzungsänderung Büro→Wohnung, {{Adresse}}. Checkliste: Bauzeichnungen (1:100), Baubeschreibung, Standsicherheit, Brandschutz, Stellplatznachweis. Fehlende Unterlagen als Nachforderungsschreiben formulieren."
      }
    ]
  },
  {
    id: 2,
    level: 1,
    badPrompt: "Wo soll ich Urlaub machen?",
    context: "Fragen - Reiseplanung",
    improvementHints: [
      "Definiere Budget und Reisedauer",
      "Gib Interessen und Aktivitätspräferenzen an",
      "Erwähne bevorzugtes Klima oder Region",
      "Füge Reisegruppe hinzu (allein, Familie, Paar)"
    ],
    goodExample: "Empfehle ein Urlaubsziel in Europa für 7 Tage im September mit Budget von 1500€ für zwei Erwachsene. Wir mögen Kultur, gutes Essen und warmes Wetter.",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true }
  },
  {
    id: 3,
    level: 2,
    badPrompt: "Schreib eine E-Mail.",
    context: "Gestalten - Geschäftskommunikation",
    improvementHints: [
      "Definiere Empfänger und Beziehung",
      "Gib den Zweck der E-Mail an",
      "Erwähne gewünschten Ton (förmlich, freundlich)",
      "Füge wichtige Details oder Kontext hinzu"
    ],
    goodExample: "Schreibe eine professionelle E-Mail an einen Kunden, der vor 2 Wochen eine Bestellung aufgegeben hat. Informiere ihn über eine leichte Verzögerung (3 Tage) und biete 10% Rabatt auf die nächste Bestellung als Entschuldigung an. Ton: höflich und kundenorientiert.",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true },
    departmentVariants: [
      {
        department: "legal",
        badPrompt: "Schreib ein Schreiben an den Antragsteller.",
        context: "Gestalten - Verwaltungsschreiben",
        improvementHints: [
          "Benenne den konkreten Verwaltungsvorgang",
          "Gib Rechtsgrundlage und Aktenzeichen an",
          "Definiere den Zweck (Anhörung, Bescheid, Nachforderung)",
          "Erwähne Fristen und Rechtsbehelfsbelehrung"
        ],
        goodExample: "Erstelle ein Anhörungsschreiben nach § 28 VwVfG an {{Antragsteller:in}} zum Vorgang {{Aktenzeichen}}. Sachverhalt: {{geplante Maßnahme}}. Frist zur Stellungnahme: 2 Wochen. Hinweis auf Akteneinsichtsrecht. Ton: förmlich, sachlich. [JURIST:IN PRÜFEN]"
      },
      {
        department: "oeffentlichkeitsarbeit",
        badPrompt: "Schreib eine Einladung zur Veranstaltung.",
        context: "Gestalten - Veranstaltungskommunikation",
        improvementHints: [
          "Benenne die Veranstaltung und den Anlass",
          "Gib Zielgruppe und Kanal an (E-Mail, Flyer, Social)",
          "Erwähne alle organisatorischen Details",
          "Definiere den gewünschten Ton"
        ],
        goodExample: "Erstelle eine E-Mail-Einladung an Bürger:innen zur Infoveranstaltung 'Klimaschutzkonzept 2030' am {{Datum}}, {{Uhrzeit}}, {{Ort}}. Programm: Vortrag + Bürgerbeteiligung. Barrierefreier Zugang erwähnen. Anmeldung bis {{Frist}} unter {{Kontakt}}. Ton: einladend, bürgernah. Max. 200 Wörter."
      },
      {
        department: "hr",
        badPrompt: "Schreib eine Absage an den Bewerber.",
        context: "Gestalten - Bewerbungskommunikation",
        improvementHints: [
          "Gib den Bezug zur Stelle und zum Verfahren an",
          "Definiere den Ton (wertschätzend, AGG-konform)",
          "Erwähne Aufbewahrungsfristen der Unterlagen",
          "Benenne ggf. Alternativangebote (Talentpool)"
        ],
        goodExample: "Erstelle eine AGG-konforme Absage-E-Mail an {{Bewerber:in}} für die Stelle {{Stellenbezeichnung}}, Kennziffer {{Nr.}}. Ton: wertschätzend, ohne inhaltliche Begründung (AGG-Risiko). Hinweis: Unterlagen werden nach 6 Monaten gelöscht. Angebot: Aufnahme in Interessent:innen-Pool. [HR-LEITUNG PRÜFEN]"
      },
      {
        department: "it",
        badPrompt: "Schreib eine Info an die User wegen dem Update.",
        context: "Gestalten - IT-Kommunikation",
        improvementHints: [
          "Benenne das Update und betroffene Systeme",
          "Gib Wartungsfenster und Ausfallzeiten an",
          "Erwähne Auswirkungen und nötige Nutzeraktionen",
          "Definiere Ansprechpartner bei Problemen"
        ],
        goodExample: "Erstelle eine Benutzerinformation zum geplanten Update von {{System}} am {{Datum}}, {{Uhrzeit}}–{{Uhrzeit}}. Ausfallzeit: ca. {{X}} Stunden. Nutzeraktion erforderlich: {{Ja/Nein — was genau}}. Neuerungen: {{3 wichtigste Änderungen}}. Support bei Problemen: {{Kontakt/Ticketsystem}}. Ton: sachlich, verständlich für Nicht-IT-Nutzer."
      },
      {
        department: "bauverfahren",
        badPrompt: "Schreib dem Bauherrn wegen der fehlenden Unterlagen.",
        context: "Gestalten - Nachforderungsschreiben",
        improvementHints: [
          "Benenne das Bauvorhaben und Aktenzeichen",
          "Liste die fehlenden Unterlagen konkret auf",
          "Gib eine Nachreichungsfrist an",
          "Erwähne die Rechtsfolge bei Fristversäumnis"
        ],
        goodExample: "Erstelle ein Nachforderungsschreiben zum Bauantrag {{Aktenzeichen}}, Bauvorhaben {{Beschreibung}}, {{Adresse}}. Fehlende Unterlagen: 1) Brandschutznachweis, 2) Stellplatzberechnung, 3) Abstandsflächenplan. Frist: 4 Wochen ab Zugang. Hinweis: Bei Fristversäumnis gilt der Antrag als zurückgenommen (§ X LBO). Ton: förmlich."
      }
    ]
  },
  {
    id: 4,
    level: 2,
    badPrompt: "Erstelle einen Report.",
    context: "Gestalten - Dokumentation",
    improvementHints: [
      "Definiere das Thema und den Zweck des Reports",
      "Gib Zielgruppe und Länge an",
      "Erwähne benötigte Abschnitte oder Struktur",
      "Füge verfügbare Daten oder Quellen hinzu"
    ],
    goodExample: "Erstelle einen 2-seitigen Quartalsreport über Social-Media-Performance für das Management. Fokus: Engagement-Rate, Follower-Wachstum und Top-3-Beiträge. Nutze die Daten aus dem angehängten Analytics-Export. Stil: prägnant mit Bullet Points.",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true }
  },
  {
    id: 5,
    level: 3,
    badPrompt: "Vergleiche diese beiden Optionen.",
    context: "Steuern - Vergleichsstudie",
    improvementHints: [
      "Benenne die konkreten Optionen",
      "Definiere Vergleichskriterien",
      "Gib den Entscheidungskontext an",
      "Erwähne wichtige Rahmenbedingungen"
    ],
    goodExample: "Vergleiche CRM-Systeme Salesforce und HubSpot für ein B2B-SaaS-Startup mit 25 Mitarbeitern. Kriterien: Kosten (Budget 500€/Monat), Benutzerfreundlichkeit, Integration mit bestehenden Tools (Slack, Google Workspace), Skalierbarkeit. Erstelle eine Entscheidungsmatrix.",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true }
  },
  {
    id: 6,
    level: 3,
    badPrompt: "Recherchiere das Thema.",
    context: "Steuern - Autonome Zielvorgabe",
    improvementHints: [
      "Definiere das konkrete Thema und Forschungsfrage",
      "Gib gewünschte Tiefe und Umfang an",
      "Erwähne relevante Quellen oder Perspektiven",
      "Definiere gewünschtes Output-Format"
    ],
    goodExample: "Recherchiere den Einfluss von KI-Chatbots auf Kundenzufriedenheit im E-Commerce. Fokus: aktuelle Studien (2023-2024), Conversion-Rate-Auswirkungen, ROI-Beispiele von mindestens 5 Unternehmen. Format: Executive Summary mit Quellenangaben und Key Findings in Tabellenform.",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true }
  },
  {
    id: 7,
    level: 4,
    badPrompt: "Mach eine Marktanalyse.",
    context: "Spezifizieren - Agenten-Blueprint",
    improvementHints: [
      "Definiere den Arbeitsbereich (Habitat): Wo darf der Agent recherchieren?",
      "Lege Werkzeuge fest (Hands): Was darf der Agent tun?",
      "Bestimme den Autonomie-Grad (Leash): Wann soll er nachfragen?",
      "Fordere Erfolgsnachweise (Proof): Wie beweist er korrekte Arbeit?",
      "Definiere Acceptance Criteria: Woran erkennt man Fertigstellung?"
    ],
    goodExample: "BLUEPRINT: Wettbewerbsanalyse für KI-gestützte Projektmanagement-Tools.\n\nHABITAT: Öffentliche Webquellen, Preisseiten, G2/Capterra Reviews.\nHANDS: Web-Recherche und Dokumenterstellung. KEIN Zugriff auf interne Daten.\nLEASH: Arbeite autonom. Frage nach bei: unklarer Zielmarkt-Definition, mehr als 3 gleichwertigen Optionen.\nPROOF: Jede Preisangabe mit URL belegen. Confidence-Rating pro Datenpunkt.\n\nMUST: Min. 5 Wettbewerber, aktuelle Preise (2026), Feature-Matrix.\nMUST NOT: Keine Annahmen ohne Quellenangabe.\nACCEPTANCE: Vergleichstabelle + 3 datengestützte Nischen-Empfehlungen + Executive Summary (500 Wörter).",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true }
  },
  {
    id: 8,
    level: 4,
    badPrompt: "Plane das Projekt für mich.",
    context: "Spezifizieren - Decomposition & Constraints",
    improvementHints: [
      "Zerlege das Großprojekt in Teilaufgaben unter 2 Stunden",
      "Definiere für jede Teilaufgabe: Input, Output, Abhängigkeiten",
      "Erstelle MUST/MUST-NOT Constraints",
      "Definiere Eskalations-Trigger (wann soll die KI stoppen?)",
      "Lege Abnahmekriterien fest (woran erkennt man Erfolg?)"
    ],
    goodExample: "SPEZIFIKATION: Redesign der Unternehmenswebsite (5 Seiten, responsive, SEO-optimiert).\n\nDECOMPOSITION: Zerlege in max. 2h-Teilaufgaben. Pro Aufgabe: Input, Output, Abhängigkeiten, Acceptance Criteria, Dauer.\n\nCONSTRAINTS:\nMUST: Mobile-First Design, WCAG 2.1 AA, Core Web Vitals bestehen.\nMUST NOT: Keine externen Fonts laden, keine Cookie-Banner ohne Rechtsgrundlage.\nESKALATION: Bei rechtlichen Fragen (Impressum, Datenschutz) → [PAUSE + Rückfrage].\n\nPROOF: Dependency-Graph, Gantt-Diagramm, Testplan mit 5 Szenarien.\nACCEPTANCE: Alle Seiten responsive getestet, Lighthouse Score >90, SEO-Checkliste erfüllt.",
    evaluationCriteria: { hasContext: true, isSpecific: true, hasConstraints: true }
  }
];
