export interface RedactionDrill {
  id: string;
  title: string;
  department?: string;
  prompt: string;
  sensitiveSpans: {
    text: string;
    type: "name" | "aktenzeichen" | "ip" | "email" | "telefon" | "adresse" | "personalnummer" | "gehalt" | "gesundheit" | "passwort";
    explanation: string;
  }[];
  difficulty: 1 | 2 | 3;
}

export const redactionDrills: RedactionDrill[] = [
  // ── HR (2) ──
  {
    id: "red-01",
    title: "Arbeitszeugnis anonymisieren",
    department: "hr",
    prompt: "Erstelle ein qualifiziertes Arbeitszeugnis für Frau Dr. Sarah Meier (Personalnr. 47823), Abteilung Controlling, beschäftigt vom 01.03.2020 bis 31.12.2025. Leistungsbewertung: Gut. Ihre Krankenquote lag bei 12 Tagen/Jahr. Gehalt: 65.400€ TVöD E12.",
    sensitiveSpans: [
      { text: "Frau Dr. Sarah Meier", type: "name", explanation: "Echter Name — Platzhalter verwenden" },
      { text: "47823", type: "personalnummer", explanation: "Personalnummer identifiziert die Person eindeutig" },
      { text: "12 Tagen/Jahr", type: "gesundheit", explanation: "Krankenquote = Gesundheitsdaten (besondere Kategorie nach Art. 9 DSGVO)" },
      { text: "65.400€ TVöD E12", type: "gehalt", explanation: "Gehaltsangabe ist nicht nötig für Zeugniserstellung" },
    ],
    difficulty: 1,
  },
  {
    id: "red-02",
    title: "Bewerberdaten anonymisieren",
    department: "hr",
    prompt: "Formuliere eine Absage für den Bewerber Markus Yilmaz (geb. 14.05.1991), der sich am 20.02.2026 auf die Stelle als Sachbearbeiter (Ref. HR-2026-041) beworben hat. Im Vorstellungsgespräch fiel auf, dass er wegen einer Rückenoperation 2024 eingeschränkt ist. Kontakt: m.yilmaz@gmail.com, 0176-5553421.",
    sensitiveSpans: [
      { text: "Markus Yilmaz", type: "name", explanation: "Name des Bewerbers — Platzhalter verwenden" },
      { text: "14.05.1991", type: "name", explanation: "Geburtsdatum ermöglicht Identifizierung" },
      { text: "Rückenoperation 2024 eingeschränkt", type: "gesundheit", explanation: "Gesundheitsdaten sind besonders geschützt und dürfen nicht in Absagen einfließen" },
      { text: "m.yilmaz@gmail.com", type: "email", explanation: "Private E-Mail-Adresse — personenbezogene Daten" },
      { text: "0176-5553421", type: "telefon", explanation: "Private Telefonnummer — personenbezogene Daten" },
    ],
    difficulty: 2,
  },

  // ── IT (2) ──
  {
    id: "red-03",
    title: "Störungsmeldung bereinigen",
    department: "it",
    prompt: "Erstelle eine Störungsmeldung: Server srv-prod-db-03 (192.168.1.47) ist seit 09:15 nicht erreichbar. Admin-Account root/Winter2026! wurde geprüft. Betroffen: 50 Nutzer in HR, Ticket von Klaus Berger (k.berger@stadt.de).",
    sensitiveSpans: [
      { text: "srv-prod-db-03", type: "ip", explanation: "Interner Servername — Systemarchitektur offengelegt" },
      { text: "192.168.1.47", type: "ip", explanation: "Interne IP-Adresse — Netzwerktopologie offengelegt" },
      { text: "root/Winter2026!", type: "passwort", explanation: "Zugangsdaten im Klartext — kritischer Sicherheitsverstoß" },
      { text: "Klaus Berger", type: "name", explanation: "Echter Name des Meldenden" },
      { text: "k.berger@stadt.de", type: "email", explanation: "Dienstliche E-Mail identifiziert die Person" },
    ],
    difficulty: 1,
  },
  {
    id: "red-04",
    title: "Sicherheitsaudit-Ergebnisse bereinigen",
    department: "it",
    prompt: "Fasse die Ergebnisse des Penetrationstests zusammen: Firewall fw-ext-01 (203.0.113.5) hat offene Ports 22, 3389 und 8443. Domain-Admin-Passwort Admin$ecure99 wurde per Brute-Force geknackt. Active Directory dc-intern.stadt.local hat 3 kritische CVEs (CVE-2024-21345, CVE-2024-21400). VPN-Zugang über Cisco AnyConnect (vpn.stadt-intern.de) erlaubt Split-Tunneling.",
    sensitiveSpans: [
      { text: "203.0.113.5", type: "ip", explanation: "Öffentliche IP der Firewall — ermöglicht gezielte Angriffe" },
      { text: "Admin$ecure99", type: "passwort", explanation: "Domain-Admin-Passwort im Klartext — maximaler Sicherheitsverstoß" },
      { text: "dc-intern.stadt.local", type: "ip", explanation: "Interner Domainname — Active Directory Struktur offengelegt" },
      { text: "vpn.stadt-intern.de", type: "ip", explanation: "VPN-Endpunkt — ermöglicht Angriffsversuche" },
      { text: "fw-ext-01", type: "ip", explanation: "Firewall-Hostname und offene Ports — Infrastrukturdetails" },
    ],
    difficulty: 3,
  },

  // ── Bauverfahren (2) ──
  {
    id: "red-05",
    title: "Bauantrag-Anfrage bereinigen",
    department: "bauverfahren",
    prompt: "Prüfe den Bauantrag: Antragsteller Familie Yilmaz, Grundstück Flurstück 234/5 Gemarkung Weststadt, Müllerstraße 17, 50667 Köln. Aktenzeichen BV-2026-0391. Nachbar Hr. Schmidt (Müllerstr. 15) hat Einspruch eingelegt wegen Verschattung.",
    sensitiveSpans: [
      { text: "Familie Yilmaz", type: "name", explanation: "Name des Antragstellers — Platzhalter verwenden" },
      { text: "Flurstück 234/5 Gemarkung Weststadt", type: "adresse", explanation: "Identifiziert das Grundstück eindeutig" },
      { text: "Müllerstraße 17, 50667 Köln", type: "adresse", explanation: "Echte Adresse — anonymisieren" },
      { text: "BV-2026-0391", type: "aktenzeichen", explanation: "Echtes Aktenzeichen — keine internen Referenzen an KI" },
      { text: "Hr. Schmidt (Müllerstr. 15)", type: "name", explanation: "Name und Adresse des Nachbarn — doppelt sensibel" },
    ],
    difficulty: 2,
  },
  {
    id: "red-06",
    title: "Anhörungsschreiben bereinigen",
    department: "bauverfahren",
    prompt: "Entwirf ein Anhörungsschreiben an Frau Weber, Gartenstraße 8, 76131 Karlsruhe, Az: BA-2026-1102. Es geht um den ungenehmigten Anbau an ihrem Wohnhaus. Die Nachbarin Frau Krämer (Gartenstraße 10, Tel. 0721-9988776) hat den Verstoß gemeldet.",
    sensitiveSpans: [
      { text: "Frau Weber", type: "name", explanation: "Name der Betroffenen — anonymisieren" },
      { text: "Gartenstraße 8, 76131 Karlsruhe", type: "adresse", explanation: "Vollständige Adresse — anonymisieren" },
      { text: "BA-2026-1102", type: "aktenzeichen", explanation: "Internes Aktenzeichen — nicht an externe KI senden" },
      { text: "Frau Krämer", type: "name", explanation: "Name der Melderin — besonders schützenswert" },
      { text: "0721-9988776", type: "telefon", explanation: "Private Telefonnummer der Nachbarin" },
    ],
    difficulty: 2,
  },

  // ── Legal (2) ──
  {
    id: "red-07",
    title: "Vertragsprüfung anonymisieren",
    department: "legal",
    prompt: "Prüfe den Vertrag zwischen der Stadt Musterstadt und der Firma TechServ GmbH (Geschäftsführer Thomas Hartmann, USt-ID: DE123456789). Vertragswert: 847.000€, Laufzeit 36 Monate. Ansprechpartnerin intern: Dr. Petra Klein (petra.klein@stadt.de, Durchwahl 2341). Vertragsnummer: VN-2026-00472.",
    sensitiveSpans: [
      { text: "Thomas Hartmann", type: "name", explanation: "Name des Geschäftsführers — anonymisieren" },
      { text: "DE123456789", type: "aktenzeichen", explanation: "USt-ID identifiziert das Unternehmen eindeutig" },
      { text: "Dr. Petra Klein", type: "name", explanation: "Name der internen Ansprechpartnerin" },
      { text: "petra.klein@stadt.de", type: "email", explanation: "Dienstliche E-Mail identifiziert die Person" },
      { text: "VN-2026-00472", type: "aktenzeichen", explanation: "Interne Vertragsnummer — nicht an externe KI" },
    ],
    difficulty: 2,
  },
  {
    id: "red-08",
    title: "Widerspruchsbearbeitung anonymisieren",
    department: "legal",
    prompt: "Formuliere die Zurückweisung des Widerspruchs von Herrn Dr. Michael Braun (Az: WS-2026-0084) gegen den Gebührenbescheid über 2.340€. Er wohnt in der Lindenallee 23, 76137 Karlsruhe. Sein Anwalt RA Schneider (kanzlei-schneider@t-online.de) hat am 02.03.2026 Akteneinsicht beantragt.",
    sensitiveSpans: [
      { text: "Herrn Dr. Michael Braun", type: "name", explanation: "Name des Widerspruchsführers — anonymisieren" },
      { text: "WS-2026-0084", type: "aktenzeichen", explanation: "Internes Aktenzeichen — nicht an externe KI" },
      { text: "Lindenallee 23, 76137 Karlsruhe", type: "adresse", explanation: "Privatadresse — anonymisieren" },
      { text: "RA Schneider", type: "name", explanation: "Name des Anwalts — anonymisieren" },
      { text: "kanzlei-schneider@t-online.de", type: "email", explanation: "E-Mail-Adresse der Kanzlei — personenbezogen" },
    ],
    difficulty: 1,
  },

  // ── Öffentlichkeitsarbeit (1) ──
  {
    id: "red-09",
    title: "Bürgerbeschwerde anonymisieren",
    department: "oeffentlichkeitsarbeit",
    prompt: "Formuliere eine Antwort auf die Beschwerde von Frau Müller-Lüdenscheidt (Eingangsnr. BW-2026-0223), die sich über Lärm von der Baustelle Rheinstraße 45 beschwert. Sie schreibt: 'Mein Mann ist schwer krank und braucht Ruhe.' Ihr Sohn Jan (16 Jahre, geht auf das Friedrich-Gymnasium) hat Schlafstörungen. Kontakt: 0621-4455667.",
    sensitiveSpans: [
      { text: "Frau Müller-Lüdenscheidt", type: "name", explanation: "Name der Beschwerdeführerin" },
      { text: "BW-2026-0223", type: "aktenzeichen", explanation: "Interne Eingangsnummer" },
      { text: "Mein Mann ist schwer krank", type: "gesundheit", explanation: "Gesundheitsdaten des Ehemanns — besonders geschützt" },
      { text: "Jan (16 Jahre, geht auf das Friedrich-Gymnasium)", type: "name", explanation: "Name, Alter und Schule eines Minderjährigen — höchste Schutzstufe" },
      { text: "0621-4455667", type: "telefon", explanation: "Private Telefonnummer" },
    ],
    difficulty: 2,
  },

  // ── Generisch (1) ──
  {
    id: "red-10",
    title: "Meeting-Protokoll bereinigen",
    prompt: "Fasse das Protokoll zusammen: Teilnehmer waren Fr. Dr. Schmidt (Leiterin Personal), Hr. Özdemir (Betriebsrat, kritisch eingestellt), Fr. Wang (Controlling). Hr. Özdemir äußerte Bedenken gegen die Umstrukturierung und drohte mit Klage. Fr. Schmidt erwähnte, dass 3 Mitarbeiter der Abt. 4.2 — namentlich Berger, Klein und Nowak — versetzt werden sollen. Budget: 120.000€ aus Topf 'Personalmaßnahmen 2026'.",
    sensitiveSpans: [
      { text: "Fr. Dr. Schmidt", type: "name", explanation: "Name mit Funktion — identifizierbar" },
      { text: "Hr. Özdemir", type: "name", explanation: "Name des Betriebsrats — besonders schützenswert wegen Meinungsäußerung" },
      { text: "kritisch eingestellt", type: "name", explanation: "Persönliche Einschätzung/Meinung — darf nicht an externe KI" },
      { text: "Berger, Klein und Nowak", type: "name", explanation: "Namen der zu versetzenden Mitarbeiter — Personalmaßnahme vertraulich" },
      { text: "drohte mit Klage", type: "name", explanation: "Rechtsstreitigkeiten sind vertraulich — nicht an externe KI" },
    ],
    difficulty: 3,
  },
];
