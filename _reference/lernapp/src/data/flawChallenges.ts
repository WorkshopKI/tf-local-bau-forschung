import type { FlawChallenge } from "@/types";

export const flawChallenges: FlawChallenge[] = [
  // ── Legal (2) ──
  {
    id: "flaw-legal-01",
    title: "Widerspruchsbescheid prüfen",
    department: "legal",
    context: "Die KI wurde gebeten, einen Widerspruchsbescheid zu entwerfen. Prüfe den Output auf Fehler.",
    generatedOutput: `Widerspruchsbescheid

Sehr geehrter Herr Müller,

Ihr Widerspruch vom 15.03.2026 gegen den Bescheid vom 01.02.2026 (Az: 2026/BV/0847) wird hiermit zurückgewiesen.

Begründung:
Nach Prüfung Ihres Widerspruchs konnte keine Rechtswidrigkeit des Ausgangsbescheids festgestellt werden. Die Genehmigung wurde ordnungsgemäß nach §34 BauGB erteilt. Die von Ihnen vorgebrachten Einwände bezüglich der Lärmbelästigung sind nicht relevant, da das Vorhaben den geltenden TA Lärm entspricht.

Die Kosten des Widerspruchsverfahrens tragen Sie.

Mit freundlichen Grüßen
Sachbearbeitung Bauaufsicht`,
    flaws: [
      {
        id: "f1",
        type: "privacy",
        description: "Echter Name 'Herr Müller' verwendet — DSGVO-Verstoß im Übungsprompt",
        location: "Herr Müller",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "privacy",
        description: "Echtes Aktenzeichen verwendet (2026/BV/0847) — muss anonymisiert werden",
        location: "Az: 2026/BV/0847",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "compliance",
        description: "Rechtsbehelfsbelehrung fehlt — ist Pflichtbestandteil jedes Widerspruchsbescheids",
        location: "fehlt am Ende",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "logic",
        description: "Begründung ist zu pauschal — 'nicht relevant' ohne Darlegung warum nicht",
        location: "nicht relevant",
        severity: "mittel",
      },
    ],
    difficulty: 2,
  },
  {
    id: "flaw-legal-02",
    title: "Datenschutz-Folgenabschätzung prüfen",
    department: "legal",
    context: "Die KI hat eine Vorprüfung für eine Datenschutz-Folgenabschätzung erstellt. Prüfe den Output.",
    generatedOutput: `DSFA-Vorprüfung: Einführung Zeiterfassungssystem

1. Verarbeitungsvorgang: Digitale Arbeitszeiterfassung aller 847 Mitarbeiter am Standort Karlsruhe über biometrische Fingerabdruckscanner.

2. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Arbeitgebers).

3. Betroffene: Alle Mitarbeitenden
4. Risikobewertung: Gering, da nur Zeitstempel erfasst werden.

5. Ergebnis: Eine DSFA ist nicht erforderlich. Die Verarbeitung kann ohne weitere Prüfung aufgenommen werden.

Erstellt am 08.03.2026 von der Personalabteilung.`,
    flaws: [
      {
        id: "f1",
        type: "factual",
        description: "Falsche Rechtsgrundlage — biometrische Daten (Art. 9 DSGVO) können nicht auf 'berechtigtes Interesse' gestützt werden, Einwilligung oder Betriebsvereinbarung nötig",
        location: "Art. 6 Abs. 1 lit. f DSGVO",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "logic",
        description: "Risikobewertung 'Gering' widerspricht der Verarbeitung biometrischer Daten — diese sind per Definition hohes Risiko",
        location: "Risikobewertung: Gering",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "compliance",
        description: "DSFA ist bei biometrischen Daten zur Identifikation PFLICHT (Art. 35 Abs. 3 lit. b DSGVO) — Ergebnis 'nicht erforderlich' ist falsch",
        location: "DSFA ist nicht erforderlich",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "privacy",
        description: "Konkreter Standort und Mitarbeiterzahl (847 Mitarbeiter am Standort Karlsruhe) sollten in Übungszwecken anonymisiert sein",
        location: "847 Mitarbeiter am Standort Karlsruhe",
        severity: "mittel",
      },
    ],
    difficulty: 3,
  },

  // ── Öffentlichkeitsarbeit (2) ──
  {
    id: "flaw-oea-01",
    title: "Pressemitteilung prüfen",
    department: "oeffentlichkeitsarbeit",
    context: "Die KI hat eine Pressemitteilung zum Launch eines Bürgerportals erstellt. Prüfe auf Fehler.",
    generatedOutput: `Pressemitteilung — Sofort veröffentlichen

Revolutionäres Bürgerportal macht Verwaltung zum digitalen Vorreiter!

Ab dem 1. April können Bürger alle Verwaltungsdienstleistungen bequem von zu Hause erledigen. Das neue Portal spart 80% der bisherigen Bearbeitungszeit und macht Behördengänge komplett überflüssig.

"Das ist der größte Fortschritt in der Geschichte unserer Verwaltung", sagt Bürgermeister Schmidt. "Kein Bürger muss jemals wieder ein Amt betreten."

Das Portal unterstützt alle gängigen Browser und ist ab sofort unter www.buergerportal-stadt.de erreichbar.

Pressekontakt: Maria Weber, Tel. 0170-1234567`,
    flaws: [
      {
        id: "f1",
        type: "compliance",
        description: "'Sofort veröffentlichen' — Pressemitteilungen müssen von der Leitung freigegeben werden [LEITUNG PRÜFEN]",
        location: "Sofort veröffentlichen",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "factual",
        description: "'80% Zeitersparnis' und 'komplett überflüssig' sind unbelegte Übertreibungen — Sachlichkeitsgebot verletzt",
        location: "80% der bisherigen Bearbeitungszeit",
        severity: "mittel",
      },
      {
        id: "f3",
        type: "hallucination",
        description: "Das Zitat von 'Bürgermeister Schmidt' ist KI-generiert — echte Zitate müssen von der Person autorisiert werden",
        location: "Bürgermeister Schmidt",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "privacy",
        description: "Private Mobilnummer im Pressekontakt — nur dienstliche Kontaktdaten verwenden",
        location: "0170-1234567",
        severity: "mittel",
      },
    ],
    difficulty: 1,
  },
  {
    id: "flaw-oea-02",
    title: "Social-Media-Post prüfen",
    department: "oeffentlichkeitsarbeit",
    context: "Die KI hat einen Social-Media-Post für den offiziellen Account der Stadtverwaltung erstellt. Prüfe den Output.",
    generatedOutput: `🎉 BREAKING: Unsere Stadt hat gerade den Zuschlag für das 500-Millionen-Euro-Stadtentwicklungsprojekt bekommen! 🏗️

Das wird ALLES verändern! Neue Wohnungen, Parks, Schulen — das volle Programm! 🚀

Insider-Info: Der Vertrag mit der Baufirma Hochtief wurde bereits letzte Woche unterzeichnet, die offizielle Bekanntgabe folgt erst nächste Woche auf der Ratssitzung.

Wer sich jetzt noch schnell Grundstücke in der Nordstadt sichert, macht bestimmt ein gutes Geschäft! 😉

#Stadtentwicklung #Zukunft #Immobilien

Folgt uns für mehr exklusive Einblicke!`,
    flaws: [
      {
        id: "f1",
        type: "compliance",
        description: "Vorwegnahme einer offiziellen Ratsentscheidung — vertrauliche Information vor der Bekanntgabe veröffentlicht",
        location: "offizielle Bekanntgabe folgt erst nächste Woche",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "compliance",
        description: "Nennung eines konkreten Unternehmens (Hochtief) vor offizieller Vergabe-Bekanntmachung — vergaberechtlich problematisch",
        location: "Baufirma Hochtief",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "logic",
        description: "Kaufempfehlung für Grundstücke auf einem offiziellen Verwaltungs-Account — Neutralitätspflicht verletzt",
        location: "Grundstücke in der Nordstadt sichert",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "factual",
        description: "Unsachlicher, werblicher Tonfall ('BREAKING', 'ALLES verändern', Emojis) — nicht angemessen für offizielle Verwaltungskommunikation",
        location: "BREAKING",
        severity: "mittel",
      },
    ],
    difficulty: 2,
  },

  // ── HR (2) ──
  {
    id: "flaw-hr-01",
    title: "Arbeitszeugnis prüfen",
    department: "hr",
    context: "Die KI hat ein qualifiziertes Arbeitszeugnis erstellt. Prüfe auf versteckten Negativcode und andere Fehler.",
    generatedOutput: `Arbeitszeugnis

Frau Anna Bergmann, geboren am 15.06.1988, wohnhaft Hauptstraße 42, 76131 Karlsruhe, war vom 01.04.2022 bis 30.09.2025 als Sachbearbeiterin in unserer Personalabteilung tätig.

Frau Bergmann erledigte die ihr übertragenen Aufgaben zu unserer Zufriedenheit. Sie war stets bemüht, die an sie gestellten Anforderungen zu erfüllen. Im Kollegenkreis war sie durch ihre Geselligkeit beliebt.

Ihr Verhalten gegenüber Kollegen und Vorgesetzten war einwandfrei.

Frau Bergmann verlässt unser Unternehmen auf eigenen Wunsch. Wir wünschen ihr für die Zukunft alles Gute.

Karlsruhe, den 30.09.2025
Personalabteilung`,
    flaws: [
      {
        id: "f1",
        type: "privacy",
        description: "Vollständige Privatadresse und Geburtsdatum — im Zeugnis nicht erforderlich und datenschutzrechtlich problematisch",
        location: "wohnhaft Hauptstraße 42, 76131 Karlsruhe",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "logic",
        description: "'Stets bemüht' ist klassischer Negativcode (Note 5) — klingt positiv, bedeutet aber schlechte Leistung",
        location: "stets bemüht",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "logic",
        description: "'Durch ihre Geselligkeit beliebt' ist versteckter Negativcode — deutet auf Alkoholprobleme oder übermäßiges Socializing hin",
        location: "Geselligkeit",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "compliance",
        description: "Reihenfolge Verhaltensbeurteilung falsch: 'Kollegen und Vorgesetzten' statt korrekt 'Vorgesetzten und Kollegen' — signalisiert Probleme mit Vorgesetzten",
        location: "Kollegen und Vorgesetzten",
        severity: "mittel",
      },
    ],
    difficulty: 2,
  },
  {
    id: "flaw-hr-02",
    title: "Stellenausschreibung prüfen",
    department: "hr",
    context: "Die KI hat eine Stellenausschreibung für eine Verwaltungsstelle erstellt. Prüfe auf rechtliche und inhaltliche Fehler.",
    generatedOutput: `Stellenausschreibung: Sachbearbeiter (m/w) für das Bauordnungsamt

Wir suchen zum nächstmöglichen Zeitpunkt einen jungen, dynamischen Mitarbeiter für unser engagiertes Team.

Ihre Aufgaben:
- Bearbeitung von Bauanträgen und Bauvoranfragen
- Durchführung von Ortsbesichtigungen
- Erstellung von Bescheiden

Ihr Profil:
- Abgeschlossenes Studium der Architektur oder vergleichbar
- Muttersprache Deutsch
- Maximal 35 Jahre alt
- Führerschein Klasse B
- Belastbarkeit und Teamfähigkeit

Wir bieten:
- Unbefristete Vollzeitstelle (40h/Woche)
- Vergütung nach TVöD
- 24 Tage Urlaub

Bewerbungen mit Lichtbild bitte bis 30.04.2026 an personal@stadt-beispiel.de`,
    flaws: [
      {
        id: "f1",
        type: "compliance",
        description: "AGG-Verstoß: 'jung' und 'maximal 35 Jahre' ist Altersdiskriminierung",
        location: "jungen, dynamischen",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "compliance",
        description: "Fehlende Geschlechtsoption: '(m/w)' statt '(m/w/d)' — drittes Geschlecht fehlt, seit 2019 Pflicht",
        location: "(m/w)",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "compliance",
        description: "'Muttersprache Deutsch' ist diskriminierend — korrekt wäre 'Sehr gute Deutschkenntnisse (C1/C2)'",
        location: "Muttersprache Deutsch",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "compliance",
        description: "'Bewerbungen mit Lichtbild' — Fotos dürfen nicht verlangt werden (AGG)",
        location: "mit Lichtbild",
        severity: "mittel",
      },
      {
        id: "f5",
        type: "factual",
        description: "24 Tage Urlaub bei Vollzeit entspricht nur dem gesetzlichen Minimum — TVöD gewährt standardmäßig 30 Tage",
        location: "24 Tage Urlaub",
        severity: "hinweis",
      },
    ],
    difficulty: 1,
  },

  // ── IT (2) ──
  {
    id: "flaw-it-01",
    title: "Sicherheitskonzept prüfen",
    department: "it",
    context: "Die KI hat einen Abschnitt eines IT-Sicherheitskonzepts erstellt. Prüfe auf Fehler und Sicherheitsrisiken.",
    generatedOutput: `IT-Sicherheitskonzept: Remote-Zugriff

1. VPN-Zugang
Alle Mitarbeiter erhalten Zugang über den VPN-Server vpn.stadtverwaltung-intern.de (IP: 192.168.1.100, Port 443). Das Standardpasswort für neue Accounts lautet "Willkommen2026!" und muss nach dem ersten Login geändert werden.

2. Authentifizierung
Die Anmeldung erfolgt mit Benutzername und Passwort. Passwörter müssen mindestens 6 Zeichen lang sein. Ein Passwort-Reset ist per E-Mail an den Admin (thomas.klein@stadt.de) möglich.

3. Berechtigungen
Alle VPN-Nutzer erhalten zunächst Vollzugriff auf alle Netzwerk-Ressourcen. Einschränkungen können bei Bedarf nachträglich konfiguriert werden.

4. Monitoring
Zugriffsversuche werden für 30 Tage protokolliert.`,
    flaws: [
      {
        id: "f1",
        type: "privacy",
        description: "Interne IP-Adresse und Servernamen im Dokument — Sicherheitsrisiko bei Weitergabe",
        location: "192.168.1.100",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "compliance",
        description: "Standard-Passwort im Klartext dokumentiert — darf niemals in Dokumenten stehen",
        location: "Willkommen2026!",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "logic",
        description: "Mindestens 6 Zeichen ist viel zu kurz — BSI empfiehlt mindestens 12 Zeichen mit Komplexitätsanforderungen",
        location: "mindestens 6 Zeichen",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "logic",
        description: "Vollzugriff als Standard widerspricht dem Least-Privilege-Prinzip — Berechtigungen müssen restriktiv beginnen",
        location: "Vollzugriff auf alle Netzwerk-Ressourcen",
        severity: "kritisch",
      },
      {
        id: "f5",
        type: "missing",
        description: "Zwei-Faktor-Authentifizierung (2FA/MFA) wird nicht erwähnt — ist für Remote-Zugriff Standard",
        location: "Benutzername und Passwort",
        severity: "mittel",
      },
    ],
    difficulty: 2,
  },
  {
    id: "flaw-it-02",
    title: "Störungsbericht prüfen",
    department: "it",
    context: "Die KI hat einen Störungsbericht für ein Netzwerkproblem erstellt. Prüfe den Output.",
    generatedOutput: `Störungsbericht #2026-0312

Betreff: Netzwerkausfall Gebäude B, 2. OG
Datum: 08.03.2026, 09:15 – 11:45 Uhr
Betroffene: ca. 45 Mitarbeiter in Abt. 32 (Sozialamt)

Ursache: Der Switch im Serverraum B2-SR (Cisco Catalyst 9300, SN: FCW2345L0P7) hat aufgrund eines Firmware-Bugs (CVE-2025-7834) den Dienst quittiert.

Sofortmaßnahme: Neustart des Switches durch Admin-Zugang (admin/Cisco#2024) über die Management-Konsole 10.1.32.1.

Behebung: Firmware-Update auf Version 17.9.4a eingespielt.

Root Cause: Bekannter Bug in Firmware 17.8.1 bei VLAN-Trunking mit mehr als 64 VLANs.

Empfehlung: Alle Switches des gleichen Typs in Gebäude A, C und D sollten ebenfalls aktualisiert werden.`,
    flaws: [
      {
        id: "f1",
        type: "privacy",
        description: "Admin-Zugangsdaten im Klartext dokumentiert (admin/Cisco#2024) — gravierendes Sicherheitsrisiko",
        location: "admin/Cisco#2024",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "privacy",
        description: "Seriennummer des Geräts (SN: FCW2345L0P7) und interne IP-Adressen in einem Bericht, der weitergegeben werden könnte",
        location: "SN: FCW2345L0P7",
        severity: "mittel",
      },
      {
        id: "f3",
        type: "hallucination",
        description: "CVE-Nummer (CVE-2025-7834) könnte von der KI erfunden sein — muss gegen offizielle CVE-Datenbank verifiziert werden",
        location: "CVE-2025-7834",
        severity: "mittel",
      },
      {
        id: "f4",
        type: "missing",
        description: "Keine Information über Auswirkungen (Datenverlust? Laufende Vorgänge betroffen?) und keine Kommunikation an Betroffene erwähnt",
        location: "fehlt",
        severity: "mittel",
      },
    ],
    difficulty: 2,
  },

  // ── Bauverfahren (2) ──
  {
    id: "flaw-bau-01",
    title: "Ablehnungsbescheid prüfen",
    department: "bauverfahren",
    context: "Die KI hat einen Ablehnungsbescheid für einen Bauantrag entworfen. Prüfe auf Fehler.",
    generatedOutput: `Bescheid

Ihr Bauantrag vom 10.01.2026 für das Vorhaben "Neubau Einfamilienhaus" auf dem Grundstück Flur 7, Flurstück 234/5, Gemarkung Weststadt, wird abgelehnt.

Begründung:
Das Vorhaben widerspricht dem geltenden Bebauungsplan "Weststadt-Nord" (Nr. 147). Die geplante Gebäudehöhe von 12,50m überschreitet die zulässige Firsthöhe von 9,50m um 3m. Eine Befreiung nach §31 Abs. 2 BauGB kommt nicht in Betracht, da die Grundzüge der Planung berührt werden.

Außerdem passt das moderne Design nicht in das historische Stadtbild.

Gebühren: 250,00 EUR gemäß Gebührenordnung.

Rechtsbehelfsbelehrung: Gegen diesen Bescheid können Sie innerhalb von 4 Wochen Klage beim zuständigen Verwaltungsgericht erheben.`,
    flaws: [
      {
        id: "f1",
        type: "logic",
        description: "'Passt nicht in das historische Stadtbild' ist eine subjektive Wertung ohne Rechtsgrundlage — kein zulässiger Ablehnungsgrund",
        location: "passt das moderne Design nicht",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "factual",
        description: "Klagefrist '4 Wochen' ist falsch — die Klagefrist beträgt nach §74 VwGO einen Monat (nicht identisch mit 4 Wochen)",
        location: "4 Wochen",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "compliance",
        description: "Rechtsbehelfsbelehrung unvollständig — es fehlen Angabe des konkreten Gerichts (Name, Adresse) und Schriftformerfordernis",
        location: "Rechtsbehelfsbelehrung",
        severity: "mittel",
      },
      {
        id: "f4",
        type: "missing",
        description: "Hinweis auf Möglichkeit eines Widerspruchsverfahrens fehlt — je nach Landesrecht vorrangig vor Klage",
        location: "fehlt",
        severity: "mittel",
      },
    ],
    difficulty: 2,
  },
  {
    id: "flaw-bau-02",
    title: "TÖB-Stellungnahme zusammenfassen",
    department: "bauverfahren",
    context: "Die KI hat eine Zusammenfassung mehrerer Stellungnahmen der Träger öffentlicher Belange (TÖB) erstellt. Prüfe den Output.",
    generatedOutput: `Zusammenfassung TÖB-Stellungnahmen
Bauvorhaben: Erweiterung Gewerbegebiet "Am Stadtrand", Antragsteller: Friedrich & Weber GmbH (Geschäftsführer: Klaus Friedrich, Tel. 07221-443322)

1. Untere Naturschutzbehörde (Eingang 14.02.2026):
Keine Bedenken. Das Artenschutzgutachten vom Büro ÖkoConsult bestätigt keine geschützten Arten auf dem Gelände.

2. Untere Wasserbehörde (Eingang 20.02.2026):
Bedenken wegen Nähe zum Wasserschutzgebiet Zone III. Empfehlung: Versickerungsnachweis erforderlich.

3. Straßenverkehrsbehörde (noch ausstehend):
Wird voraussichtlich keine Bedenken haben, da die Anbindung über die B36 bereits ausreichend dimensioniert ist.

4. Denkmalschutzbehörde (Eingang 18.02.2026):
Zustimmung unter Auflagen.

Gesamtbewertung: Das Vorhaben kann genehmigt werden, alle TÖB stimmen zu.`,
    flaws: [
      {
        id: "f1",
        type: "privacy",
        description: "Name des Geschäftsführers und private Telefonnummer — personenbezogene Daten in der Zusammenfassung nicht nötig",
        location: "Klaus Friedrich, Tel. 07221-443322",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "hallucination",
        description: "Stellungnahme der Straßenverkehrsbehörde ist noch ausstehend, wird aber als 'voraussichtlich keine Bedenken' vorweggenommen — das ist eine unzulässige Annahme",
        location: "Wird voraussichtlich keine Bedenken haben",
        severity: "kritisch",
      },
      {
        id: "f3",
        type: "logic",
        description: "Gesamtbewertung 'alle TÖB stimmen zu' ist falsch — Wasserbehörde hat Bedenken und Straßenverkehrsbehörde hat noch nicht geantwortet",
        location: "alle TÖB stimmen zu",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "missing",
        description: "Auflagen der Denkmalschutzbehörde werden nicht spezifiziert — 'Zustimmung unter Auflagen' ohne Auflistung der Auflagen ist unvollständig",
        location: "unter Auflagen",
        severity: "mittel",
      },
    ],
    difficulty: 3,
  },

  // ── Generisch (2) ──
  {
    id: "flaw-gen-01",
    title: "Protokoll prüfen",
    department: undefined,
    context: "Die KI hat ein Besprechungsprotokoll erstellt. Prüfe den Output auf typische KI-Fehler.",
    generatedOutput: `Protokoll — Projektbesprechung "Digitalisierung Bürgerservice"
Datum: 08.03.2026, 14:00–15:30 Uhr
Teilnehmer: Fr. Schmidt, Hr. Weber, Fr. Chen, Hr. Özdemir, Hr. Klein

TOP 1: Sachstand Digitalisierungsprojekt
Laut einer aktuellen McKinsey-Studie von 2025 digitalisieren 78% aller deutschen Kommunen ihre Bürgerservices bis 2027. Unser Projekt liegt damit im Trend.

TOP 2: Budget
Das Gesamtbudget beträgt 2,3 Mio. EUR. Davon wurden bisher 1,8 Mio. EUR verausgabt (Stand: Q4 2025). Hr. Weber weist darauf hin, dass noch ausreichend Mittel vorhanden sind.

TOP 3: Nächste Schritte
- Fr. Schmidt koordiniert die Ausschreibung für das Hosting (Termin: 15.03.2026)
- Hr. Klein kümmert sich um die Barrierefreiheit
- Die nächste Besprechung findet am 22.03.2026 statt

Protokollführung: KI-Assistent`,
    flaws: [
      {
        id: "f1",
        type: "hallucination",
        description: "McKinsey-Studie mit konkreter Prozentzahl (78%) ist wahrscheinlich KI-generiert — Quellenangabe fehlt, Zahl muss verifiziert werden",
        location: "McKinsey-Studie von 2025",
        severity: "mittel",
      },
      {
        id: "f2",
        type: "logic",
        description: "Budgetberechnung widerspricht sich: 2,3 Mio. minus 1,8 Mio. = 500k übrig, aber 'ausreichend Mittel' ist bei 22% Restbudget fragwürdig und muss diskutiert werden",
        location: "noch ausreichend Mittel vorhanden",
        severity: "mittel",
      },
      {
        id: "f3",
        type: "missing",
        description: "Action Item für Hr. Klein ('kümmert sich um Barrierefreiheit') hat keinen konkreten Termin — alle Action Items brauchen Deadlines",
        location: "kümmert sich um die Barrierefreiheit",
        severity: "hinweis",
      },
      {
        id: "f4",
        type: "compliance",
        description: "'Protokollführung: KI-Assistent' — ein KI-generiertes Protokoll muss von einer verantwortlichen Person geprüft und gezeichnet werden",
        location: "Protokollführung: KI-Assistent",
        severity: "mittel",
      },
    ],
    difficulty: 1,
  },
  {
    id: "flaw-gen-02",
    title: "E-Mail-Entwurf prüfen",
    department: undefined,
    context: "Die KI hat eine Antwort-E-Mail an einen Bürger entworfen. Prüfe den Output.",
    generatedOutput: `Betreff: Re: Ihre Anfrage vom 01.03.2026

Lieber Herr Petersen,

vielen Dank für Ihre Anfrage bezüglich der Baugenehmigung für Ihr Grundstück in der Mozartstraße 17.

Ich habe Ihre Unterlagen geprüft und kann Ihnen mitteilen, dass Ihr Antrag voraussichtlich genehmigt wird. Die Bearbeitungszeit beträgt in der Regel 2-3 Wochen, in Ihrem Fall könnte es aufgrund der derzeit hohen Auslastung etwas länger dauern.

Für Rückfragen erreichen Sie mich unter meiner Durchwahl 0721-133-4567 oder mobil unter 0176-9876543. Ich bin meistens montags bis donnerstags im Büro, freitags arbeite ich von zuhause.

Falls Sie möchten, kann ich Ihren Antrag beschleunigen — sprechen Sie mich einfach an.

Herzliche Grüße
Sabine Meier
Sachbearbeiterin Bauordnungsamt`,
    flaws: [
      {
        id: "f1",
        type: "compliance",
        description: "Vorwegnahme der Genehmigung ('voraussichtlich genehmigt') — Zusagen vor Abschluss des Verfahrens sind unzulässig und können Amtshaftung auslösen",
        location: "voraussichtlich genehmigt wird",
        severity: "kritisch",
      },
      {
        id: "f2",
        type: "privacy",
        description: "Private Mobilnummer und Homeoffice-Tage preisgegeben — nur dienstliche Kontaktdaten verwenden",
        location: "0176-9876543",
        severity: "mittel",
      },
      {
        id: "f3",
        type: "compliance",
        description: "Angebot der Beschleunigung ('kann ich Ihren Antrag beschleunigen') — Gleichbehandlungsgrundsatz verletzt, Korruptionsrisiko",
        location: "Antrag beschleunigen",
        severity: "kritisch",
      },
      {
        id: "f4",
        type: "logic",
        description: "Widerspruch: '2-3 Wochen' Regelbearbeitungszeit, aber gleichzeitig 'könnte länger dauern' — konkrete Aussage zur Dauer vermeiden",
        location: "2-3 Wochen",
        severity: "hinweis",
      },
    ],
    difficulty: 1,
  },
];
