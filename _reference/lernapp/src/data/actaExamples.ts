export interface ACTAExample {
  act: string;
  context: string;
  task: string;
  output: string;
  verificationNote?: string;
  negatives?: string;
}

export const actaExamples: Record<string, ACTAExample> = {
  default: {
    act: "Du bist ein erfahrener Social-Media-Manager mit Fokus auf LinkedIn.",
    context: "Unser Unternehmen ist ein B2B-SaaS-Startup für Projektmanagement. Wir haben gerade ein neues Feature für die automatisierte Zeiterfassung gelauncht. Zielgruppe sind Teamleiter und Projektmanager in mittelständischen Unternehmen.",
    task: "Erstelle einen LinkedIn-Post, der das neue Feature vorstellt und die Vorteile für Teamleiter hervorhebt.",
    output: "Der Post soll max. 150 Wörter haben, mit 3-5 Bulletpoints für die Key-Benefits und einem Call-to-Action am Ende.",
    verificationNote: "Prüfe ob die Key-Benefits konkret und messbar sind (nicht nur 'spart Zeit'). Prüfe ob der Call-to-Action eine klare Handlungsaufforderung enthält.",
    negatives: "Keine generischen Marketing-Floskeln ('revolutionär', 'einzigartig'). Keine Fachbegriffe aus der Softwareentwicklung. Nicht mehr als 150 Wörter.",
  },
  legal: {
    act: "Du bist ein erfahrener Verwaltungsjurist mit Schwerpunkt Vergaberecht und öffentliches Recht.",
    context: "Unsere Behörde schreibt einen IT-Rahmenvertrag (Volumen: 500.000 €) nach VgV im offenen Verfahren aus. Es gelten GWB §§ 122-124 und die einschlägigen Vergaberichtlinien.",
    task: "Erstelle einen Entwurf der Eignungskriterien, der wirtschaftliche und technische Leistungsfähigkeit abdeckt und diskriminierungsfrei formuliert ist. [VERGABESTELLE PRÜFEN]",
    output: "Gliedere nach: 1) Wirtschaftliche Leistungsfähigkeit, 2) Technische Leistungsfähigkeit, 3) Zuverlässigkeit. Pro Kriterium: Anforderung + Nachweis. Max. 2 Seiten.",
    verificationNote: "Prüfe ob alle drei Bereiche (Haftung, Datenschutz, Kündigung) abgedeckt sind. Prüfe ob die Rechtsverweise (GWB §§ 122-124, VgV) korrekt referenziert werden.",
    negatives: "Keine eigenständige Rechtsberatung — nur Risikohinweise und Prüfvorschläge. Keine Spekulation über Vertragspartner-Absichten. Kein Fließtext — nur die Tabellenstruktur.",
  },
  oeffentlichkeitsarbeit: {
    act: "Du bist ein erfahrener Pressesprecher einer kommunalen Verwaltung.",
    context: "Der Stadtrat hat gestern die Einführung eines digitalen Bürgerservice-Portals beschlossen. Ab April können 50 Verwaltungsleistungen online beantragt werden. Budget: 2 Mio. €, Umsetzung durch lokales IT-Unternehmen.",
    task: "Erstelle eine Pressemitteilung für die lokalen Medien, die den Beschluss bürgernah erklärt und ein Zitat der Bürgermeisterin enthält. [PRESSESTELLE FREIGABE]",
    output: "Max. 300 Wörter. Aufbau: Lead (W-Fragen) → Details → Zitat → Hintergrund → Kontakt. Keine Verwaltungsfachsprache.",
    verificationNote: "Prüfe ob alle W-Fragen im Lead beantwortet sind (Wer, Was, Wann, Wo, Warum). Prüfe ob das Zitat authentisch klingt und nicht nach KI-Textbaustein.",
    negatives: "Keine Verwaltungsfachsprache oder Abkürzungen. Kein Konjunktiv. Keine übertriebenen Superlative ('einzigartig', 'historisch'). Nicht länger als 300 Wörter.",
  },
  hr: {
    act: "Du bist ein erfahrener HR-Manager im öffentlichen Dienst mit Expertise in TVöD und AGG.",
    context: "Unsere Behörde sucht eine:n Sachbearbeiter:in für das Bauordnungsamt (EG 9b TVöD). Muss-Anforderung: Verwaltungsfachwirt:in oder vergleichbar. Kann: Kenntnisse im Baurecht. Die Stelle ist ab sofort zu besetzen.",
    task: "Erstelle eine AGG-konforme Stellenausschreibung mit Aufgabenprofil, Anforderungen und Benefits. Schwerbehinderten-Hinweis nicht vergessen. [HR-LEITUNG PRÜFEN]",
    output: "Gliedere in: Aufgaben (5 Punkte), Muss-Anforderungen, Kann-Anforderungen, Wir bieten, Bewerbungsfrist + Kontakt. Max. 1 Seite.",
    verificationNote: "Prüfe ob die Stellenausschreibung AGG-konform ist (keine Altersdiskriminierung, geschlechtsneutral). Prüfe ob Muss- und Kann-Anforderungen klar getrennt sind.",
    negatives: "Keine informelle Sprache ('Du'-Anrede nur wenn gewünscht). Keine unrealistischen Anforderungen. Kein Gehalt nennen wenn nicht explizit angegeben. Schwerbehinderten-Hinweis nicht vergessen.",
  },
  it: {
    act: "Du bist ein erfahrener IT-Sicherheitsbeauftragter nach BSI-Grundschutz.",
    context: "Unser Fachverfahren für Baugenehmigungen läuft auf einem Windows Server 2022 mit SQL-Datenbank. Schutzbedarf: hoch (personenbezogene Daten, Verwaltungsentscheidungen). Letztes Audit: vor 8 Monaten.",
    task: "Erstelle eine BSI-Grundschutz-Prüfliste für das Fachverfahren. Fokus auf die Bausteine APP.1 (Webanwendungen) und SYS.1 (Server). [IT-SICHERHEITSBEAUFTRAGTE:R FREIGABE]",
    output: "Tabellenformat: Anforderung → Status (erfüllt/offen) → Maßnahme → Verantwortlich → Frist. BSI-Kompendium 2024 referenzieren.",
    verificationNote: "Prüfe ob jede Anforderung einem konkreten BSI-Baustein zugeordnet ist (APP.1 oder SYS.1). Prüfe ob 'erfüllt/offen' für jeden Punkt bewertet wurde.",
    negatives: "Keine veralteten Kompendium-Versionen referenzieren. Keine Maßnahmen ohne Verantwortlichen und Frist. Keine Empfehlungen die über den Prüfauftrag hinausgehen.",
  },
  bauverfahren: {
    act: "Du bist ein erfahrener Sachbearbeiter im Bauordnungsamt mit Expertise in Landesbauordnungen.",
    context: "Ein Bauantrag für die Nutzungsänderung eines Bürogebäudes in eine Wohnanlage (12 WE) wurde eingereicht. Standort: Innenbereich nach § 34 BauGB. Nachbarzustimmungen fehlen teilweise. Brandschutznachweis ist unvollständig.",
    task: "Erstelle ein Nachforderungsschreiben an den Bauherrn mit allen fehlenden Unterlagen und einer rechtlichen Begründung für die Nachforderung.",
    output: "Förmliches Verwaltungsschreiben. Auflistung: fehlende Unterlage → Rechtsgrundlage → Frist (4 Wochen). Hinweis auf Rechtsfolge bei Fristversäumnis (§ X LBO).",
    verificationNote: "Prüfe ob jede fehlende Unterlage eine Rechtsgrundlage hat (§ X LBO oder BauGB). Prüfe ob die Rechtsfolgenbelehrung bei Fristversäumnis enthalten ist.",
    negatives: "Keine materielle Prüfung des Bauantrags — nur formale Vollständigkeit. Keine Rechtsberatung an den Bauherrn. Kein informeller Ton — förmliches Verwaltungsschreiben.",
  },
};
