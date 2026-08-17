/**
 * Datenmodell des Status-Katalogs.
 *
 * Der Katalog macht aus der bisher hartkodierten Status→Kategorie-Map
 * **kuratierbare, versionierte Daten**: jedes Statusfeld und jeder bekannte
 * Statuswert bekommt einen Eintrag mit Label, ZAH-Phase, Zieltagen und
 * Prominenz. Unbekanntes wird beim Import als `unkuratiert` aufgenommen — nie
 * stillschweigend gemappt.
 *
 * **Der Katalog leitet keinen Status ab** (Pitfall #44). Bis v2.384 trugen die
 * Einträge zusätzlich Spine-Phase, Rang und ein Terminal-Flag; daraus rechnete
 * die App eine eigene Verfahrensposition, die dem amtlichen Status regelmäßig
 * vorauslief. Was bleibt, ist eine Lesebrille: der amtliche Code, seine
 * ZAH-Phase und die daraus abgeleitete {@link StatusCategory}.
 */
import type { StatusCategory } from '@/core/utils/status-canonical';

export type { StatusCategory };

/** Anzeige-Prominenz eines Feldes/Wertes. Wirkt **nur** auf die Darstellung
 *  (Timeline/Warum), nie auf Erfassung oder Ableitung. `ignoriert` = nirgends
 *  gerendert (Events werden trotzdem vollständig erfasst). */
export type Prominenz = 'meilenstein' | 'normal' | 'nebensaechlich' | 'ignoriert';

/**
 * Die **ZAH-Phase** — die Lesebrille der App auf das Verfahren des Fachsystems.
 *
 * Bewusst eine App-Erfindung: C16 kennt keine Phasen (`VB_PHASE` ist die
 * Fördervariante, ein anderes Konzept — siehe `vb-phase-mappings.ts`). Der Name
 * trägt das „ZAH" deshalb im Bezeichner, damit die Kollision mit `VB_PHASE`
 * dauerhaft beendet ist.
 *
 * Sie hängt am **Status-Code**, nicht am Rohtext, und ist eine explizite,
 * PL-editierbare Zuordnungstabelle — kein Ableiten aus Code-Bereichen, weil die
 * Codes nur grob geordnet sind (32 ablehnungsreif liegt vor 34 bearbeitungsreif).
 *
 * **Nur Anzeige-Funktion**: Gruppierung, Filter, Sortierung. Die ZAH-Phase leitet
 * nichts ab und triggert nichts. Marker-Status (29, 88, 93, 94) bekommen bewusst
 * KEINE Phase (`zahPhaseId: null` + `marker: true`).
 *
 * Seit v2.385 die **einzige** Phasen-Achse der App. Daneben stand bis dahin eine
 * zweite, aus Rängen abgeleitete („Spine-Phase") — sie lief dem amtlichen Status
 * regelmäßig voraus und ist mit dem Rückbau entfallen.
 */
/**
 * Id einer ZAH-Phase — **stabil und opak**.
 *
 * Bis v2.408 ein geschlossener Union der sechs ausgelieferten Phasen. Seit die
 * PL den Schnitt selbst zuschneidet (3 bis 9 Phasen, freie Beschriftung), ist
 * die Id ein beliebiger String. Die sechs Auslieferungs-Ids (`eingang` …
 * `abgeschlossen`) bleiben erhalten — deshalb brauchen Bestandsfassungen keine
 * Migration.
 *
 * **Nummern sind keine Identität.** Reihenfolge und Beschriftung sind eigene
 * Felder; wird eine Phase eingeschoben, ändert sich keine Id. Was der Nutzer als
 * 1…n sieht, ist Anzeige aus der Reihenfolge, nie ein Schlüssel.
 */
export type ZahPhaseId = string;

/**
 * Ein Eintrag der ZAH-Phasen-Tabelle. Kuratierbar im Baum-Editor des
 * Status-Cockpits; die Auslieferung steht in `SEED_ZAH_PHASEN`.
 *
 * **Eine Phase sagt nichts über Arbeitslisten** (seit v4.87). Sie trug dafür bis
 * v4.86 ein Feld `kategorieVorgabe` — damit konnte ein Umhängen im Baum Anträge
 * zwischen Reitern verschieben, ohne dass es jemand beschlossen hätte (v3.25:
 * 448 Stück). Die Arbeitsliste hängt am Code (`CODE_ZU_ARBEITSLISTE`); was hier
 * steht, wirkt auf Anzeige, Zieltage und Fristlauf. Ein Altfeld aus einer
 * früheren Fassung wird beim Lesen ignoriert.
 */
export interface ZahPhase {
  id: ZahPhaseId;
  label: string;
  /** Aufsteigend entlang des Verfahrens; bestimmt Spalten-/Balken-Reihenfolge. */
  reihenfolge: number;
  /**
   * Zählt diese Phase für den Zieltage-Vorschlag aus dem Ist? Löste die feste
   * Menge `ZIELTAGE_PHASEN` ab.
   *
   * Fehlt in Fassungen vor v2.409 — `zahPhasenVon` ergänzt aus dem Seed.
   */
  zieltageRelevant?: boolean;
  /**
   * Läuft die Bearbeitungsfrist (90 Tage) in dieser Phase überhaupt noch?
   *
   * Die Uhr rechnet sonst für JEDEN Antrag weiter — auch für einen, der vor
   * Jahren entschieden wurde. Sie bedeutet dort nur nichts mehr: im Bestand
   * stand „seit 2 760 T" an einem Vorgang von 2018, exakt Eingang + 90 Tage
   * bis heute. Bis v3.6 kannte nur das Vorgangs-Board dieses Kriterium (als
   * feste Menge `ANTRAGSPHASE`); hier ist es Katalogdatum und damit ohne
   * Release änderbar — der Zuschnitt ist fachlich strittig.
   *
   * Fehlt in Fassungen vor v3.6 — `zahPhasenVon` ergänzt aus dem Seed.
   */
  fristLaeuft?: boolean;
}

/**
 * Eine Phase, wie `zahPhasenVon` sie liefert: alle Felder gesetzt, Lücken einer
 * Bestandsfassung aus dem Seed geschlossen. Jeder Leser bekommt diese Form —
 * die optionalen Felder sind allein die Persistenz-Sicht.
 */
export type GeltendeZahPhase = Required<ZahPhase>;

/**
 * Wer einen Statuseintrag setzt. Quelle ist die Kürzel-Zuarbeit des Fachsystems
 * (Spalte „wird gesetzt von:") — deshalb heißt es „setzt", nicht „ist zuständig
 * für": `[AN]` „NF an ASt" setzen AB/FB/QS, betreffen tut der Eintrag alle.
 *
 * Rein deskriptiv: filtert und sortiert die Anzeige, sperrt nichts und geht
 * nicht in die Ableitung ein.
 *
 * **Neutral wird NICHT als eigener Wert geführt**: ein Eintrag ohne Rollen darf
 * von jedem gesetzt werden und ist damit für jede Rollenwahl sichtbar (siehe
 * `betrifftRolle` in `rollen.ts`). Ein leeres Array bedeutet „alle", nie
 * „niemand" — der häufigste Irrtum an dieser Stelle.
 */
export type Rolle = 'ab' | 'fb' | 'qs' | 'pa' | 'jur';

/**
 * Vorgänger von {@link Rolle} — kannte nur die AB/FB-Achse und hatte keinen
 * Platz für QS, PA, Juristen und neutral. Bestandsfassungen in IDB und auf dem
 * Share tragen ihn noch; gelesen wird ausschließlich über `rollenVonFeld`
 * (`rollen.ts`), das ihn zur Lesezeit übersetzt.
 *
 * @deprecated seit v2.348 — neue Einträge tragen `rollen`.
 */
export type Zustaendigkeit = 'ab' | 'fb' | 'beide';

/**
 * Ein Ordner des Statusbaums, wie ihn das Fachsystem führt (Kommunikation,
 * Antragsbearbeitung → pre-check, Betreuung, …). Beliebig tief.
 *
 * Verbund- und Teilvorhaben-Baum sind **getrennt**: „Kommunikation" gibt es auf
 * beiden Ebenen, mit verschiedenen Codes dahinter (`[XYB]` gegen `[YB]`). Die
 * `ebene` gehört deshalb an die Kategorie, nicht nur ans Feld.
 */
export interface StatusKategorie {
  /** Stabil, sprechend: `vb.antragsbearbeitung`, `tv.antragsbearbeitung.pre-check`. */
  id: string;
  elternId: string | null;
  label: string;
  ebene: 'verbund' | 'tv';
  /** Sortierung unter demselben Elternknoten (Zehnerlücken). */
  reihenfolge: number;
  aktiv: boolean;
}

/** Katalog-Eintrag für ein Statusfeld (CSV-Spalte bzw. Canonical-Feld). */
export interface StatusFeldEintrag {
  /** Canonical-Field-Key (`status`, `verbund_status`) ODER — bei den Codes des
   *  Fachsystems — der ROHE CSV-Spalten-Code (`D_XTEC`). Der Code ist der
   *  einzige über Programme hinweg stabile Bezeichner; der tatsächliche
   *  Record-Key wird zur Lesezeit über das Schema aufgelöst (`feld-aufloesung.ts`). */
  feldId: string;
  label: string;
  /** `datum`: das Datum IST das Event. `text`: freier Texteintrag (`T_*`-Spalten).
   *  Beide haben kein Wert-Enum — ihr Ableitungs-Beitrag hängt am Feld. */
  typ: 'wert' | 'datum' | 'text';
  /** Fachliche Ebene des Eintrags: gilt er dem Verbund oder dem Teilvorhaben?
   *  Steuert die Event-/Timeline-Zuordnung. */
  ebene: 'verbund' | 'tv';
  /** Tatsächlicher Record-Key, falls ≠ `feldId` (z.B. `verbund_status` → der
   *  Verbund-Record führt ihn unter `status`). Default: `feldId`. */
  quelleKey?: string;
  /**
   * Aus WELCHEM Record gelesen wird — unabhängig von der fachlichen `ebene`.
   * Nötig, weil die Verbund-Codes (`X`-Präfix) nicht im Verbund-Record stehen:
   * der führt nur `titel` und `status`. Sie stehen identisch auf jeder
   * TV-Zeile der CSV. Default: dieselbe Herkunft wie die `ebene`.
   */
  herkunft?: 'verbund-record' | 'tv-record';
  /** Code des Fachsystems ohne Spalten-Präfix (`XTEC` zu `D_XTEC`) — der
   *  Bezeichner, unter dem das Team den Eintrag kennt. */
  code?: string;
  /** Begleitende Text-Spalte (`T_AAI` zu `D_AAI`). Das Fachsystem führt zu
   *  manchen Terminen eine Notiz; sie gehört zum selben Ereignis und bekommt
   *  deshalb keinen eigenen Katalog-Eintrag. */
  textSpalte?: string;
  /** Referenz in den Kategoriebaum (kein Pfad — Umbenennen bricht nichts).
   *  Ohne Zuordnung erscheint das Feld unter „Nicht zugeordnet". */
  kategorieId?: string;
  /** Wer den Eintrag setzt. LEER oder fehlend = neutral: jeder darf, der
   *  Eintrag ist unter jeder Rollenwahl sichtbar. Immer über `rollenVonFeld`
   *  lesen — nur dort wird `zustaendigkeit` mit übersetzt. */
  rollen?: Rolle[];
  /**
   * Vorgangssystem: gehört dieses Kürzel zur laufenden Antragsbearbeitung?
   *
   * Markiert die ~50–70 Codes, die Navigator, Wächter und Verlaufs-Näherung
   * auswerten. Das historische Rauschen (Kommunikations-Kanäle, Altlasten) bleibt
   * vollständig abrufbar, stört aber nicht mehr — **nichts wird gelöscht**.
   * Fehlend = `false`; die Auslieferung setzt bewusst keine Vorbelegung, sondern
   * bietet im Kürzel-Tab eine Aktion „AB-Dashboard-Spalten markieren" an.
   */
  relevant?: boolean;
  /**
   * **Ruht** dieses Kürzel — soll es Tabelle, Auswahlliste und Fragebogen in
   * Ruhe lassen? Dreiwertig, und das ist der Punkt:
   *
   * - **fehlend** — die Ableitung entscheidet: ohne gemappte CSV-Spalte ruht das
   *   Kürzel, sonst nicht. Ein neu gemapptes wacht damit von selbst auf.
   * - **`true`** — die PL hat es ruhen lassen (typisch: der Bestandslauf hat es
   *   als seit zwei Richtlinien ungesetzt vorgeschlagen).
   * - **`false`** — „trotzdem beachten": die Ausnahme, die auch die Ableitung
   *   übersteuert. Für ein frisch eingeführtes Kürzel, das noch keine Spalte hat.
   *
   * **Sichtbarkeit, nicht Wahrheit** (Pitfall #53): Chronik, Zeitstrahl,
   * Navigator, Wächter und `reconcile` lesen dieses Feld NICHT — ein Altantrag
   * behält seinen Eintrag. Nicht zu verwechseln mit {@link aktiv}, das das
   * Event-Schreiben beim Import stoppt. Einzige Lesestelle:
   * `ruhende-kuerzel.ts`.
   */
  ruht?: boolean;
  /** @deprecated seit v2.348 — `rollen`. Wird nur noch gelesen, nie geschrieben. */
  zustaendigkeit?: Zustaendigkeit;
  /**
   * Zu welcher ZAH-Phase dieses Datumsfeld gehört.
   *
   * Beantwortet „welches Datum gehört zum aktuellen Status?" — die Grundlage
   * der „seit"-Angabe in der Status-Erklärung und der Phasen-Marke in der
   * Chronik. Nur gesetzt, wo die Zuordnung fachlich klar ist; ein Feld ohne
   * Phase trägt nichts bei, und das ist besser als eine geratene Marke.
   * PL-editierbar im Kürzel-Tab.
   *
   * **Nicht zu verwechseln mit der Ableitung**: die Phase ordnet ein Datumsfeld
   * ein, sie leitet keinen Status ab (Pitfall #44).
   */
  zahPhaseId?: ZahPhaseId | null;
  prominenzDefault: Prominenz;
  aktiv: boolean;
  unkuratiert: boolean;
  erstmalsGesehen?: string;
}

/** Katalog-Eintrag für einen konkreten Statuswert eines Feldes. */
export interface StatusWertEintrag {
  /** Stabil: `${feldId}::${normalisiert(wert)}`. */
  id: string;
  feldId: string;
  /** Rohwert in Original-Schreibweise. */
  wert: string;
  /** Default: `wert`. */
  label?: string;
  /**
   * Kuratierte **Kurzform** für enge Flächen — schlägt die ausgelieferte
   * `StatusCodeEintrag.kurz`. Leer/fehlend heißt „nicht kuratiert", nicht
   * „leeres Label": die Auflösung fällt dann auf die Auslieferung zurück und
   * erst danach auf den gekürzten Bezeichner.
   *
   * Gepflegt wird **je Code**, nicht je Wert-Id (`setzeKurzLabel`): derselbe
   * Code steht unter `status` UND `verbund_status`, und der Snapshot kollabiert
   * beide auf einen Schlüssel. Nur eine der Zeilen zu setzen hieße, dass die
   * Sortierung entscheidet, welche Beschriftung gilt.
   */
  kurzLabel?: string;
  /**
   * Kanonische Kategorie. **Abgeleitet, nicht kuratiert**: für Werte mit
   * amtlichem Code entsteht sie aus Code + ZAH-Phase
   * (`kategorie-ableitung.ts`), und der Snapshot rechnet sie beim Laden neu.
   * Das Feld bleibt für unkuratierte Werte (kein Code) und als Anzeigewert.
   */
  kategorie: StatusCategory;
  prominenz: Prominenz;
  aktiv: boolean;
  unkuratiert: boolean;
  erstmalsGesehen?: string;

  // --- Vorgangssystem: der Statuswert als CODE des Fachsystems --------------
  // Der Export liefert Status nur als TEXT. Der Code (11 Skizze … 99
  // Schlussvermerk) kommt aus dem importierten Status-Katalog und wird über
  // `wert` + `varianten` angejoint (`status-codes.ts`). Danach rechnet die App
  // intern mit Codes; Textvarianten betreffen nur noch Beschriftungen.

  /** Amtlicher Status-Code (11…99). Fehlt = Wert ist (noch) nicht im Katalog. */
  code?: number;
  /** Bekannte Schreibweisen desselben Status im Export („Stellungnahme zur
   *  Rücknahmeempf." zu 72). Join-Reihenfolge: `wert` zuerst, dann Varianten. */
  varianten?: string[];
  /** ZAH-Phase dieses Codes. `null` = bewusst ohne Phase (Marker), `undefined`
   *  = noch nicht zugeordnet. Der Unterschied ist der zwischen „gehört nicht ins
   *  Verfahren" und „hat noch niemand entschieden". */
  zahPhaseId?: ZahPhaseId | null;
  /** Kennzeichen neben dem Verfahren (29 Irrläufer, 88 Sonderstatus, 93/94
   *  Partner) — läuft ohne Phase mit. */
  marker?: boolean;
  /** Vorgangssystem/Wächter: nach wie vielen Tagen ohne Vorgangs-Aktivität gilt
   *  ein Antrag in diesem Status als hängend? Fehlend/`null` ⇒ der Wächter meldet
   *  **`unbewertet`** („kein Ziel definiert"), NICHT „läuft". */
  zieltage?: number | null;
}

// --- Vorgangssystem: Trigger-Tabelle des Fachsystems -------------------------

/** Die vier Prozeduren, die C16 an ein Kürzel hängen kann. */
export type TriggerProzedur =
  | 'TRG_TVs_Status_TV_VB'
  | 'TRG.VorgEintragNeu'
  | 'TRG.VorgEintragMail'
  | 'TRG.Status.TV.VB';

/** Vorbedingung an den Verbund-Status: `<59` = „vor 59". */
export interface StatusVergleich {
  op: '<' | '>' | '=';
  code: number;
}

/**
 * Die geparsten Parameter einer Trigger-Zeile, je Prozedur eigen geformt.
 *
 * Die drei Kürzel-Listen von `statusTvVb` sind **UND-Listen**: `ABB,AB,AK4` heißt
 * „hat kein ABB UND kein AB UND kein AK4". Die Legacy-Doku (Blatt „Erklärung
 * Prozedur") lässt Kommas ohne Leerzeichen in den Argumenten 2–6 zu; ungesplittet
 * suchte die App ein Kürzel namens „ABB,AB,AK4" und fände nie eines.
 */
export type TriggerParam =
  | {
    art: 'statusTvVb';
    /** Vorbedingung an den Verbund-Status (`<59`). */
    status: StatusVergleich | null;
    /** Das TV darf KEINES dieser Kürzel tragen (`ABB` bzw. `ABB,AB`). */
    ohneTvKuerzel: string[];
    /** KEIN Teilvorhaben des Verbunds darf eines dieser Kürzel tragen (`YIRR`). */
    ohneVerbundKuerzel: string[];
    /** Argumente der Positionen 4–6 plus alles jenseits der achten. Werden nie
     *  verworfen, sondern im Satz mitgeführt — die Legacy-Doku deckt ihre
     *  Bedeutung nicht ab, ihre Kürzel gehen aber in die Katalog-Prüfung ein. */
    weitere: string[];
    /** Neuer TV-Status, `null` = unverändert. */
    statusTv: number | null;
    /** Neuer VB-Status, `null` = unverändert. */
    statusVb: number | null;
  }
  | { art: 'vorgEintragNeu'; code: string; ebene: string; tage: number }
  | { art: 'vorgEintragMail'; empfaenger: string; textbaustein: string; cc: string | null }
  | { art: 'statusSetzen'; ebene: string; status: number };

/**
 * Eine Zeile der importierten Trigger-Tabelle: welches Kürzel löst in welcher
 * Folge welche Prozedur mit welchen Parametern aus.
 *
 * Nicht parsebare Zeilen werden **nie stillschweigend verworfen**: `geparst`
 * bleibt `null` und `satz` trägt „Nicht interpretiert: <Rohtext>". Heuristiken
 * sind ehrlich, sonst behauptet die Erklärung mehr, als sie weiß.
 */
export interface TriggerZeile {
  /**
   * Programm-/Richtlinien-Nummer der Zuarbeit (`76`, `131` …) — **Teil des
   * Schlüssels**, nicht Beiwerk.
   *
   * Dasselbe Kürzel trägt je Programm andere Trigger; ohne diese Dimension
   * kollabierten 2450 Zeilen auf 362, weil alles jenseits des ersten Programms
   * als Dublette wegfiel. Leer (`''`) heißt „aus einer Fassung vor v2.380" und
   * matcht deshalb **keinen** Antrag — nie ein Ersatz-Programm.
   */
  programm: string;
  /** Kürzel des Fachsystems ohne Spalten-Präfix (`AAE`), NFC-normalisiert. */
  kuerzel: string;
  /** Reihenfolge der Prozeduren an demselben Kürzel (1, 2, 3 …). */
  folge: number;
  /** Rohwert der Prozedur-Spalte — auch wenn sie keine der vier bekannten ist. */
  prozedur: string;
  /** Die Parameter-Spalte, wie sie in der XLSX steht (Pipe-getrennt). */
  parameterRoh: string;
  geparst: TriggerParam | null;
  /** Deutsche Satzform für die Anzeige. Immer gefüllt. */
  satz: string;
}

/**
 * Ein Eintrag der Textbaustein-Legende (Blatt „Erklärung Parameter"):
 * `!.055.VorgInfo.01` → wofür dieser Baustein steht.
 *
 * Nur Beschriftung — die Mail-Trigger tragen die Kennung, die Legende macht sie
 * lesbar. Aufgelöst wird zur ANZEIGEZEIT (`triggerSatz(p, legende)`), nicht beim
 * Parsen: sonst müsste eine später importierte Legende die ganze Trigger-Tabelle
 * neu parsen lassen.
 */
export interface TextbausteinEintrag {
  /** Kennung wie in der Trigger-Zeile (`!.055.VorgInfo.01`). */
  kennung: string;
  /** Klartext aus der Zuarbeit. */
  text: string;
}

// --- Vorgangssystem: To-do-Regeln --------------------------------------------

/**
 * Eine Zeile der To-do-Entscheidungstabelle — der geteilte, versionierte Ersatz
 * für die WENN-Formeln der privaten AB-XLSX-Mappe.
 *
 * **Auswertungsmodell: geordnete Liste, erste zutreffende Regel gewinnt** (exakt
 * die Semantik verschachtelter WENNs). Die Reihenfolge steckt in
 * {@link TodoRegel.reihenfolge} und ist per Drag änderbar — bewusst KEINE
 * Prioritätszahlen wie bei {@link NaechsterSchrittRegel}, weil „Priorität" bei
 * einer Kaskade das falsche Wort für „Position" ist.
 *
 * Trifft keine Regel: „kein To-do ermittelt" — sichtbar, nicht leer.
 */
export interface TodoRegel {
  /** Stabil und sprechend (`r6-sv-nach-widerspruchsfrist`, `s1-zurueckgezogen`). */
  id: string;
  /** Position in der Kaskade (aufsteigend, Zehnerlücken). */
  reihenfolge: number;
  /** Menschenlesbare Herkunft („R6 · Rücknahmeempfehlung"). */
  beschreibung: string;
  bedingung: Bedingung;
  /**
   * Der To-do-Text, wie ihn das Board gruppiert („RNE ergänzen"). Bei einer
   * **Sperre** leer: sie erzeugt kein To-do, sondern unterdrückt Stränge.
   */
  todo: string;
  /** Wer handelt. Leer = keine Rolle benannt (nicht: „alle"). */
  zustaendig: Rolle[];
  /**
   * Fremdrollen-Ansicht derselben Regel: für den AB ist „RNE ergänzen" eine
   * Aufgabe, für den FB erscheint derselbe Antrag als „wartet auf AB". `ASt` =
   * Antragsteller (außerhalb des Hauses), deshalb kein {@link Rolle}.
   */
  wartetAuf?: Rolle | 'ast' | null;
  /**
   * Zu welchem **Regelsatz** die Regel gehört — die Kaskade der Rolle, die sie
   * abarbeitet. Fehlend ⇒ `'ab'`, weil der ausgelieferte Seed die AB-Mappe
   * transkribiert; jede Fassung aus der Zeit vor v2.390 verhält sich damit
   * unverändert, ohne dass die geteilte Datei umgeschrieben wird.
   *
   * Bewusst der bestehende {@link Rolle}-Typ statt eines eigenen `'AB'|'FB'`:
   * QS, PA und Juristen bekommen ihren Satz dann ohne zweite Migration.
   * Gelesen wird ausschließlich über `regelsatzVon` (`regelsatz.ts`).
   */
  regelsatz?: Rolle;
  /**
   * Nur an einer **Sperre** sinnvoll: in welchen Regelsätzen sie greift.
   * Fehlend ODER leer ⇒ in allen. S0/S0b/S1/S2 sind vorgangsweit und tragen das
   * Feld deshalb nicht.
   *
   * **Gegenläufig zu {@link TodoRegel.zustaendig}**: dort heißt leer „keine
   * Rolle benannt", hier „alle Rollen" — wie bei
   * {@link StatusFeldEintrag.rollen} (Pitfall #43). Die beiden Konventionen
   * stehen in diesem Typ nebeneinander; gelesen wird deshalb ausschließlich
   * über `sperreGiltFuer` (`regelsatz.ts`).
   */
  giltFuer?: Rolle[];
  /**
   * Der **Strang**, zu dem die Regel gehört — die fachliche Kette, die eine
   * Sperre als Ganzes stilllegt (`rne`, `ablehnung`, `nachforderung`, …).
   *
   * Bis v2.412 zählten S1 und S2 sieben Regel-Ids einzeln auf. Wer eine achte
   * RNE-Regel anlegte, musste daran denken, beide Sperren zu ändern — und wenn
   * er es vergaß, fiel die neue Regel still durch jede Sperre hindurch. Der
   * Kopfkommentar der Engine sprach längst von Strängen; nur das Datenmodell
   * nicht.
   *
   * Freitext mit Vorschlagsliste, nicht Enum: die Fachseite pflegt die Kaskade
   * selbst, und ein neuer Strang darf kein Release brauchen. Gelesen wird
   * ausschließlich über `sperrEintragTrifft` (`regelsatz.ts`).
   */
  strang?: string;
  /**
   * Sperre statt To-do: trifft sie zu, werden die genannten Regeln übersprungen.
   * Bildet S1/S2 der Mappe ab (zurückgezogener Antrag bzw. begonnene RNE/ABL
   * unterdrücken die PreCheck- und Nachforderungs-Stränge).
   *
   * Drei Formen nebeneinander, ausdrücklich mischbar:
   * - `'*'` ({@link ALLE_STRAENGE}) — alle übrigen Regeln.
   * - `'strang:rne'` — alle Regeln mit {@link TodoRegel.strang} `'rne'`; eine
   *   später ergänzte gehört automatisch dazu.
   * - `'r22'` — genau diese eine Regel, für Fälle ohne passenden Strang.
   *
   * Gemischte Listen sind der Normalfall und kein Übergangszustand: eine
   * Umstellung, die nur ganz oder gar nicht ginge, bliebe unvollständig liegen.
   */
  sperrt?: string[];
  /**
   * Ausnahmen von {@link TodoRegel.sperrt} — nur sinnvoll neben `'*'`.
   *
   * Macht sichtbar, welche Aufgabe eine Totalsperre bewusst überlebt (S0b legt
   * alles still, außer „ZuwB erstellen"), und hält, wenn jemand später die
   * Bedingung der ausgenommenen Regel ändert.
   */
  sperrtNicht?: string[];
  /**
   * **Woher die Regel stammt und wer sie beschlossen hat** — Freitext.
   *
   * Die Kaskade wird künftig von AB- und FB-Vertretern selbst gepflegt. Eine
   * Regel ohne Herkunft ist in einem halben Jahr nicht mehr zu beurteilen: es
   * steht dann da, WAS gilt, aber nicht, ob es noch gelten soll. Die
   * ausgelieferten Regeln tragen ihre Herkunft im Quell-Dokument
   * (`todo-regeln-ab-seed.md`); für alles, was danach entsteht, ist dieses Feld
   * die einzige Stelle.
   *
   * Läuft durch Speichern, Export und Import mit. Beim **Nachziehen** der
   * Auslieferung geht sie an einer Seed-Regel verloren wie jede andere Änderung
   * daran — das ist der dokumentierte Zweck von `zieheTodoRegelnNach`.
   */
  begruendung?: string;
  aktiv: boolean;
}

/** Sentinel in {@link TodoRegel.sperrt}: „alle übrigen Regeln". */
export const ALLE_STRAENGE = '*';

// --- Nächste-Schritte-Regeln (Struktur hier; Auswertung folgt in Phase 3) ---

export type Werkzeug = 'gutachten' | 'nachforderung' | 'ablehnung';

/**
 * Bedingung eines Regelblatts oder einer UND/ODER-Gruppe. Rein deklarativ.
 *
 * Ausgewertet **ausschließlich** von `pruefeBedingung` (`bedingung.ts`) — dem
 * einen Evaluator, den sich Nächste-Schritte-Regeln, Bearbeitungs-Meilensteine
 * und To-do-Regeln teilen.
 *
 * **Jedes Blatt trägt `feldId`.** Darauf verlassen sich `bedingungFeldRefs`
 * (`bedingung.ts`) und die Feld-Auflösung der Meilensteine; ein Blatt ohne
 * `feldId` fiele aus dem Auswertungs-Kontext und evaluierte still zu `false`.
 */
export type Bedingung =
  | { alle: Bedingung[] }
  | { einige: Bedingung[] }
  | { feldId: string; op: 'ist' | 'istNicht' | 'gefuellt' | 'leer'; wert?: string }
  /** Feld-Datum liegt vor/nach `heute + tageRelativHeute`. `datumVor` mit `0`
   *  ist zugleich „heute ist über den Termin hinaus" — dafür braucht es keinen
   *  eigenen Operator. */
  | { feldId: string; op: 'datumVor' | 'datumNach'; tageRelativHeute: number }
  /** Seit dem Feld-Datum sind MEHR als `tage` Tage vergangen (`> N`, nicht `>=`).
   *  Das wiederkehrende Muster der 31-Tage-Widerspruchsfrist (R6, R11). */
  | { feldId: string; op: 'tageSeit'; tage: number }
  /** Feld-Datum liegt nach dem Datum eines ANDEREN Feldes (R22: `D_AL` nach
   *  `D_AN`). Braucht keinen Stichtag — ein Vergleich zweier Daten. */
  | { feldId: string; op: 'datumNachFeld'; vergleichFeldId: string }
  /** Fördervariante (`VB_PHASE`) ist eine der genannten — 3 FuE, 5 DS usw.
   *  (`vb-phase-mappings.ts`). `feldId` ist üblicherweise `vb_phase`. */
  | { feldId: string; op: 'foerdervarianteIn'; varianten: number[] };

export interface NaechsterSchritt {
  label: string;
  /** Optionaler Verweis auf ein Workflow-Werkzeug — reine Navigation, nie ein Status. */
  werkzeug?: Werkzeug;
}

/** Eine gespeicherte, aktivierbare Fassung des Katalogs. */
export interface MappingVersion {
  /** v+1 beim Speichern. */
  version: number;
  /** `UserProfile.bearbeiter_kuerzel` (via `useMeinKuerzel`), null im Seed. */
  autor: string | null;
  zeitstempel: string;
  kommentar?: string;
  felder: StatusFeldEintrag[];
  werte: StatusWertEintrag[];
  /** Der Statusbaum. Optional, damit Fassungen aus der Zeit vor dem
   *  Code-Inventar unverändert gültig bleiben (fehlt er, sind alle Felder
   *  „Nicht zugeordnet"). */
  kategorien?: StatusKategorie[];

  // --- Vorgangssystem (additiv) ---------------------------------------------
  // Alle drei sind OPTIONAL, damit gespeicherte Fassungen aus IDB und Share ohne
  // Daten-Migration weitergelten — dieselbe Regel wie bei `kategorien`. Eine
  // Fassung ohne diese Felder verhält sich exakt wie vor der Erweiterung.

  /** Beschriftung + Reihenfolge der ZAH-Phasen (PL-editierbar). Die Zuordnung
   *  Code→Phase steht am Statuswert (`zahPhaseId`), nicht hier. */
  zahPhasen?: ZahPhase[];
  /** Die To-do-Entscheidungstabelle (geordnete Kaskade, PL-editierbar). */
  todoRegeln?: TodoRegel[];
  /** Legende der Mail-Textbausteine aus der Legacy-Parametertabelle. */
  textbausteine?: TextbausteinEintrag[];
  /**
   * Der **Betrachtungsbereich**: welche Förder-Richtlinien (`FM_NUMMER`) zählen
   * zum Arbeitsvorrat. Fehlt er, gilt der ausgelieferte Seed
   * (`betrachtungsbereich.ts`) — dieselbe Reihenfolge wie bei der
   * Kategorie-Fassade: Code als Grundlage, Fassung als Kuration.
   *
   * Bleibt eine **flache Code-Liste**, keine Generationen-Struktur: welche
   * Programme die Richtlinie 2015 bilden, ist Code-Wissen über die
   * Förderlandschaft; kuriert wird nur, *welche* Programme zählen. Und nur die
   * flache Form kann eine unvollständige Generation ausdrücken — worauf beruht,
   * dass der Chip dann keine Generationszahl behauptet.
   */
  betrachtungsbereich?: { programme: string[] };

  // Die **Trigger-Tabelle** steht bewusst NICHT hier, sondern in der
  // Geschwister-Sidecar `_intern/status-trigger.json` (`trigger-share.ts`):
  // sie ist reine Fremddaten ohne Kuration und wiegt mehr als der ganze
  // Katalog. Da diese Datei ALLE Fassungen führt, hätte sie zehnmal dasselbe
  // gespeichert und jedes Speichern über SMB verdreifacht (gemessen: 2,4 MB →
  // 6,8 MB bei zehn Fassungen). Gleiche Schreib-Mechanik, andere Datei.
}

// Hier standen bis v2.385 die Typen der Statusableitung (`Beitrag`,
// `FuehrenderWert`, `KonfliktDetail`, `AbleitungsErgebnis`). Sie sind mit ihr
// entfallen: die App leitet keinen Status mehr ab, sie liest den amtlichen
// (Pitfall #44).

/** Ein noch nicht kuratierter, beim Import entdeckter (Feld,Wert)-Fund. */
export interface UnkuratierterFund {
  /** Stabil: `${feldId}::${normalisiert(wert)}`. */
  id: string;
  feldId: string;
  wert: string;
  erstmalsGesehen: string;
}

/** Stabile Wert-ID aus Feld + normalisiertem Rohwert. */
export function wertId(feldId: string, wert: string): string {
  return `${feldId}::${normalisiereWert(wert)}`;
}

/** Normalisierung eines Rohwerts: trim + lowercase (deckungsgleich mit
 *  `status-canonical.ts`, damit Lookups über beide Pfade identisch treffen). */
export function normalisiereWert(wert: string): string {
  return wert.trim().toLowerCase();
}
