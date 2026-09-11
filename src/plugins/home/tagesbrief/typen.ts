/**
 * Tagesbrief — Datenmodell.
 *
 * Die Zeile ist eine **Segment-Liste, kein Satz**: an einem fertigen String
 * liesse sich keine einzelne Zahl aufhängen (dieselbe Lehre wie bei der
 * Nachtlauf-Zeile, v6.1). Jeder Punkt trägt deshalb `segmente` für die Maus und
 * zusätzlich `satz` am Stück für die Vorlesesoftware.
 *
 * `Sprungziel` ist bewusst **deklarativ** — der reine Kern kennt weder
 * `navigate` noch den Antraege-Store; erst das Widget übersetzt ein Ziel in die
 * bestehenden Aufrufe (`setAmpelQuickfilter`, `setKategorieQuickfilter`,
 * `navigate(…, { selectedId })`). Kein neuer Navigations-Mechanismus.
 */
/** Die vier Familien der Themenwahl. Reine Gruppierung für die Oberfläche. */
export type Familie = 'arbeitsvorrat' | 'bewegung' | 'eigenes' | 'umfeld';

/**
 * Abschliessende Themen-Liste. Ein Thema ist eine wählbare Aussage des Briefs
 * mit **genau einer** bestehenden Quelle — der Brief leitet nichts Neues ab.
 */
export type ThemaId =
  // Arbeitsvorrat (Uhr) — Meilensteine bewusst nicht (s. `themen.ts`)
  | 'stillstand'
  | 'zu-tun'
  // Arbeitsvorrat (ohne Uhr — Auskunft und Befund, keine eigene Handlung)
  | 'liegt-bei-anderen'
  | 'kuerzel-status'
  // Bewegung
  | 'nachtlauf'
  | 'eingang'
  // Eigenes
  | 'entwuerfe'
  | 'weitermachen'
  // Umfeld
  | 'feedback'
  | 'registry';

/**
 * Wohin ein Klick im Satz führt — deklarativ, vom Widget übersetzt.
 *
 * Bewusst nur zwei Arten: der Brief nennt entweder **einen** Vorgang oder eine
 * Menge, die auf einer Seite steht. Ein Ampel-Eimer kommt nicht vor — dessen
 * zwei Zahlen trägt die Hero-Karte darüber, und der Brief wiederholt sie nicht.
 */
export type Sprungziel =
  /** In den Vorgang selbst (`navigate('antraege', { selectedId })`). */
  | { art: 'antrag'; scopeId: string }
  /** Eine andere Seite der App (`navigate(plugin)`). */
  | { art: 'seite'; plugin: string };

export type Segment =
  | { art: 'text'; text: string }
  | { art: 'ziel'; text: string; ziel: Sprungziel };

export interface BriefPunkt {
  themaId: ThemaId;
  /** Für die Maus: Text- und Ziel-Segmente in Lesereihenfolge. */
  segmente: Segment[];
  /** Dieselbe Aussage am Stück — wird `aria-label` der Zeile. */
  satz: string;
  /**
   * Tage bis (positiv) bzw. seit (negativ) Fälligkeit.
   *
   * `null` = **keine Uhr**. Solche Punkte ranken nicht mit, sie landen im
   * Nachsatz: eine gemeinsame Skala über Fristen und Neuigkeiten müsste
   * Gewichte erfinden, die gegen nichts prüfbar wären.
   */
  tage: number | null;
  /** Vorbefüllte Rückfrage für das Assistent-Dock. */
  frage: string;
  /**
   * Der Vorgang, über den dieser Punkt spricht (Verbund-Id, ersatzweise
   * Aktenzeichen). `baueBrief` lässt je Gruppe nur den dringlichsten Punkt in
   * den gerankten Absatz — ein Brief, der denselben Verbund dreimal nennt,
   * fasst nichts zusammen. Fehlt der Schlüssel, spricht der Punkt für sich.
   */
  gruppe?: string;
  /**
   * Die Aussage kommt aus dem **Rückfall** auf die alte Status-Formel, nicht
   * aus der To-do-Kaskade. Die Anzeige sagt das dazu — ein Rückfall, der sich
   * nicht zu erkennen gibt, spricht die widerlegte Formel als wäre sie belegt.
   */
  rueckfall?: boolean;
}

export interface Brief {
  /** Gerankte Uhr-Punkte, überfällig zuerst, auf {@link DECKEL} gekappt. */
  punkte: BriefPunkt[];
  /** Wie viele dringliche Punkte der Deckel weggelassen hat (0 = keine). */
  weitere: number;
  /** Punkte ohne Uhr — zusammen EIN Nachsatz („Außerdem: …"). */
  nachsatz: BriefPunkt[];
  /**
   * Gefüllt, wenn es nichts zu sagen gab: benennt, was geprüft wurde. Leere
   * braucht eine Erklärung — „Nichts zu tun" wäre eine Behauptung.
   */
  leerText: string | null;
  /** Eine Quelle lädt noch (Bestandslauf); der Brief füllt nach. */
  laedt: boolean;
}

/** Persönliche Themenwahl. Fehlt ein Thema, gilt der Katalog-Default. */
export interface TagesbriefWidgetConfig {
  art: 'tagesbrief';
  /** Abgewählte Themen — Abwahl statt Auswahl, damit neue Themen erscheinen. */
  aus: ThemaId[];
}
