# Brainstorming: Prüfaspekte, Unteraspekte & Darstellungsformen

**Status:** Arbeitsstand v0.2 · 18.07.2026 (v0.2: check-FE und preCheck-fachlich eingearbeitet, offene Fragen 1–3 geklärt)
**Grundlagen:** ZIM-Förderrichtlinie vom 28.11.2024, check-KMU (Teilvorhaben/Antrag), check-gesamt-verbund (Verbundebene), Inno-Score (Entscheidungshilfe Innovationsgrad), check-FE (Teilvorhaben Forschungseinrichtung), preCheck-fachlich (Erstsichtung FB)
**Ergänzt:** `konzept-pruefchecklisten.md`, `konzept-aufbereitung-v2.md`

---

## 1. Befunde aus den vorliegenden Checklisten (Ist-Prozess)

1. **Fünfwertiges Statusmodell in der Praxis:** erfüllt / nicht erfüllt / n. z. / NF notwendig / NF erfüllt. Mapping auf unser Modell: „NF notw." = `unklar`, „NF erfüllt" = Statusübergang `unklar → erfuellt` in der Event-Historie. Keine fünfte Spalte nötig — der NF-Lebenszyklus ist im Event-Design bereits abgebildet und sogar auswertbarer (wann NF gestellt, wann erledigt).
2. **PreCheck als vorgelagerte Stufe:** Mehrere Items beginnen mit „Sofern im PreCheck …". Es gibt also eine Erstsichtung vor der Hauptprüfung, deren Ergebnis die Prüftiefe steuert.
3. **Inno-Score = Triage, nicht Note:** 3 Kategorien (Zielstellung vs. SdT · Lösungsansatz · Risiken/Erfolgschancen), je B0–B3 mit Ankertexten, Summe max. 9. Unter 8 Punkten folgt vertiefte Einzelprüfung (Risiko beherrschbar? Lösungsansatz plausibel? Zielkriterien kontrollierbar?). Der Score steuert den Prüfpfad — er ersetzt keine Entscheidung.
4. **Verbund hat eine eigene Prüfebene** mit eigener Checkliste und zweistufigem Abschluss: „Alle Teilvorhaben förderfähig" **und** „Gesamtvorhaben förderfähig". PM-Ausgewogenheit wird inklusive nicht-antragstellender Partner betrachtet.
5. **Praxis-Richtwerte, die nicht in der Richtlinie stehen** (reines Prüfwissen der Fachseite):
   - kein Arbeitspaket über **6 PM** („ausreichend untersetzt")
   - projektbezogene Umsätze **≥ Projektkosten** des TV, Personalzuwachs **> 0** (Richtwert Förderwürdigkeit der Wirkungen, Ausnahmen mit Begründung)
   - **3 Angebote ab 15 T€** bei Aufträgen an Dritte
   - **FuE-Beschäftigte (JAE) > 0** als Eignungsindikator
   - AP-Relation „vorbereitende Tätigkeiten : Entwicklungsaufgabe : Tests/Auswertung" muss stimmig sein
6. **Externe Prüfquellen** sind Teil der Items: ZIM-Statusmonitor (Doppelförderung), Website des Antragstellers (Produkt schon beworben?), Anlagen 2/3/4/6.3a/7 als benannte Evidenzorte.
7. **Cross-Rollen-Kommunikation** steckt in den Checklisten („Hinweis an AB als Erinnerung"): Die fachliche Prüfung erzeugt Aufgaben für die administrative Seite.
8. **Der fachliche PreCheck ist eine eigene kleine Checkliste** (Kopf: ZKN-Verbundnummer, Kurztitel): Bewertbarkeit der Anlagen 3/4/5, Doppelförderungs-Anhaltspunkte, Inno-Ersteinschätzung, dann dreiwertiger Triage-Ausgang — (a) grob unvollständig bzw. Netzwerkpartner-Status ungeklärt, (b) vollständig/bewertbar mit realistischer Förderchance, (c) eindeutig nicht förderfähig → Ablehnung, weitere Ablehnungsgründe mit AB abstimmen.
9. **±1-Abweichungsregel beim Inno-Score:** Die vergebene Punktzahl darf um einen Punkt von der Entscheidungshilfe abweichen — mit Pflicht-Bemerkung. Dasselbe „Override nur mit Begründung"-Muster, das im Checklisten-Konzept für die KI-Vorbewertung vorgesehen ist; die Praxis kennt es bereits als Mensch-vs.-Rubrik.
10. **Netzwerk-Kontext:** ZKN-Nummern, die Prüfung „Antragsteller ist regulärer Netzwerkpartner" und das FE-Item „Auftragnehmer ist nicht die Netzwerkmanagementeinrichtung" (RL 4.5.2 g) zeigen: Die Anträge entstammen ZIM-Innovationsnetzwerken. Eine gepflegte Netzwerk-Stammliste (Partner je ZKN) macht den Partnerstatus deterministisch vorbelegbar.
11. **Explizite Abschluss-Sektion in check-FE** mit drei Ausgängen — Nachforderung / RNE-Ablehnung / Gutachten — jeweils mit „AB informieren" und „Teilvorhabentitel prüfen, ggf. anpassen", plus Freitextfelder „Gutachten (Hinweise)" und „Ablehnung/RNE (Hinweise)". Das Prinzip „ein Prüfergebnis, drei Abnehmer" steht damit wörtlich in der Praxis-Checkliste; die Hinweis-Freitexte sind die Vorläufer unserer Kommentar→Artefaktgerüst-Ableitung.

---

## 2. Entwurf der Aspekt-Taxonomie

**Prüfklassen je Unteraspekt** (bestimmen Vorbelegung und Werkzeug):

| Klasse | Bedeutung | Werkzeug |
|---|---|---|
| **R** | Rechencheck JSON-intern | deterministisch, beim Import |
| **K** | Richtlinien-/Grenzwert-Konformität | deterministisch, Parameter aus Registry |
| **S** | semantische Prüfung im VB-Text | FB-Urteil, optional LLM-Vorbewertung |
| **E** | externe Recherche / Anlagen-Sichtung | manuell, Item trägt Recherchehinweis |

### 2.1 Checkliste V — Vollständigkeit & Formales (Rolle admin, Ebene Antrag/TV)

| Aspekt | Unteraspekte (Auswahl) | RL-Fundstelle | Klasse |
|---|---|---|---|
| V1 Unterlagen & Form | Formular + Anlagen vollständig, HR-Auszug aktuell, Wirtschafts-ID, Namenswiedergabe, Markteinführungskonzept liegt bei | 6.1.1 | K (Anlagenliste aus JSON) + E |
| V2 Antragsberechtigung & Größeneinstufung | Betriebsstätte D; Kategorie (klein/jung/mittel/3.1.1 b/c); AGVO-Schwellen inkl. verbundener/Partnerunternehmen und Zweijahresregel; Konsistenz KMU-Erklärung ↔ Kennzahlen | 3.1.1, AGVO Anh. I | **K — voll berechenbar aus JSON-Kennzahlen-Zeitreihe**, Fördersatz-Folge |
| V3 Ausschlüsse | UiS, Insolvenz/Vermögensauskunft, Sektorausschluss, Rückforderungsanordnung | 3.5 | E + Erklärungen |
| V4 Vorzeitiger Beginn & Marktnähe | kein Beginn vor Eingangsbestätigung; Verträge nur mit aufschiebender Bedingung; Produkt/Verfahren noch nicht beworben (Website) | 4.5.2 b; check-KMU | E |
| V5 Doppelförderung | Förderliste 3 Jahre; Statusmonitor-Abgleich; personenbezogene Doppelförderung | 4.5.2 a, 4.7.2 | E (Quelle im Item benannt) |
| V6 Verflechtungen | keine Partner-/verbundenen Unternehmen unter Kooperationspartnern; Personenverflechtung (Leitungsfunktionen, Anteile ≥ 25 %) | 4.5.2 d | K-Vorbelegung (Gruppen-/Partnerdaten aus JSON) + E |
| V7 Bonität, Eigenanteil, Ordnungsmäßigkeit | Eigenanteil finanzierbar (Finanzplan-Zeitreihe); verbleibende Personalkapazität; geordnetes Rechnungswesen | 4.6.1 b–d | R (Finanzplan) + S |
| V8 Förderhistorie & Limits | Verwertung früherer ZIM-Projekte; Berichtspflichten; positive wirtschaftliche Effekte; max. 2 Bewilligungen je 12 Monate | 4.6.2, 5.4.1 | E + Bestandsdaten der App |

### 2.2 Checkliste F — Fachprüfung (Rolle fachlich, Ebene Antrag/TV)

| Aspekt | Unteraspekte (Auswahl) | RL-Fundstelle | Klasse |
|---|---|---|---|
| F1 Innovationsgehalt & SdT | Entwicklungsbedarf; deutliches Übertreffen des int. SdT über **Parameter/Funktionen**; Quantifizierungsgrad der Zielparameter; mind. experimentelle Entwicklung; Neuheitstyp; keine Routineänderung | 4, 4.1.1, 4.5.2 e/f | S — **Inno-Score-Kategorien 1+2 als Skala-Items** |
| F2 Technisches Risiko & Erfolgschancen | erheblich **und** beherrschbar; projektspezifisch (Bezug zum Lösungsweg); Realisierbarkeit; Erfolgschancen | 4; Inno-Score K3 | S — Skala-Item |
| F3 Lösungsweg & Arbeitsplanung | AP untersetzt (**kein AP > 6 PM** — Registry-Parameter); Inhalte eindeutig; Relation Vorbereitung:Entwicklung:Test stimmig; Aufwand angemessen (ggf. kürzen); alle AP förderfähig (ggf. streichen); lege artis | 6.1.1 b, 4.1.5 | K (PM je AP aus JSON) + S |
| F4 Eignung & Ressourcen | Personalqualifikation passt; wesentliche FuE-Aufgaben durch **benanntes** Personal (N.N.-Quote aus Einsatzplanung berechenbar); FuE-JAE > 0; Potenzial/Infrastruktur dargestellt | 4.6.1 a/c | K + S |
| F5 Kalkulation & Kostenkonformität | Fördersatz-Einstufung korrekt (Tabelle 5.2.1); Kostenkappen 690/560/280 T€, Gehaltscap 150 T€; Aufträge Dritte ≤ 35 % der Personaleinzelkosten; FuE-Aufträge + Personalaufnahmen je ≥ 30 %, zusammen ≤ 70 % der PM; übrige Kosten ≤ 100 %/85 %; 3 Angebote ab 15 T€; Auftragnehmer benannt | 5.2–5.4 | **überwiegend K — fast vollständig berechenbar** |
| F6 Wirtschaftlichkeit & Verwertung | Markteinführungskonzept mit kontrollfähigen technischen + wirtschaftlichen Meilensteinen; Wirkungen quantifiziert (Arbeitsplätze, Umsatz); Richtwert Umsätze ≥ Projektkosten, Personalzuwachs > 0; Marktchancen quantifiziert und positiv bewertet | 4.5.1, 6.1.1 e | S + Registry-Richtwerte |
| F7 Anreizeffekt | ohne Förderung nicht / nur verzögert / mit kleinerem Umfang realisierbar | 4 | S + Erklärung |
| F8 Schutzrechte | Schutz-/Nutzungsrechte geprüft; keine entgegenstehenden Rechte; Patentsituation konsistent zur VB | check-KMU; JSON detailbeschreibung | K-Vorbelegung (Checkboxen) + S |

### 2.3 Checkliste G — Verbund-Gesamtprüfung (Ebene **Verbund**, Rollen gemischt)

| Aspekt | Unteraspekte (Auswahl) | RL-Fundstelle | Klasse |
|---|---|---|---|
| G1 Konsortium & Ausgewogenheit | alle Teilanträge eingegangen (Soll aus `kooppartner`); PM-Verteilung ≤ 70 % (bilateral) / ≤ 50 % (>2 Partner); FE ≤ 50 % der PM; FE-Anteil ≥ 10 % der Kosten; PM nicht-antragstellender Partner einbezogen | 4.1.2 | **K über alle Teilanträge — Paradebeispiel für Verbund-Aggregation** |
| G2 Kooperationsvereinbarung | Pflichtinhalte (TV-Abgrenzung, Arbeitsplan, Schutz-/Nutzungsrechte, Veröffentlichungsrecht der FE); Entwurf liegt vor | 4.1.3 | E + S |
| G3 Abstimmung der Arbeitspläne | TV-Arbeitspläne zeitlich/inhaltlich verzahnt; Schnittstellen definiert | check-verbund | S — visuell: Schwimmbahnen-Gantt |
| G4 Gesamt-Zielstellung & SdT | Zielstellung klar; Abheben vom int. SdT auf Verbundebene; ggf. Abgrenzung zur ZIM-Durchführbarkeitsstudie | 4.1.1 | S |
| G5 Markteinführung gesamt | gemeinsame Vermarktungsabsicht; plausible kontrollfähige Meilensteine; Marktchancen (Potenzial, Größe, Anteile, Kunden) quantifiziert und positiv | 4.1.2, 4.5.1 | S |
| G6 Abschluss (zweistufig) | alle TV förderfähig · Gesamtvorhaben förderfähig | check-verbund | Gate über G1–G5 + TV-Ergebnisse |

### 2.4 Checkliste P — Fachlicher PreCheck (Rolle fachlich, Ebene Antrag/TV, Phase Eingang)

| Aspekt | Unteraspekte | Quelle | Klasse |
|---|---|---|---|
| P1 Bewertbarkeit | Anlagen 3, 4 und 5 vorhanden **und bewertbar** | JSON-Anlagenreferenzen + Sichtung | K + E |
| P2 Doppelförderung (Anhaltspunkte) | keine Anhaltspunkte (Erstabgleich Anlage 3 / Statusmonitor) | extern | E |
| P3 Netzwerkpartner-Status | mindestens ein Antragsteller ist regulärer Netzwerkpartner der ZKN | Netzwerk-Stammliste + JSON-Netzwerkbezug | **K** (sobald Stammliste in der App gepflegt) |
| P4 Inno-Ersteinschätzung | „Übertrifft die Entwicklung den int. SdT?" + drei Skala-Items der Entscheidungshilfe; Abweichung ±1 nur mit Bemerkung | VB | S (Skala) |
| P5 Triage-Ausgang | (a) grob unvollständig / Status ungeklärt → Nachlieferung; (b) bewertbar mit Förderchance → Hauptprüfung; (c) eindeutig nicht förderfähig → Ablehnung (weitere Gründe mit AB abstimmen) | Ergebnis P1–P4 | Gate-Item, dreiwertig |

Der PreCheck beantwortet die bisherige offene Frage 3: **eigene, kleine Checkliste** in der Eingangsphase, gleicher Mechanismus wie V/F/G. Sein Inno-Score-Ergebnis wird an die Fachprüfung durchgereicht (Triage-Bedingung der vertiefenden F1/F2-Items).

### 2.5 Checkliste F-FE — Variante für Forschungseinrichtungs-Teilvorhaben

Struktur identisch zu F (KMU), mit fünf Deltas:

| Delta | FE-Fassung | Hintergrund |
|---|---|---|
| Marktnähe (V4-Pendant) | „… noch nicht beworben **und keine Publikationen**" | Publikationen als Vorveröffentlichung |
| F4 benanntes Personal | nur **bei privater FE** gefordert (Verweis VWP 5.11) | grundfinanziertes Personal öffentl. FE (RL 4.7.2) |
| F4 Eignung | „Darstellung der **Einrichtung**" statt Unternehmensentwicklung; FuE-JAE-Item entfällt | FE-Natur |
| F5/F6 | Wirtschaftlichkeits-Richtwerte (Umsatz ≥ Kosten, Personalzuwachs) entfallen auf TV-Ebene; Verwertung über Veröffentlichungsrecht | RL 5.2.1 c |
| Aufträge an Dritte | zusätzlich: „Auftragnehmer ist **nicht** die Netzwerkmanagementeinrichtung" | RL 4.5.2 g, Netzwerk-Kontext |

**Modellierungsempfehlung:** zwei Checklisten-Definitionen (F-KMU, F-FE) mit gemeinsamer Aspektstruktur statt einer Checkliste voller Bedingungen — einfacher zu pflegen, und die Registry-Versionierung bleibt je Antragstellertyp sauber. Die Abschluss-Sektion (NF / RNE-Ablehnung / Gutachten, je mit AB-Information und TV-Titel-Kontrolle) ist in beiden identisch und wird im Konzept als modellierter Prüfungs-Abschluss abgebildet (→ Delta 8).

**Beobachtung zur Vorbelegungsquote:** V2, F5 und G1 — die arbeitsintensivsten und fehlerträchtigsten Teile der heutigen Prüfung — sind mit dem Plattform-JSON nahezu vollständig deterministisch berechenbar. Das ist der größte einzelne Zeitgewinn im ganzen Vorhaben.

---

## 3. Inno-Score im neuen Modell

Die Rubrik passt in unser Modell, braucht aber einen eigenen Item-Typ:

- **`antwortTyp: 'skala'`** mit Stufen B0–B3 und den Ankertexten aus der Entscheidungshilfe (Anker in der Checklisten-Definition, Kurator-pflegbar). Die drei Kategorien werden drei Skala-Items in F1/F2.
- **Triage-Logik als Regel:** Summe ≥ 8 → Kurzpfad; < 8 → die vertiefenden Binär-Items (Risiko beherrschbar, Lösungsansatz plausibel, Zielkriterien kontrollierbar) werden pflichtig. Das ist eine bedingte Item-Aktivierung — der erste echte Anwendungsfall für `bedingung` aus dem Checklisten-Konzept (dort offene Frage 6: jetzt beantwortet, wir brauchen sie).
- **Abweichungsregel aus der Praxis übernehmen:** Die vergebene Punktzahl darf ±1 von der Rubrik-Summe abweichen, aber nur mit Pflicht-Bemerkung (so steht es im PreCheck). Im Datenmodell: Rubrik-Ergebnis und begründete Abweichung getrennt speichern — strukturgleich zum Muster „KI-Vorbewertung vs. menschliches Urteil".
- **Vereinbar mit der Score-Leitplanke**, weil der Score (a) von Menschen mit dokumentierten Ankern vergeben wird, (b) die Prüftiefe steuert, nicht die Förderentscheidung, und (c) im UI die Stufen je Kategorie im Vordergrund stehen, nicht die Summe.
- **KI-Eignung:** Die Ankertexte sind fertige Klassifikationskriterien — ideal für eine Vorbewertung je Kategorie und für Eval-Gold-Labels auf den fiktiven VBs (exakte Stufe / ±1).
- **Querverbindung zur Aufbereitung:** Der Anker „Verbesserungen vorwiegend qualitativ beschrieben" (B1) ist exakt die Definition unserer „vage/nicht belegt"-Markierung im Canvas — beide Mechanismen sollten dieselbe Klassifikation nutzen.

---

## 4. Konzept-Deltas (Änderungen an `konzept-pruefchecklisten.md`)

1. `PruefCheckliste.ebene: 'antrag' | 'verbund'` — Verbund-Checkliste bindet an die Verbund-Entität, ihr Fortschritt speist sich teils aus den TV-Ergebnissen (G6-Gate).
2. `PruefItem.antwortTyp: 'binaer' | 'skala'` mit Ankertexten je Stufe.
3. **Registry-Parameter für Praxis-Richtwerte** (`AP_MAX_PM = 6`, `ANGEBOTE_PFLICHT_AB = 15000`, `WIRKUNG_UMSATZ_FAKTOR = 1.0`, Triage-Schwelle `INNO_SCORE_KURZPFAD = 8` …) — Kurator-pflegbar, versioniert, von K-Checks referenziert.
4. **Prüfklasse je Unteraspekt** (R/K/S/E) im Datenmodell — steuert Vorbelegung, Werkzeug und Anzeige (E-Items zeigen die Recherchequelle, K-Items den berechneten Befund).
5. **Cross-Rollen-Hinweis:** Item kann bei Bewertung eine Aufgabe/Notiz an die andere Rolle erzeugen („Hinweis an AB: 3 Angebote anfordern").
6. `bedingung` bleibt im Modell (Triage-Anwendungsfall), aber v1 nur mit einfacher Score-/Feld-Bedingung.
7. **PreCheck als eigene Checkliste** in der Eingangsphase (geklärt durch preCheck-fachlich) mit dreiwertigem Triage-Gate; Inno-Score-Ergebnis wird an die Fachprüfung durchgereicht.
8. **Modellierter Prüfungs-Abschluss:** Der Abschluss einer Checkliste ist ein eigenes Ergebnisobjekt mit Ausgang (NF / RNE-Ablehnung / Gutachten bzw. Triage-Ausgang), Hinweis-Freitexten für das Zielartefakt und automatischer **AB-Benachrichtigung**; „Teilvorhabentitel prüfen/anpassen" als fester Abschluss-Teilschritt.
9. **Checklisten-Varianten je Antragstellertyp** (F-KMU / F-FE) als getrennte Registry-Definitionen mit gemeinsamer Aspektstruktur.
10. **Netzwerk-Stammdaten** (reguläre Partner je ZKN) als pflegbare Entität — Voraussetzung für die K-Vorbelegung von P3 und für Verflechtungs-Checks im Netzwerk-Kontext.

---

## 5. Darstellungsformen „Vorhaben auf einen Blick" — Optionenkatalog

Geordnet nach Prüfnutzen (nicht nach Optik):

1. **SdT-Delta-Karte** *(neuer Favorit)*: Tabelle oder Slopegraph — je Zielparameter: Wert heute (SdT/Konkurrenz) → Zielwert des Vorhabens, mit Quantifizierungs-Kennzeichnung (quantifiziert · nur qualitativ · fehlt). Operationalisiert RL 4.1.1 und Inno-Score-Kategorie 1 unmittelbar; „nur qualitativ" ist automatisch NF-Kandidat. LLM extrahiert Parameter-Behauptungen mit Fundstellen; Vagheit wird sichtbar statt weggeglättet.
2. **Wirkungskette (Logic-Strip)**: Problem → FuE-Arbeiten → Ergebnis → Verwertung → Wirkung (Arbeitsplätze/Umsatz-Ziele), horizontal mit Fundstellen. Deckt die Zielkriterien-Prüfung (4.5.1) und die Wirtschaftlichkeits-Richtwerte ab; sehr gut druckbar.
3. **Projekt-One-Pager (A4, Druck/PDF)**: Canvas kompakt + KPI-Zeile + Mini-Gantt + Inno-Score-Stufen — als Akten-/Gutachten-Anlage. Nutzt die pdf-Export-Fähigkeit der App-Umgebung.
4. **Risiko-Board**: Risiken als Karten mit AP-Bezug (Kopplung Risiko ↔ Lösungsweg aus Inno-Score K3); leere oder vage Risikodarstellung wird als solche angezeigt.
5. **AP-Relationen-Balken**: Anteile Vorbereitung : Entwicklung : Test/Auswertung — macht das Checklisten-Kriterium „Relation stimmig" auf einen Blick prüfbar (AP-Typisierung per LLM-Klassifikation der AP-Namen, FB korrigierbar).
6. **Verbund-Schwimmbahnen-Gantt**: TV-Gantts übereinander mit Schnittstellenmarkern (für G3).
7. Verspieltere Formen (Metro-Map der AP, Trading-Card) — geringer Prüfnutzen, nicht priorisieren.

**Empfehlung:** 1 und 2 als neue Canvas-Nachbarn in der Aufbereitung (oder Tabs im Fokus-Mode), 3 als Export, 5 als kleines Element im Zahlenteil, 6 im Verbund-Kontext. Alles hand-rolled SVG-tauglich.

---

## 6. Portfolio-Ebene: Welche Dimensionen taugen wirklich? (Sunburst-Frage)

**Kernproblem benannt:** ZIM ist ausdrücklich technologie- und branchenoffen (RL Nr. 2). Anders als beim INVITE-Referenzboard gibt es **keine programmgegebene Themen-Taxonomie** — jede Themenfeld-Liste wäre selbst erfunden, müsste gepflegt werden und hätte unklaren Steuerungswert. Ehrliche Konsequenz: **Der Themen-Sunburst aus Nachtrag N.2/N.3 wird zurückgestellt**, nicht gestrichen — er wird erst sinnvoll, falls Berichtspflichten oder Programmsteuerung tatsächlich eine Technologiefeld-Dimension verlangen (→ offene Frage 5).

**Was stattdessen trägt:**

*Deterministische Strukturdimensionen (aus JSON, sofort verfügbar):*
- Projektform (EP / KP mit Unternehmen / KP mit FE) × Größenklasse (klein/jung/mittel/b/c) — **das ist exakt die Fördersatzmatrix aus RL 5.2.1.** Als Mosaik-/Marimekko-Darstellung (Zellfläche = Anzahl oder Volumen) wird die Richtlinien-Tabelle zur gelebten Portfolio-Sicht — vertrauter Rahmen für alle Beteiligten.
- Region/strukturschwach, Kostenvolumen-Klassen, Laufzeit, Innovationstyp-Checkbox (Einstieg neues Technologiefeld / neue Kombination).

*Prüfprozess-Dimensionen (aus PruefErgebnis, aggregiert über Anträge):*
- **Befund-Landkarte:** Heatmap Aspekt × Befundverteilung („wo häufen sich unklar/NF über alle Anträge?") — Programm-Lernschleife: schwache Stellen der Anträge → bessere Antragsberatung, schärfere Checklisten. 
- Inno-Score-Stufenverteilung, NF-Quoten, Durchlaufzeiten je Phase.
- Leitplanke bleibt: ausschließlich antragsbezogen aggregiert, niemals bearbeiterbezogen.

*Ebene 2 („Antrag vor Portfolio") angepasst:* statt Themen-Radar ein **Perzentil-Streifenband** über deterministische Kennzahlen — Kostenstruktur, PM, Laufzeit, Unterauftragsanteil dieses Antrags als Marker auf der Portfolio-Verteilung. Neutraler Einordnungsblick („Unterauftragsanteil im obersten Zehntel") ohne Bewertungsoptik.

---

## 7. Offene Fragen

**Geklärt in v0.2:** FE-Checkliste liegt vor und ist als F-FE-Variante eingearbeitet (ehem. Frage 1); PreCheck-Unterlagen liegen vor (ehem. Frage 2); PreCheck wird eigene Checkliste in der Eingangsphase (ehem. Frage 3).

1. Enthält das Plattform-JSON eine **Branche/WZ-Code**-Angabe? (Portfolio-Dimension; im Dummy nicht gesehen.)
2. **Berichtspflichten an das BMWK/Programmebene:** nach welchen Dimensionen wird berichtet? Entscheidet über Priorität und Zuschnitt der Portfolio-Sichten (und über das Schicksal des Themen-Sunbursts).
3. Pflege-Governance der **Praxis-Richtwerte** (6 PM, 15 T€, Umsatz-Faktor, Triage-Schwelle 8, ±1-Abweichung): Kurator allein oder mit Fachrunden-Freigabe?
4. Anlagen-Systematik (Anlage 2/3/4/5/6.3a/7) als benannte Evidenzorte ins Datenmodell (`Fundstelle.dokumentId` + Anlagentyp)?
5. **Netzwerk-Stammliste** (reguläre Partner je ZKN): Wo wird sie heute geführt, und kann sie in die App übernommen werden (Import oder Pflege-UI)?
6. Gibt es neben dem fachlichen PreCheck auch einen **administrativen PreCheck** mit eigener Liste, oder deckt die Vollständigkeitsprüfung das ab?
7. **VWP-Verweise** (z. B. VWP 5.11 bei benanntem Personal privater FE): Sollen Verwaltungsvorschriften-Referenzen wie Richtlinien-Fundstellen an Items gepflegt werden?
