/**
 * Kuratierter ZIM-Nachforderungs-Baustein-Katalog (Artefakt-Engine, NF).
 *
 * Die Bausteine sind die Quelle der Wahrheit für die NF-Generierung — **wortgetreu**
 * aus `Prompt-Nachforderungen-v2.md` konsolidiert (NICHT aus verstreuten Word-
 * Dateien). Der Rechtstext wird NIE umformuliert; das LLM füllt nur Platzhalter /
 * wählt Alternativen (siehe NF-Skill). Als versionierte App-Daten gepflegt — wie
 * Skills/Regeln.
 *
 * `scope` leitet sich aus dem ID-Präfix ab: `G…` → Verbund (Gesamtvorhaben, einmal
 * am Verbund gefüllt + in jede TV-NF eingefügt), `T…` → Teilvorhaben (TV-spezifisch).
 * Kein Heading-Parsing/LLM-Scope.
 *
 * `platzhalter` wird DETERMINISTISCH aus dem Text abgeleitet (`extractPlatzhalter`,
 * der „Loader/Normalize"): der verbatim-Text bleibt die einzige Quelle, die
 * Platzhalter-Liste ist daraus reproduzierbar (kein Hand-Tippen → kein Drift).
 */

/** Auf welcher Ebene ein Baustein gefüllt wird (aus dem ID-Präfix). */
export type NfScope = 'verbund' | 'tv';

/**
 * Platzhalter-Typ (vier Klassen, wie im Quell-Prompt):
 *  - `fill`: freie Einsetzung aus dem Antrag (Auslassung `…`/`...`).
 *  - `choose`: Auswahl aus Alternativen (`{a / b / c}`).
 *  - `optional`: optionaler Einschub (`{…}` ohne Alternation).
 *  - `wert`: Geldbetrag/Zahl (`x €`, `xx T€`).
 */
export type PlatzhalterTyp = 'fill' | 'choose' | 'optional' | 'wert';

/** Ein im Baustein-Text gefundener Platzhalter (roh + Typ). */
export interface NfPlatzhalter {
  /** Roh-Vorkommen wie im Text (`{mit / von}`, `x €`, `…`). */
  roh: string;
  typ: PlatzhalterTyp;
}

/** Ein kuratierter NF-Baustein. */
export interface NfBaustein {
  /** Stabile ID (`'G1.1'`, `'T2.3.7'`). */
  id: string;
  /** Ebene aus dem Präfix (`G…` → verbund, `T…` → tv). */
  scope: NfScope;
  /** Überkategorie (aus dem ID-Stamm abgeleitet). */
  kategorie: string;
  /** Thema/Überschrift des Bausteins. */
  thema: string;
  /** Rechtstext WORTGETREU (mit `{Platzhaltern}` / `…` / `x €`). */
  text: string;
  /** Deterministisch aus `text` abgeleitete Platzhalter. */
  platzhalter: NfPlatzhalter[];
}

/**
 * Leitet die Platzhalter eines Baustein-Texts deterministisch ab (Loader/Normalize).
 * Drei disjunkte Detektoren, Ergebnis nach Textposition sortiert:
 *  1. Geschweifte Gruppen `{…}` → `choose` (enthält `/` = Alternation) sonst `optional`.
 *  2. Wert-Platzhalter `x`/`xx`/`xxx` gefolgt von `€`/`T€` → `wert`.
 *  3. Auslassungen `…` oder `...` → `fill`.
 */
export function extractPlatzhalter(text: string): NfPlatzhalter[] {
  const found: Array<{ index: number; roh: string; typ: PlatzhalterTyp }> = [];
  for (const m of text.matchAll(/\{[^{}]*\}/g)) {
    found.push({ index: m.index ?? 0, roh: m[0], typ: m[0].includes('/') ? 'choose' : 'optional' });
  }
  for (const m of text.matchAll(/x{1,3}\s?T?€/g)) {
    found.push({ index: m.index ?? 0, roh: m[0], typ: 'wert' });
  }
  for (const m of text.matchAll(/…|\.\.\./g)) {
    found.push({ index: m.index ?? 0, roh: m[0], typ: 'fill' });
  }
  return found.sort((a, b) => a.index - b.index).map(({ roh, typ }) => ({ roh, typ }));
}

/** Überkategorie aus dem ID-Stamm. */
function kategorieVon(id: string): string {
  if (id.startsWith('G')) return 'Gesamtvorhaben';
  if (id.startsWith('T1')) return 'Entwicklung';
  if (id.startsWith('T2')) return 'Aufträge & Personal';
  return 'Kosten & Verwertung'; // T3
}

/** Ebene aus dem ID-Präfix. */
function scopeVon(id: string): NfScope {
  return id.startsWith('G') ? 'verbund' : 'tv';
}

interface RawBaustein {
  id: string;
  thema: string;
  text: string;
}

/** Roh-Katalog (id + thema + WORTGETREUER Text) — Quelle für `NF_BAUSTEINE`. */
const RAW: RawBaustein[] = [
  // ── G. GESAMTVORHABEN ────────────────────────────────────────────────────
  {
    id: 'G1.1', thema: 'Zur geplanten Entwicklung',
    text: 'Ihre gemeinsame Projektbeschreibung {ist zwar recht umfangreich,} lässt {aber dennoch} für die Beurteilung Ihres Vorhabens ganz wesentliche Informationen vermissen. Wir bitten Sie, die Projektbeschreibung nachzubessern. Dabei sollten folgende Fragestellungen angemessen beantwortet werden: ...',
  },
  {
    id: 'G1.2', thema: 'Zur geplanten Entwicklung',
    text: 'Eine kurze Recherche hat ergeben, dass {mit / von} … bereits ähnliche Lösungen am Markt angeboten werden. Bitte beschreiben Sie ausführlicher, mit welchen Merkmalen sich {das / die} von Ihnen geplante {Entwicklung / Produkt / Verfahren / Dienstleistung} von den oben genannten Lösungen unterscheidet.',
  },
  {
    id: 'G1.3', thema: 'Zur geplanten Entwicklung',
    text: 'Bislang ist nicht erkennbar, welche Vorteile die geplante Entwicklung gegenüber bestehenden Lösungen aufweist. Bitte beschreiben Sie ausführlicher, mit welchen Merkmalen sich die von Ihnen geplante Entwicklung von bereits am Markt verfügbaren Verfahren, Produkten oder Dienstleistungen unterscheidet.',
  },
  {
    id: 'G1.4', thema: 'Zur geplanten Entwicklung',
    text: 'Ihre Projektbeschreibung vermittelt den Eindruck, dass das vorrangige Ziel Ihres Vorhabens die Optimierung {des Produktes / der Produkte / Verfahrens / Dienstleistung X} ist. Projekte mit wiederkehrenden und routinemäßigen Änderungen an bestehenden Produkten, Verfahren oder Dienstleistungen sind jedoch nicht förderfähig. Bitte beschreiben Sie ausführlicher, mit welchen Merkmalen sich die von Ihnen geplante Entwicklung von bereits am Markt verfügbaren Verfahren, Produkten oder Dienstleistungen unterscheidet.',
  },
  {
    id: 'G2.1', thema: 'Zur Arbeitsteilung zwischen den Kooperationspartnern',
    text: 'Die Arbeitsteilung zwischen Ihnen und {Ihrem / Ihren Projektpartner / Projektpartnern} ist anhand der Beschreibung des Vorhabens sowie der einzelnen Arbeitspakete nicht nachvollziehbar. Bitte stellen Sie dar, welche konkreten Tätigkeiten von welchem Projektpartner durchgeführt werden.',
  },
  {
    id: 'G2.2', thema: 'Zur Arbeitsteilung zwischen den Kooperationspartnern',
    text: 'Ihr Arbeitsplan und die Arbeitspläne Ihrer/s Kooperationspartner/s sind nahezu identisch. Bitte erläutern Sie auf der Ebene der einzelnen Arbeitspakete {sowie auch in einer zusammenfassenden Gegenüberstellung}, welche Arbeiten von welchem Partner durchgeführt werden sollen und wie sich diese Arbeiten voneinander unterscheiden.',
  },
  {
    id: 'G2.3', thema: 'Zur Arbeitsteilung zwischen den Kooperationspartnern',
    text: 'Anhand der Projektbeschreibung ist nicht bei allen Arbeitspaketen hinreichend erkennbar, welche konkreten Tätigkeiten von welchem Projektpartner durchgeführt werden sollen. Bitte erläutern Sie für die Arbeitspakete …, wer welche Arbeiten durchführen soll und wie sich diese voneinander abgrenzen.',
  },
  {
    id: 'G3.1', thema: 'Zum Kooperationsvertrag',
    text: 'Bitte ergänzen Sie Ihren Entwurf zum Kooperationsvertrag um eine Regelung zur geplanten Vermarktung / um das Recht auf diskriminierungsfreie Veröffentlichung durch die Forschungseinrichtung / um die gegenseitige Informationspflicht bei der Vergabe von Aufträgen an Dritte / um die nicht antragstellenden Partner / um einen gemeinsamen Zwischenbericht und das gemeinsame Abschlussprotokoll aller Partner und erklären Sie den Arbeitsplan (Anlagen 5 der Partner) zum Bestandteil des Vertrages.',
  },
  {
    id: 'G4.1', thema: 'Unterlagen nicht antragstellender Partner',
    text: `In Ihren Antragsunterlagen geben Sie an, dass im Vorhaben ein {ausländischer,} im ZIM nicht antragsstellender Partner mitwirkt. Von diesem Partner benötigen wir folgende Unterlagen:
- Kurzbeschreibung der Einrichtung
- Letter of Intent (Bereitschaftserklärung zur Mitwirkung und Finanzierungszusage für das Teilvorhaben)
- Arbeitsplan mit Personenmonaten des nicht antragstellenden Partners
- Titel des Teilvorhabens und Kurzbeschreibung des innovativen Anteils, z. B. als Teil der gemeinsamen Projektbeschreibung (Anhang zu Anlage 4)`,
  },

  // ── T1. TEILPROJEKT: ENTWICKLUNG ─────────────────────────────────────────
  {
    id: 'T1.1.1', thema: 'Innovationsgehalt / Innovationshöhe',
    text: 'Eine kurze Recherche hat ergeben, dass {mit / von} … bereits ähnliche Lösungen am Markt angeboten werden. Bitte beschreiben Sie ausführlicher, mit welchen Merkmalen sich {das / die} von Ihnen geplante {Entwicklung / Produkt / Verfahren / Dienstleistung} von den oben genannten Lösungen unterscheidet.',
  },
  {
    id: 'T1.1.2', thema: 'Innovationsgehalt / Innovationshöhe',
    text: 'Bislang ist nicht erkennbar, welche Vorteile die geplante Entwicklung gegenüber bestehenden Lösungen aufweist. Bitte beschreiben Sie ausführlicher, mit welchen Merkmalen sich die von Ihnen geplante Entwicklung von bereits am Markt verfügbaren Verfahren, Produkten oder Dienstleistungen unterscheidet.',
  },
  {
    id: 'T1.1.3', thema: 'Innovationsgehalt / Innovationshöhe',
    text: 'Ihre Projektbeschreibung vermittelt den Eindruck, dass das vorrangige Ziel Ihres Teilvorhabens die Optimierung {des Produktes / der Produkte / Verfahrens / Dienstleistung X} ist. Projekte mit wiederkehrenden und routinemäßigen Änderungen an bestehenden Produkten und Verfahren sind jedoch nicht förderfähig. Bitte beschreiben Sie ausführlicher, mit welchen Merkmalen sich die von Ihnen geplante Entwicklung von bereits am Markt verfügbaren Verfahren, Produkten oder Dienstleistungen unterscheidet.',
  },
  {
    id: 'T1.1.4', thema: 'Innovationsgehalt / Innovationshöhe',
    text: 'Verdeutlichen Sie bitte, wie sich {das / die} in Anlage 3 aufgeführte / aufgeführten Projekt / Projekte} „…" (lfd. Nr. xx) und „…" (lfd. Nr. xx) inhaltlich von Ihrem hier beantragten Projekt unterscheiden.',
  },
  {
    id: 'T1.2.1', thema: 'Vorhabensbeschreibung',
    text: 'Ihre Projektbeschreibung ist sehr allgemein gehalten. Bitte beschreiben Sie den geplanten Lösungsansatz genauer, so dass sich dieser (technisch) nachvollziehen lässt. Insbesondere sollten die einzelnen Entwicklungsschritte bzw. Arbeitspakete so beschrieben werden, dass sich sowohl der jeweilige FuE-Gehalt (Innovationshöhe) als auch der dafür veranschlagte Arbeitsaufwand beurteilen lassen.',
  },
  {
    id: 'T1.3.1', thema: 'Technische Erfolgswahrscheinlichkeit',
    text: 'Anhand Ihrer Projektbeschreibung lässt sich nicht klar erkennen, ob sich die Projektziele mit hinreichend großer Wahrscheinlichkeit erreichen lassen. Bitte erläutern Sie daher die (technischen) Einzelheiten des geplanten Lösungsansatzes genauer. Legen Sie dar, welche Vorarbeiten, Voruntersuchungen oder Publikationen in Hinblick auf die Zielerreichung bereits existieren.',
  },
  {
    id: 'T1.4.1', thema: 'Technische Risiken',
    text: 'Die von Ihnen aufgeführten technischen Risiken (z. B. „ …" und „….") sind nur sehr allgemein beschrieben (bzw. betreffen die Eigenschaften des/der geplanten Produktes/Verfahrens/Dienstleistung). Unter technischen Risiken sind konkrete Entwicklungshürden auf dem Entwicklungsweg zu verstehen, die dazu führen könnten, dass sich die Projektziele trotz qualifizierter Bemühungen nicht oder nur teilweise erreichen lassen. Bitte beschreiben Sie Risiken dieser Art.',
  },
  {
    id: 'T1.4.2', thema: 'Technische Risiken',
    text: 'Die von Ihnen bislang aufgeführten Risiken (wie bspw. „…." und „….") sind von allgemeiner Natur und/oder beziehen sich auf das Nichterreichen einer angestrebten Funktionalität oder angestrebter Produktmerkmale. Beschreiben Sie bitte {entlang des geplanten Lösungsansatzes}, mit welchen Herausforderungen die/der/das…. verbunden ist und welche {technischen} Probleme bei der Umsetzung des ….zu erwarten sind.',
  },
  {
    id: 'T1.4.3', thema: 'Technische Risiken',
    text: 'Anhand Ihrer Projektbeschreibung lässt sich nicht erkennen, welche technischen Risiken, Hürden oder Probleme bei der geplanten Entwicklung auftreten könnten. Unter technischen Risiken sind konkrete Entwicklungshürden auf dem Entwicklungsweg zu verstehen, die dazu führen könnten, dass sich die Projektziele trotz qualifizierter Bemühungen nicht oder nur teilweise erreichen lassen. Bitte ergänzen Sie Risiken dieser Art.',
  },
  {
    id: 'T1.5.1', thema: 'Schutzrechte',
    text: 'Laut Anlage 4 (Angaben zur Patentsituation) haben Sie keine Recherchen zu Schutzrechten durchgeführt. Es ist jedoch unbedingt notwendig, zu prüfen, ob mit Ihrer Entwicklung Patente verletzt werden. Führen Sie daher bitte eine Schutzrechtsrecherche mit den Ihnen zur Verfügung stehenden Mitteln durch und teilen Sie uns das Ergebnis mit.',
  },

  // ── T2. TEILPROJEKT: AUFTRÄGE & PERSONAL ─────────────────────────────────
  {
    id: 'T2.1.1', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Sie planen die Vergabe eines Auftrages an Dritte zur … , wobei die Arbeitsteilung zwischen Ihnen und dem geplanten Auftragnehmer nicht klar genug erkennbar ist. Bitte stellen Sie dar, welche FuE-Tätigkeiten in Ihrem Unternehmen und welche beim Auftragnehmer durchgeführt werden sollen.',
  },
  {
    id: 'T2.1.2', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Sie planen einen Auftrag an Dritte mit einer Auftragssumme von x €. Für jeden Einzelauftrag (bei Auftragssummen bis einschließlich 10.000 €) ist gemäß Nr. 3 ANBest-P-Kosten ein Angebot vorzulegen. Bitte lassen Sie uns ein entsprechendes Angebot zukommen. Sollte das zurzeit nicht möglich sein, werden die dafür vorgesehenen Mittel vorerst gesperrt.',
  },
  {
    id: 'T2.1.3', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Sie planen einen Auftrag an Dritte mit einer Auftragssumme von x €. Wenn die Auftragssumme 10.000 € übersteigt, sind (gemäß Nr. 3 ANBest-P-Kosten) drei Angebote vorzulegen. Bitte lassen Sie uns entsprechende/zwei weitere/ein weiteres Angebot/e zukommen oder begründen Sie es plausibel, wenn die Vorlage von drei Angeboten nicht möglich ist.',
  },
  {
    id: 'T2.1.4', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Sie planen einen Auftrag an Dritte mit einer Auftragssumme von x €. Wenn die Auftragssumme 10.000 € übersteigt, sind (gemäß Nr. 3 ANBest-P-Kosten) drei Angebote vorzulegen. Bitte lassen Sie uns entsprechende/zwei weitere/ein weiteres Angebot/e zukommen und begründen Sie Ihre Auswahl für den bevorzugten Auftragnehmer. Sollte das zurzeit nicht möglich sein, werden die dafür vorgesehenen Mittel vorerst gesperrt.',
  },
  {
    id: 'T2.1.5', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Für den geplanten projektbezogenen Auftrag an Dritte liegt ein Angebot vor, das jedoch nicht beurteilbar ist. Erläutern Sie die im Angebot vorgesehenen Arbeiten bitte ausführlicher. {Legen Sie bitte auch zwei Vergleichsangebote und eine Begründung für die Auswahl vor. Diese können uns auch nach der Bewilligung, jedoch vor der Auftragsvergabe vorgelegt werden. Beachten Sie, dass im Falle einer Bewilligung die Mittel für den Auftrag vorerst gesperrt werden.}',
  },
  {
    id: 'T2.1.6', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Für den geplanten projektbezogenen Auftrag an Dritte liegt kein Angebot vor. Bitte senden Sie uns ein detailliertes Angebot des geplanten Auftragnehmers zu, so dass der Inhalt und der Aufwand bewertbar werden. {Darüber hinaus benötigen wir zwei Vergleichsangebote und eine Begründung für die Auswahl. Diese können uns auch nach der Bewilligung, jedoch vor der Auftragsvergabe vorgelegt werden. Beachten Sie, dass im Falle einer Bewilligung die Mittel für den Auftrag vorerst gesperrt werden.}',
  },
  {
    id: 'T2.1.7', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Für den geplanten Auftrag an Dritte liegt kein Angebot vor. Bitte beschreiben Sie den Inhalt des Auftrags ausführlich, so dass die Förderwürdigkeit und der Aufwand beurteilbar werden. Beachten Sie, dass im Falle einer Bewilligung die Mittel für den Auftrag gesperrt werden. In diesem Fall sind / ist uns vor der Auftragsvergabe das ausgewählte Angebot {sowie zwei Vergleichsangebote und eine Begründung für die Auswahl} vorzulegen.',
  },
  {
    id: 'T2.1.8', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Bitte beschreiben Sie den Inhalt des geplanten Auftrags an Dritte genauer. Aus welchen Gründen werden diese Arbeiten nicht von Ihnen selbst durchgeführt?',
  },
  {
    id: 'T2.1.9', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Bitte konkretisieren Sie Ihre Angaben zu den projektbezogenen Aufträgen an Dritte, indem Sie die Auftragnehmer und die Auftragsgegenstände benennen und einem Arbeitspaket zuordnen. Legen Sie zudem bitte aussagekräftige Angebote vor.',
  },
  {
    id: 'T2.1.10', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Bitte lassen Sie uns ein aussagefähiges Angebot für den geplanten Auftrag an Dritte zukommen oder erläutern Sie die geplante Fremdleistung, so dass deutlich wird, welche Aufgaben die/der Auftragnehmer konkret übernehmen soll/sollen und wir den Aufwand bewerten können.',
  },
  {
    id: 'T2.1.11', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Der geplante Auftrag Nr. x in Anlage 6.3a beinhaltet ausschließlich die Beschaffung von Material / Zukaufteilen und ist daher nicht den förderfähigen Aufträgen an Dritte zuzuordnen. Diese Kostenposition ist daher den übrigen Kosten zuzuordnen (siehe zusätzliche Gemeinkosten unter Punkt e) der Anlage 6.4a).',
  },
  {
    id: 'T2.1.12', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Bitte beachten Sie, dass Materialbeschaffung und Materialentsorgung nicht als Auftrag an Dritte gefördert werden können. Die Kosten für die von Ihnen geplanten Aufträge an Dritte lfd. Nr. x, y und z sind daher voraussichtlich den übrigen Kosten (siehe zusätzliche Gemeinkosten unter Punkt e) in Anlage 6.4a) zuzuordnen.',
  },
  {
    id: 'T2.1.13', thema: 'Zu projektbezogenen Aufträgen an Dritte',
    text: 'Ihr Auftrag an Dritte übersteigt deutlich die zulässige Obergrenze von 25 % bezogen auf die Personalkosten. Da der Auftrag an eine Forschungseinrichtung geht, aber nicht beschrieben ist und auch kein Angebot vorliegt, bitten wir Sie zu prüfen, ob es sich ggfs. um einen FuE-Auftrag handelt. In dem Falle wäre der Auftrag in Anlage 6.3b aufzuführen und die Hinweise in der Anlage zu beachten.',
  },
  {
    id: 'T2.2.1', thema: 'Zu FuE-Aufträgen',
    text: 'Sie planen die Vergabe eines FuE-Auftrages zur … , wobei die Arbeitsteilung zwischen Ihnen und dem geplanten Auftragnehmer nicht klar genug erkennbar ist. Bitte stellen Sie dar, welche FuE-Tätigkeiten in Ihrem Unternehmen und welche beim Auftragnehmer durchgeführt werden sollen.',
  },
  {
    id: 'T2.2.2', thema: 'Zu FuE-Aufträgen',
    text: 'Bitte legen Sie uns ein aussagefähiges Angebot für den geplanten FuE-Auftrag zur… vor oder beschreiben Sie dessen Inhalt genauer.',
  },
  {
    id: 'T2.2.3', thema: 'Zu FuE-Aufträgen',
    text: 'Bitte legen Sie uns den Entwurf eines FuE-Vertrags vor.',
  },
  {
    id: 'T2.2.4', thema: 'Zu FuE-Aufträgen',
    text: 'Bitte ergänzen Sie Ihren FuE-Vertrag um einen Zahlungsplan, …',
  },
  {
    id: 'T2.3.1', thema: 'Kompetenz des Antragstellers',
    text: 'Beschreiben Sie bitte, welche Qualifikationen und Erfahrungen in Ihrem Unternehmen in …. bestehen, damit erkennbar wird, ob das notwendige technologische Potenzial zur erfolgreichen Durchführung des Projektes vorhanden ist. {Haben Sie vorgesehen, noch vorhandene Defizite ggf. durch Neueinstellungen zu beheben?}',
  },
  {
    id: 'T2.3.2', thema: 'FuE-Personal-Angaben',
    text: 'Gemäß Ihren Angaben im Mantelbogen auf Seite 2 verfügen Sie über kein FuE-Personal. (Zudem sind Ihren Angaben in Anlage 2 zufolge keine FuE-Ausgaben entstanden.) Sind diese Angaben korrekt? Mit den geplanten, namentlich benannten vier Projektmitarbeitenden wären mindestens vier Personen als FuE-Personal zu berücksichtigen. Wir werden diese Angaben im Mantelbogen entsprechend berücksichtigen.',
  },
  {
    id: 'T2.3.3', thema: 'Nur N.N.-Personal',
    text: 'Achten Sie darauf, dass die wesentlichen FuE-Arbeiten durch qualifiziertes und namentlich benanntes Personal abgedeckt werden müssen. Bitte benennen Sie daher Projektpersonal aus Ihrem Unternehmen, mit den zur Projektdurchführung notwendigen Qualifikationen. Lassen Sie uns die zugehörigen Anlagen 6.1 vollständig ausgefüllt und unterschrieben zukommen. Sollten sich die Kosten erhöhen oder verringern, nehmen Sie die erforderlichen Änderungen bitte bei Bedarf auch in den Anlagen 5, 6.2, 6.4 und 6.4a/b vor und senden uns die Unterlagen zu.',
  },
  {
    id: 'T2.3.4', thema: 'Zum Projektpersonal',
    text: 'Teilen Sie uns bitte die geplante Fachrichtung/Qualifikation des noch zu benennenden Projektpersonals mit.',
  },
  {
    id: 'T2.3.5', thema: 'Zum Projektpersonal',
    text: 'Teilen Sie uns bitte den/die/das Namen / Vornamen / Fachrichtung / Qualifikation / Geburtsdatum / Jahr des Ausbildungsabschlusses / Funktion / Anstellungsdatum des / der Projektmitarbeiters / Projektmitarbeiterin {lfd. Nr. x / Vorname Name} mit.',
  },
  {
    id: 'T2.3.6', thema: 'Zum Projektpersonal',
    text: 'Das noch zu benennende Projektpersonal verfügt {nicht} über einen technischen/fachfremden Ausbildungshintergrund. Bitte erläutern Sie, welche relevanten Erfahrungen, Kenntnisse und Kompetenzen in das Projekt eingebracht und welche konkreten Aufgaben übernommen werden sollen.',
  },
  {
    id: 'T2.3.7', thema: 'Qualifikation benanntes Personal',
    text: 'Herr/Frau {Vorname Name} verfügt {nicht} über einen technischen/fachfremden Ausbildungshintergrund. Bitte erläutern Sie, welche relevanten Erfahrungen, Kenntnisse und Kompetenzen in das Projekt eingebracht und welche konkreten Aufgaben übernommen werden sollen.',
  },
  {
    id: 'T2.3.8', thema: 'Zum Projektpersonal',
    text: 'In Ihrem Projektteam gibt es gemäß Anlagen 6.1 keine Mitarbeitenden mit einem wissenschaftlichen Abschluss. Stellen Sie bitte die für das Projekt relevanten fachlichen Kompetenzen und Erfahrungen bei der Entwicklung von neuen Produkten, Verfahren oder Dienstleistungen des geplanten Projektteams dar.',
  },
  {
    id: 'T2.3.9', thema: 'Zum Projektpersonal',
    text: 'Erläutern Sie, welche FuE-Projektaufgaben die Assistenz der Geschäftsführung {Vorname Name} übernimmt bzw. untersetzen Sie, über welche Kompetenzen und Erfahrungen {Vorname Name} verfügt, die für die geplanten Arbeitspakete notwendig sind. Bitte beachten Sie, dass Sekretariatsarbeiten mit den sog. übrigen Kosten (Position e der Anlage 6.4a) abgegolten werden.',
  },

  // ── T3. TEILPROJEKT: KOSTEN & VERWERTUNG ─────────────────────────────────
  {
    id: 'T3.1.1', thema: 'Position a) Personalzusatzkosten',
    text: 'In der Anlage 6.4a kalkulieren Sie Personalzusatzkosten in Höhe von insgesamt xx €. Bitte erläutern Sie uns kurz, wie sich diese Summe zusammensetzt.',
  },
  {
    id: 'T3.1.2', thema: 'Position a) Weiterbildung',
    text: 'In der Position a 4) der Anlage 6.4a kalkulieren Sie Kosten für Weiterbildung (Schulung und Qualifizierung) in Höhe von xxx €. Bitte stellen Sie dar, welche Maßnahmen mit welchen Kosten genau geplant sind und welche Mitarbeitenden daran teilnehmen sollen. Sind die geplanten Weiterbildungsmaßnahmen ausschließlich für das Projekt nutzbar? Wenn nicht, geben Sie bitte den projektbezogenen Anteil in Prozent an.',
  },
  {
    id: 'T3.1.3', thema: 'Position b) Geräte/Anlagen',
    text: 'In der Position b 1) der Anlage 6.4a geben Sie Kosten in Höhe von x € an. Bitte erläutern Sie welche Geräte/Anlagen im Projekt eingesetzt werden sollen und inwiefern diese ausschließlich im beantragten Projekt zum Einsatz kommen. Legen Sie bitte zudem eine Auflistung der Geräte/Anlagen mit (geplanten) Anschaffungszeitpunkt, Anschaffungskosten, Abschreibungsdauer und die Höhe der Abschreibungen vor. Bitte beachten Sie, dass allgemeine Betriebsausstattungen zu den zusätzlichen Gemeinkosten und sonstigen Betriebskosten zählen und hier nicht aufgeführt werden dürfen.',
  },
  {
    id: 'T3.1.4', thema: 'Position b) Abschreibungen Neuanschaffungen',
    text: 'In der Position b2 der Anlage 6.4a haben Sie Kosten für Abschreibungen für weitere im Projekt genutzte Geräte und Anlagen (Neuanschaffungen oder anteilig bereits vorhandene) i. H. v. xx € angegeben. Bitte erläutern Sie, wie sich diese Summe zusammensetzt. Zeigen Sie den Projektbezug (ggfs. anteilig) und erläutern Sie, wie Sie den projektbezogenen Anteil ermittelt haben. Legen Sie bitte zudem eine Auflistung der Geräte / Anlagen mit (geplanten) Anschaffungszeitpunkt, Anschaffungskosten und Abschreibungsdauer vor. Bitte beachten Sie, dass allgemeine Betriebsausstattungen zu den zusätzlichen Gemeinkosten und sonstigen Betriebskosten zählen und hier nicht aufgeführt werden dürfen.',
  },
  {
    id: 'T3.1.5', thema: 'Position b) Abschreibungen',
    text: 'In der Position b 2) der Anlage 6.4a haben Sie Kosten in Höhe von x € angegeben. Bitte erläutern Sie, wie sich diese Summe zusammensetzt. Zeigen Sie den Projektbezug (ggfs. anteilig) und erläutern Sie, wie Sie den projektbezogenen Anteil ermittelt haben. Legen Sie bitte zudem eine Auflistung der Geräte/Anlagen mit (geplanten) Anschaffungszeitpunkt, Anschaffungskosten, Abschreibungsdauer und die Höhe der Abschreibungen vor. Bitte beachten Sie, dass allgemeine Betriebsausstattungen zu den zusätzlichen Gemeinkosten und sonstigen Betriebskosten zählen und hier nicht aufgeführt werden dürfen.',
  },
  {
    id: 'T3.1.6', thema: 'Position c) Gebäudemieten',
    text: 'In der Anlage 6.4a kalkulieren Sie Kosten für Gebäudemieten in Höhe von xx €. Wir machen Sie darauf aufmerksam, dass nur der projektbezogene Anteil der Netto-Kaltmiete für Gebäude(-teile) anzurechnen ist, z. B. Büroräume für die Projektmitarbeitenden oder im Projekt zu nutzende Laborräume, und dies auch nachweisbar sein muss.',
  },
  {
    id: 'T3.1.7', thema: 'Position d) Beratung',
    text: 'In der Position d4 haben Sie Kosten für Beratung und gleichwertige Dienstleistungen i. H. v. xx € angegeben. Bitte erläutern Sie, wie sich diese Summe zusammensetzt. Zeigen Sie den Projektbezug (ggfs. anteilig) des Auftrags/der Aufträge auf und benennen Sie nach Möglichkeit den/die geplanten Auftragnehmer. Legen Sie, wenn möglich, Angebote vor. Beachten Sie bitte, dass Aufträge an verbundene und Partnerunternehmen sowie an Kooperationspartner im beantragten Projekt nach möglich sind und Aufträge nur an fachkundige und leistungsfähige Anbieter nach wettbewerblichen Gesichtspunkten zu wirtschaftlichen Bedingungen vergeben werden dürfen.',
  },
  {
    id: 'T3.1.8', thema: 'Position d) Recherchen',
    text: 'In der Anlage 6.4a kalkulieren Sie Kosten für Recherchen. Bitte erläutern Sie diese genauer und geben Sie den projektbezogenen Anteil an.',
  },
  {
    id: 'T3.1.9', thema: 'Position d) Patente/Lizenzen',
    text: 'In der Anlage 6.4a kalkulieren Sie Kosten für den Erwerb oder die Lizenzierung von Patenten Dritter. Jedoch geben Sie weder in der Anlage 4, noch in der Projektbeschreibung an, dass sie Lizenzen oder Patente erwerben wollen. Bitte äußern Sie sich dazu und beschreiben Sie genauer, welche Kosten wofür geplant sind.',
  },
  {
    id: 'T3.2.1', thema: 'Markteinführung',
    text: 'Nennen Sie uns bitte die geplanten Maßnahmen zur Markteinführung und geben Sie an, für wann die Markteinführung geplant ist.',
  },
  {
    id: 'T3.2.2', thema: 'Marktbeschreibung',
    text: 'Bitte beschreiben Sie den Markt, auf dem Sie Ihre Neuentwicklung anbieten wollen, ausführlicher, damit wir die Chancen auf Verwertung Ihrer Entwicklungsergebnisse beurteilen können. Gehen Sie dabei auch auf dessen Größe, angestrebte Marktanteile und die Konkurrenzsituation ein. Sind Sie bereits auf diesem Markt aktiv oder verfügen Sie über entsprechende Kontakte? Nennen Sie konkrete Länder oder Regionen, in denen Ihr/e Produkt/Verfahren/Dienstleistung vermarktet werden soll. Sind Markteintrittsbarrieren, wie z. B. Zertifizierungen, zu erwarten?',
  },
  {
    id: 'T3.2.3', thema: 'Umsätze',
    text: 'Bitte erläutern Sie, wie sich die aufgrund des beantragten Projektes in den drei Jahren nach Projektabschluss für Ihr Unternehmen zu erwartenden Umsätze zusammensetzen. Gehen Sie bitte insbesondere auf den geplanten Verkaufspreis der / des neuen … ein und vergleichen Sie diesen mit dem der aktuell am Markt angebotenen …. . Welche Absatzmengen/Stückzahlen etc. werden erwartet?',
  },
  {
    id: 'T3.2.4', thema: 'Umsätze nicht nachvollziehbar',
    text: 'Die von Ihnen angegebenen projektbezogenen Umsätze für die drei Jahre nach Projektabschluss sind leider nicht nachvollziehbar. Bitte erläutern Sie, wie diese Werte ermittelt wurden (z. B. Mengenangaben und Preise sowie Vergleichspreise am Markt verfügbarer Produkte/Verfahren/Dienstleistungen).',
  },
  {
    id: 'T3.2.5', thema: 'Niedrige Umsätze',
    text: 'Die von Ihnen angegebenen projektbezogenen Umsätze für die ersten drei Jahre nach Projektabschluss sind mit insgesamt xx T€ in Relation zu den Projektkosten in Höhe von xx T€ vergleichsweise niedrig. Welchen Einfluss wird das Entwicklungsprojekt mittel- und langfristig auf die Umsätze oder das Betriebsergebnis Ihres Unternehmens haben? Trägt das Projekt anderweitig zu einer nachhaltigen Erhöhung der Wettbewerbsfähigkeit Ihres Unternehmens bei?',
  },
  {
    id: 'T3.2.6', thema: 'Zur Ergebnisverwertung',
    text: 'Welche zusätzlichen Umsätze und Neueinstellungen erwarten Sie aufgrund des beantragten Projektes im ersten, zweiten und dritten Jahr nach Projektabschluss?',
  },
  {
    id: 'T3.2.7', thema: 'Verzögerte Vermarktung',
    text: 'Sie haben erklärt, dass die Vermarktung erst … Jahre nach Projektabschluss beginnen wird. Geben Sie bitte die erwarteten projektbezogenen Umsätze und Arbeitsplatzeffekte für die drei Jahre nach Vermarktungsbeginn an.',
  },
  {
    id: 'T3.3.1', thema: 'Arbeitsaufwand',
    text: 'Bitte beschreiben Sie den Inhalt und die konkreten Tätigkeiten des Arbeitspakets / der Arbeitspakete … (genauer), damit der dafür veranschlagte Arbeitsaufwand {besser} beurteilbar wird.',
  },
  {
    id: 'T3.3.2', thema: 'Hoher Aufwand',
    text: 'Der von Ihnen kalkulierte Aufwand für das Arbeitspaket / die Arbeitspakete … erscheint sehr hoch. Bitte erläutern Sie die geplanten Arbeiten genauer, so dass sich der Aufwand besser beurteilen lässt, oder korrigieren Sie die Anzahl der veranschlagten Personenmonate und passen Sie die Anlage 5 entsprechend an.',
  },
  {
    id: 'T3.3.3', thema: 'Große Arbeitspakete (>6 PM)',
    text: 'Das Arbeitspaket / Die Arbeitspakete … {umfasst / umfassen jeweils} mehr als 6 Personenmonate (PM). Bitte beschreiben Sie die geplanten Tätigkeiten detaillierter und unterteilen Sie das Arbeitspaket / die Arbeitspakete in Etappen von nicht mehr als 6 PM, damit der für diese Arbeiten veranschlagte Aufwand besser beurteilbar wird. Passen Sie Ihren Arbeitsplan entsprechend an.',
  },
  {
    id: 'T3.3.4', thema: 'Nicht förderfähige Arbeitspakete',
    text: 'Das Arbeitspaket / Die Arbeitspakete … beinhaltet / beinhalten mit … nicht förderfähige Tätigkeiten. Aus diesem Grund müssen wir dieses / diese Arbeitspakete leider streichen und werden die Kostenkalkulation entsprechend anpassen.',
  },
  {
    id: 'T3.3.5', thema: 'Nicht förderfähige Einzelarbeiten',
    text: 'Das Arbeitspaket / Die Arbeitspakete … beinhaltet / beinhalten mit …. nicht förderfähige Tätigkeiten. Wir bitten Sie, diese Tätigkeiten aus dem Arbeitsplan zu streichen und Ihre Kostenkalkulation entsprechend anzupassen.',
  },
  {
    id: 'T3.3.6', thema: 'Unausgewogene Relation',
    text: 'Die Relation zwischen den Arbeitspaketen ist nicht angemessen. Der Anteil der Arbeitspakete für weitere Tests, Auswertungen und Anpassungen liegt mit rund xx PM über dem Anteil der Arbeitspakete yyy (rund yy PM) für die eigentlichen Entwicklungsaufgaben). Bitte korrigieren Sie Ihre ausführlichen Arbeitspaketbeschreibungen oder passen Sie Ihre Planung ggfs. an.',
  },
  {
    id: 'T3.3.7', thema: 'Zielkriterien',
    text: 'Nennen Sie bitte technische und wirtschaftliche Zielkriterien Ihres Vorhabens.',
  },
  {
    id: 'T3.3.8', thema: 'Meilensteine',
    text: 'Bitte nennen Sie überprüfbare (quantifizierte) Meilensteine und stellen Sie dar, wann die Zielkriterien erreicht werden sollen.',
  },
  {
    id: 'T3.3.9', thema: 'Wirtschaftliche Meilensteine',
    text: 'Bitte nennen Sie {auch} überprüfbare (wirtschaftliche) Meilensteine für die Zeit nach Projektabschluss. Wann ist die Markteinführung geplant?',
  },
  {
    id: 'T3.4.1', thema: 'Positive Effekte bisheriger Projekte',
    text: 'In Ihren Antragsunterlagen geben Sie an, dass Sie bereits ein Förderprojekt/mehrere Förderprojekte durchgeführt haben. Bitte gehen Sie kurz auf dessen/deren Inhalt/e und die Auswirkungen auf die wirtschaftliche Situation Ihres Unternehmens ein (zusätzliche Umsätze, geschaffene Arbeitsplätze).',
  },
  {
    id: 'T3.5.1', thema: 'Titeländerungen',
    text: 'Ihr Einverständnis voraussetzend, haben wir den Titel Ihres Teilprojektes / Gesamtvorhabens geändert / angepasst.',
  },
];

/** Vollständiger, wortgetreuer NF-Baustein-Katalog (Platzhalter abgeleitet). */
export const NF_BAUSTEINE: NfBaustein[] = RAW.map(r => ({
  id: r.id,
  scope: scopeVon(r.id),
  kategorie: kategorieVon(r.id),
  thema: r.thema,
  text: r.text,
  platzhalter: extractPlatzhalter(r.text),
}));

/** Bausteine eines Scopes (Verbund-Bausteine `G…` vs. TV-Bausteine `T…`). */
export function nfBausteineByScope(scope: NfScope): NfBaustein[] {
  return NF_BAUSTEINE.filter(b => b.scope === scope);
}

/** Ein Baustein per ID (oder `undefined`). */
export function getNfBaustein(id: string): NfBaustein | undefined {
  return NF_BAUSTEINE.find(b => b.id === id);
}

/** Set aller gültigen Baustein-IDs (für die administrative NF-QS). */
export const NF_BAUSTEIN_IDS: ReadonlySet<string> = new Set(NF_BAUSTEINE.map(b => b.id));
