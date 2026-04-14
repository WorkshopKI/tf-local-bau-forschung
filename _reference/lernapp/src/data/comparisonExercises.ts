export interface ComparisonExercise {
  id: string;
  domain: string;
  task: string;
  prompt: string;
  outputA: {
    label: "A";
    text: string;
    quality: 70 | 100;
  };
  outputB: {
    label: "B";
    text: string;
    quality: 70 | 100;
  };
  correctAnswer: "A" | "B";
  differences: {
    category: string;
    detail: string;
  }[];
}

export const comparisonExercises: ComparisonExercise[] = [
  {
    id: "comp-recht-01",
    domain: "Recht",
    task: "Anhörungsschreiben zu einer Ordnungswidrigkeit",
    prompt:
      "Erstelle ein Anhörungsschreiben für ein Ordnungswidrigkeitsverfahren wegen Ruhestörung am 12.02.2026, Betroffener Max Müller.",
    outputA: {
      label: "A",
      text: `Sehr geehrter Herr Müller,

hiermit geben wir Ihnen Gelegenheit zur Stellungnahme zu folgendem Sachverhalt:

Am 12.02.2026 wurde in Ihrer Wohnung eine erhebliche Ruhestörung festgestellt. Mehrere Anwohner haben sich beschwert. Dies stellt eine Ordnungswidrigkeit dar.

Sie haben die Möglichkeit, sich innerhalb von 14 Tagen zu dem Vorwurf schriftlich oder zur Niederschrift zu äußern. Sollten Sie von Ihrem Recht auf Anhörung keinen Gebrauch machen, wird nach Aktenlage entschieden.

Mit freundlichen Grüßen
Ordnungsamt`,
      quality: 70,
    },
    outputB: {
      label: "B",
      text: `Sehr geehrter Herr Müller,

Az.: OWi-2026-03841

hiermit werden Sie gemäß § 55 OWiG i.V.m. § 28 VwVfG als Betroffener angehört.

Ihnen wird folgender Sachverhalt zur Last gelegt:

Am 12.02.2026, gegen 23:40 Uhr, wurde durch Beamte des Ordnungsamtes in Ihrer Wohnung (Musterstraße 12, 50678 Köln) eine Ruhestörung durch übermäßigen Musiklärm festgestellt. Der gemessene Schallpegel überschritt den nach TA Lärm zulässigen Immissionsrichtwert für allgemeine Wohngebiete zur Nachtzeit (22:00–06:00 Uhr) von 40 dB(A).

Dies begründet den Verdacht einer Ordnungswidrigkeit gemäß § 117 Abs. 1 OWiG.

Sie haben das Recht, sich innerhalb von 14 Kalendertagen nach Zugang dieses Schreibens schriftlich oder zur Niederschrift bei der zuständigen Behörde zu äußern. Es steht Ihnen frei, sich anwaltlich beraten oder vertreten zu lassen.

Rechtsbehelfsbelehrung: Dieses Schreiben ist kein Bußgeldbescheid.

Mit freundlichen Grüßen
Ordnungsamt der Stadt Köln`,
      quality: 100,
    },
    correctAnswer: "B",
    differences: [
      {
        category: "Rechtsgrundlage",
        detail:
          "Output B nennt die exakte Rechtsgrundlage (§ 55 OWiG i.V.m. § 28 VwVfG), Output A bleibt vage.",
      },
      {
        category: "Sachverhaltskonkretheit",
        detail:
          "B nennt Uhrzeit, Adresse, Messverfahren und Grenzwert. A sagt nur 'erhebliche Ruhestörung'.",
      },
      {
        category: "Fristangabe",
        detail:
          "B spezifiziert '14 Kalendertage nach Zugang', A nur '14 Tage' — rechtlich angreifbar.",
      },
      {
        category: "Aktenzeichen",
        detail:
          "B führt ein Aktenzeichen, A nicht — erschwert die Zuordnung.",
      },
      {
        category: "Rechtsbehelfsbelehrung",
        detail: "B klärt, dass es kein Bußgeldbescheid ist.",
      },
    ],
  },
  {
    id: "comp-komm-01",
    domain: "Kommunikation",
    task: "Pressemitteilung zu einer Bürgerveranstaltung",
    prompt:
      "Schreibe eine Pressemitteilung zur Eröffnung des neuen Bürgerservice-Zentrums am 15.03.2026.",
    outputA: {
      label: "A",
      text: `Neues Bürgerservice-Zentrum eröffnet

Die Stadt freut sich, die Eröffnung des neuen Bürgerservice-Zentrums bekannt zu geben. Das moderne Zentrum bietet zahlreiche Dienstleistungen für die Bürgerinnen und Bürger.

"Wir sind stolz auf dieses Projekt", sagte ein Sprecher der Stadt. Das Zentrum ist ab sofort geöffnet und bietet viele Möglichkeiten für Behördengänge.

Die Bürger sind herzlich eingeladen, das neue Zentrum zu besuchen.`,
      quality: 70,
    },
    outputB: {
      label: "B",
      text: `Neues Bürgerservice-Zentrum: 12 Ämter unter einem Dach — Eröffnung am 15. März

Die Stadt Köln eröffnet am 15. März 2026 das Bürgerservice-Zentrum Deutz (Ottoplatz 4). Auf 2.400 m² bündelt es die Anlaufstellen von 12 Fachämtern — vom Einwohnermeldeamt über die Kfz-Zulassungsstelle bis zur Sozialberatung.

„Mit durchschnittlich 18 Minuten Wartezeit statt bisher 45 setzen wir einen neuen Standard", erklärte Oberbürgermeisterin Henriette Reker bei der Vorstellung. Das Zentrum bietet ein Online-Terminbuchungssystem, barrierefreien Zugang und verlängerte Öffnungszeiten (Mo–Do 7:30–18:00, Fr 7:30–14:00).

Investitionsvolumen: 8,2 Mio. Euro. Die Bauzeit betrug 14 Monate.

Pressekontakt: Amt für Presse- und Öffentlichkeitsarbeit, Tel. 0221 221-0, presse@stadt-koeln.de`,
      quality: 100,
    },
    correctAnswer: "B",
    differences: [
      {
        category: "Konkrete Zahlen",
        detail:
          "B nennt 12 Ämter, 2.400 m², 18 Min Wartezeit, 8,2 Mio. Euro. A sagt 'zahlreiche', 'viele'.",
      },
      {
        category: "Quellenangabe",
        detail:
          "B zitiert namentlich die Oberbürgermeisterin mit konkreter Aussage. A zitiert 'einen Sprecher' mit Plattitüde.",
      },
      {
        category: "Pressekontakt",
        detail: "B enthält vollständigen Pressekontakt. A hat keinen.",
      },
      {
        category: "Headline",
        detail:
          "B-Headline transportiert den Kern (12 Ämter, Datum). A-Headline ist generisch.",
      },
      {
        category: "Öffnungszeiten & Details",
        detail:
          "B nennt Adresse, Öffnungszeiten, Online-Buchung, Barrierefreiheit. A sagt nur 'ab sofort geöffnet'.",
      },
    ],
  },
  {
    id: "comp-hr-01",
    domain: "Personal",
    task: "Stellenausschreibung für eine Projektmanager-Position",
    prompt:
      "Erstelle eine Stellenausschreibung für eine/n Projektmanager/in IT-Infrastruktur.",
    outputA: {
      label: "A",
      text: `Wir suchen einen engagierten Projektmanager (m/w/d)

Für unser dynamisches Team suchen wir zum nächstmöglichen Zeitpunkt einen Projektmanager IT-Infrastruktur.

Ihre Aufgaben:
- Leitung von IT-Projekten
- Koordination mit verschiedenen Abteilungen
- Reporting an die Geschäftsführung
- Sicherstellung der Projektziele

Ihr Profil:
- Abgeschlossenes Studium im Bereich IT oder vergleichbar
- Mehrjährige Berufserfahrung
- Teamfähigkeit und Kommunikationsstärke
- Gute Deutsch- und Englischkenntnisse

Wir bieten:
- Attraktives Gehalt
- Flexible Arbeitszeiten
- Moderner Arbeitsplatz
- Weiterbildungsmöglichkeiten`,
      quality: 70,
    },
    outputB: {
      label: "B",
      text: `Projektmanagerin / Projektmanager IT-Infrastruktur (m/w/d)

Vollzeit (39h) | TVöD E 12 | Referat III – Digitalisierung | Kennziffer: IT-PM-2026-08

Die Stadt Köln (ca. 4.200 IT-Arbeitsplätze) modernisiert ihre Netzwerk- und Serverinfrastruktur. Zur Steuerung des Programms „Digitaler Arbeitsplatz 2028" suchen wir eine erfahrene Projektleitung.

Ihre Aufgaben:
- Eigenverantwortliche Leitung des Teilprojekts Netzwerk-Migration (Budget: 1,2 Mio. €, Laufzeit: 18 Monate)
- Steuerung externer Dienstleister (aktuell 3 Lose) inkl. Abnahme nach EVB-IT
- Monatliches Projektcontrolling mit Earned-Value-Analyse für den Lenkungsausschuss
- Risikomanagement nach BSI-Grundschutz für kritische Infrastruktur

Ihr Profil:
- Abgeschlossenes Studium Informatik, Wirtschaftsinformatik oder vergleichbar (Diplom/Master)
- Mindestens 3 Jahre Erfahrung in der Leitung von IT-Infrastrukturprojekten (> 500 T€)
- PRINCE2 Practitioner oder PMP-Zertifizierung (oder Bereitschaft zur Zertifizierung innerhalb 12 Monaten)
- Erfahrung mit öffentlichem Vergaberecht (VgV/UVgO) von Vorteil

Wir bieten:
- Vergütung nach TVöD E 12 (Stufe je nach Erfahrung: 4.170–5.110 € brutto/Monat)
- 30 Tage Urlaub + Heiligabend und Silvester frei
- Mobiles Arbeiten bis 60% nach Einarbeitung
- Jobticket, betriebliche Altersvorsorge, Gesundheitsmanagement

Bewerbungsfrist: 15.04.2026 | Kennziffer: IT-PM-2026-08 | Ansprechpartnerin: Frau Weber, 0221 221-2850`,
      quality: 100,
    },
    correctAnswer: "B",
    differences: [
      {
        category: "Vergütungstransparenz",
        detail:
          "B nennt TVöD E 12 mit konkreter Gehaltsspanne. A sagt nur 'attraktives Gehalt'.",
      },
      {
        category: "Aufgabenkonkretheit",
        detail:
          "B beschreibt ein konkretes Projekt mit Budget, Laufzeit und Methodik. A listet generische Aufgaben.",
      },
      {
        category: "Anforderungsprofil",
        detail:
          "B quantifiziert (3 Jahre, > 500 T€) und nennt Zertifizierungen. A bleibt bei 'mehrjährige Erfahrung'.",
      },
      {
        category: "Bewerbungsdetails",
        detail:
          "B hat Frist, Kennziffer und Ansprechpartnerin. A hat keine Bewerbungsinfos.",
      },
      {
        category: "Benefits-Konkretheit",
        detail:
          "B: 30 Tage Urlaub, 60% Mobil, Jobticket. A: 'flexible Arbeitszeiten, moderner Arbeitsplatz'.",
      },
    ],
  },
];
