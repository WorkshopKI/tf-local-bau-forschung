/**
 * Welche Modelle die interne KI anbietet — und welche Rolle sie bei uns spielen.
 *
 * **Das ist der einzige Ort, der Modelle beim Namen nennt.** Alles andere in
 * dieser App kennt nur die ROLLE (`KiRolle`). Das ist kein Stilmittel, sondern
 * die Antwort auf ein Betriebsrisiko: die interne KI wird von Kollegen betrieben
 * und tauscht ihre Modelle nach ihrem eigenen Fahrplan. Bis v5 hing der
 * Modellname selbst an 53 Codestellen (`'qwen35'`), und jeder ihrer Wechsel wäre
 * ein Ausfall bei uns gewesen — ausgerechnet bei grossen Anträgen, weil der
 * Auto-Wechsel genau dieses Modell ansteuert.
 *
 * **Drei Schichten, absteigende Autorität:**
 *  1. **Die Seite** — was die interne KI tatsächlich zur Wahl stellt, plus das
 *     abgelesene Kontextfenster. Die Bridge meldet beides
 *     ([bridge-modelle.ts](./bridge-modelle.ts)).
 *  2. **Dieser Katalog** — Rolle und Rückfall-Fenster, solange die Seite noch
 *     nichts gesagt hat.
 *  3. **Nichts** — ein unbekanntes Modell bleibt unbekannt. Es wird nicht
 *     geraten: ein zu gross angesetztes Fenster fällt niemandem auf, weil das
 *     Modell dann still den Anfang des Prompts wegschiebt.
 *
 * **Ein neues Modell = eine Zeile hier.** Kein Typwechsel, keine Migration, kein
 * neues Bookmarklet — das Snippet kennt Modelle gar nicht mehr, es meldet nur die
 * Liste und wählt aus, was diese App ihm nennt.
 */

/**
 * Wofür ein Bearbeiter ein Modell wählt.
 *
 * `'standard'` — das bodenständige Modell: normales Fenster, nicht besonders
 * stark, für die grundlegenden Aufgaben gut genug. Die Voreinstellung, und das,
 * worauf die interne KI selbst ausgeliefert wird.
 *
 * `'stark'` — bewusst OFFEN gehalten: heute heisst das grosses Kontextfenster
 * plus agentische Fähigkeiten, morgen kommt vielleicht etwas hinzu, das wir noch
 * nicht kennen. Deshalb benennt die Rolle den Anspruch und nicht seine
 * momentanen Gründe; welche davon zutreffen, steht am Katalogeintrag.
 */
export type KiRolle = 'standard' | 'stark';

/** Reihenfolge für Oberflächen, die beide Rollen zeigen. */
export const KI_ROLLEN: readonly KiRolle[] = ['standard', 'stark'];

/** Beschriftung der Rolle selbst (nicht des Modells dahinter). */
export const ROLLE_LABEL: Record<KiRolle, string> = {
  standard: 'Standard',
  stark: 'Stark',
};

export interface ModellEintrag {
  /** Stabiler Schlüssel für Tests und Meldungen; nicht persistiert. */
  schluessel: string;
  /**
   * Muster gegen den SICHTBAREN Optionstext (und ersatzweise die `value`).
   *
   * Bewusst nicht gegen die `value` zuerst: die trägt den Dateinamen samt
   * Quantisierung (`Qwen3.6-35B-A3B-UD-Q4_K_M.gguf`) und wandert bei jedem
   * Modell-Update, während der angezeigte Name stehen bleibt.
   */
  muster: RegExp;
  /** Rückfall-Anzeigename — solange die Seite ihren eigenen nicht geliefert hat. */
  label: string;
  /** Welche Rolle dieses Modell bei uns spielt; `null` bei nicht wählbaren. */
  rolle: KiRolle | null;
  /** Rückfall-Kontextfenster in Tokens, bis die Seite es selbst sagt. */
  fensterTokens: number;
  /**
   * Gesetzt = dieses Modell wird NIE gewählt, weder von Hand noch automatisch.
   * Der Text ist der Grund und wird angezeigt.
   */
  nichtWaehlbar?: string;
}

/**
 * Die bekannten Modelle.
 *
 * **Die Reihenfolge ist bedeutsam**: es gewinnt der ERSTE passende Eintrag.
 * Nicht wählbare stehen deshalb oben — sonst fischte eine tolerante Regel ein
 * multimodales `Qwen3.6-VL` in die Rolle `stark`, und die Eskalation liefe in ein
 * kleines Fenster, ohne dass es auffiele.
 */
export const MODELL_KATALOG: readonly ModellEintrag[] = [
  {
    // Muster bewusst generisch: JEDES multimodale Modell fällt hier heraus,
    // solange die Bridge nur Text überträgt — auch ein künftiges.
    schluessel: 'multimodal',
    muster: /multimodal|-vl-|\bvl\b/i,
    label: 'Qwen3-VL-30B (multimodal)',
    rolle: null,
    fensterTokens: 62_000,
    // Kein „taugt nichts", sondern „passt hier nicht": das Modell kann OCR in 32
    // Sprachen und wäre für gescannte Unterlagen interessant. Zwei Gründe sperren
    // es trotzdem — die Bridge überträgt ausschliesslich Text (`message`-Feld des
    // Sende-Formulars), und sein Fenster ist mit 62k das KLEINE. Eine Eskalation
    // dorthin liefe genau in das Fenster, dem sie entkommen soll.
    nichtWaehlbar: 'Bildverstehen (OCR in 32 Sprachen) — diese App überträgt bislang nur Text',
  },
  {
    schluessel: 'gpt-oss-120b',
    muster: /gpt[ _-]?oss/i,
    label: 'gpt-oss-120b',
    rolle: 'standard',
    fensterTokens: 62_000,
  },
  {
    schluessel: 'qwen3.6-35b',
    muster: /qwen\s*3[._]6/i,
    label: 'Qwen3.6-35B',
    rolle: 'stark',
    fensterTokens: 259_000,
  },
];

/** Ein Eintrag der Modell-Auswahlliste, wie ihn die Bridge von der Seite meldet. */
export interface AngebotenesModell {
  /** Sichtbarer Optionstext — zugleich der Schlüssel, mit dem wir auswählen. */
  text: string;
  /** `value` der Option (Dateiname); nur als zweites Muster-Ziel. */
  value?: string;
  /** Steht diese Option gerade auf der Seite ausgewählt? */
  aktiv?: boolean;
}

/**
 * Katalogeintrag zu einem Optionstext — `null`, wenn wir das Modell nicht kennen.
 *
 * Unbekannt ist ein gültiger Zustand, kein Fehler: die interne KI darf jederzeit
 * etwas Neues anbieten. Was dann passiert, entscheidet `loeseRolleAuf`.
 */
export function ordneZu(text: string, value?: string): ModellEintrag | null {
  const t = String(text || '');
  const v = String(value || '');
  if (!t && !v) return null;
  for (const e of MODELL_KATALOG) {
    if ((t && e.muster.test(t)) || (v && e.muster.test(v))) return e;
  }
  return null;
}

/** Wie die Rolle zu ihrem Modell kam — trägt die Erklärung in der Oberfläche. */
export type Aufloesungsart =
  /** Ein Katalogmodell dieser Rolle steht zur Wahl. Der Normalfall. */
  | 'katalog'
  /** Kein Katalogmodell dieser Rolle — das weiteste bekannte Fenster übernimmt. */
  | 'weitestesFenster'
  /** Kein Katalogmodell — die Voreinstellung der internen KI übernimmt. */
  | 'voreinstellung'
  /** Die Liste ist (noch) unbekannt — die Bridge fasst die Auswahl nicht an. */
  | 'unbekannt';

export interface ModellAufloesung {
  /**
   * Der Optionstext, den die Bridge auswählen soll. **Leer = nicht anfassen.**
   *
   * Bewusst der Text und kein Index: eine Liste kann sich zwischen dem Melden und
   * dem Auftrag geändert haben, und ein verschobener Index wählt dann still das
   * falsche Modell. Ein Text, den es nicht mehr gibt, ist dagegen ein sauberer
   * Fehlschlag.
   */
  text: string;
  /** Katalogeintrag, falls bekannt. */
  eintrag: ModellEintrag | null;
  /** Anzeigename — bevorzugt der Text der Seite, sonst das Katalog-Label. */
  label: string;
  /** Kontextfenster in Tokens; `null` = unbekannt (NICHT raten, siehe Kopf). */
  fensterTokens: number | null;
  art: Aufloesungsart;
}

/** Nachschlagen eines gelernten Fensters; `null` = noch nie gesehen. */
export type FensterNachschlag = (text: string) => number | null;

function fensterVon(
  m: AngebotenesModell,
  eintrag: ModellEintrag | null,
  gelernt: FensterNachschlag,
): number | null {
  // Gelernt schlägt Katalog: die Seite weiss es, wir hatten es nur angenommen.
  // Genau hier ist die Drift aufgetreten, die den Umbau ausgelöst hat (262k im
  // Code gegen 259k in der Anzeige).
  const g = gelernt(m.text);
  if (g && g > 0) return g;
  return eintrag ? eintrag.fensterTokens : null;
}

/**
 * Welches der angebotenen Modelle übernimmt die Rolle?
 *
 * Drei Stufen, absteigend — und **keine davon braucht den Katalog**. Das ist der
 * Punkt: fällt diese Datei aus der Zeit, lösen sich beide Rollen weiter richtig
 * auf, weil sie an beobachtbaren Eigenschaften hängen und nicht an gepflegtem
 * Wissen.
 *
 *  1. Ein Katalogmodell mit genau dieser Rolle steht zur Wahl → das erste in der
 *     Reihenfolge der Seite.
 *  2. Für `'stark'` ersatzweise das Modell mit dem WEITESTEN bekannten Fenster.
 *     Die Selbstheilung: bietet die interne KI morgen `Qwen4` an, kennt der
 *     Katalog es nicht — aber nach dem ersten Lauf ist sein Fenster abgelesen,
 *     und ab da trägt es die Rolle.
 *  3. Sonst die **Voreinstellung der internen KI** — das ausgewählte, sonst das
 *     erste Modell der Liste. Für `'standard'` ist das nicht nur ein Notnagel,
 *     sondern die eigentlich richtige Antwort: welches Modell das verlässliche
 *     ist, entscheiden die Betreiber der internen KI mit ihrer eigenen
 *     Reihenfolge, und die ist immer aktueller als unsere Liste.
 *
 * Es wird **ausdrücklich gewählt** und nicht „nicht angefasst": was zuletzt jemand
 * eingestellt hat, lebt in der serverseitigen Sitzung weiter (siehe die Begründung
 * an `aktivesZielFuerLauf`). Nur wenn gar keine Liste vorliegt, bleibt die Auswahl
 * unberührt — dann wissen wir nicht einmal, wovon wir abweichen würden.
 *
 * Nicht wählbare Modelle (multimodal) sind in JEDER Stufe ausgeschlossen.
 */
export function loeseRolleAuf(
  rolle: KiRolle,
  angeboten: readonly AngebotenesModell[],
  gelernt: FensterNachschlag = () => null,
): ModellAufloesung {
  // Noch nie verbunden: es gibt keine Liste, aus der zu wählen wäre. Der Katalog
  // liefert dann Name und Fenster — `text` bleibt leer, weil wir keine Option
  // benennen können, die wir nie gesehen haben.
  const ausKatalog = MODELL_KATALOG.find(e => e.rolle === rolle && !e.nichtWaehlbar) ?? null;
  const leer: ModellAufloesung = {
    text: '',
    eintrag: ausKatalog,
    label: ausKatalog?.label ?? ROLLE_LABEL[rolle],
    fensterTokens: ausKatalog?.fensterTokens ?? null,
    art: 'unbekannt',
  };
  if (!angeboten.length) return leer;

  const bewertet = angeboten.map(m => {
    const eintrag = ordneZu(m.text, m.value);
    return { m, eintrag, fenster: fensterVon(m, eintrag, gelernt) };
  }).filter(x => !x.eintrag?.nichtWaehlbar);

  if (!bewertet.length) return leer;

  const treffer = bewertet.find(x => x.eintrag?.rolle === rolle);
  if (treffer) {
    return {
      text: treffer.m.text,
      eintrag: treffer.eintrag,
      label: treffer.m.text || treffer.eintrag?.label || ROLLE_LABEL[rolle],
      fensterTokens: treffer.fenster,
      art: 'katalog',
    };
  }

  if (rolle === 'stark') {
    const mitFenster = bewertet.filter(x => x.fenster !== null);
    if (mitFenster.length) {
      const weitest = mitFenster.reduce((a, b) => ((b.fenster ?? 0) > (a.fenster ?? 0) ? b : a));
      return {
        text: weitest.m.text,
        eintrag: weitest.eintrag,
        label: weitest.m.text || ROLLE_LABEL[rolle],
        fensterTokens: weitest.fenster,
        art: 'weitestesFenster',
      };
    }
  }

  // Die Voreinstellung der internen KI. `bewertet[0]` ist sicher vorhanden (oben
  // auf Länge geprüft), aber `noUncheckedIndexedAccess` verlangt den Nachweis.
  const vor = bewertet.find(x => x.m.aktiv) ?? bewertet[0];
  if (!vor) return leer;
  return {
    text: vor.m.text,
    eintrag: vor.eintrag,
    label: vor.m.text || vor.eintrag?.label || ROLLE_LABEL[rolle],
    fensterTokens: vor.fenster,
    art: 'voreinstellung',
  };
}

/**
 * Fenster, mit dem gerechnet wird, solange über das Modell **nichts** bekannt ist.
 *
 * Bewusst das kleine: eine zu klein angesetzte Grenze kürzt sichtbar und lässt
 * sich beheben, eine zu grosse überläuft still — das Modell schiebt dann den
 * Anfang des Prompts heraus, und niemand sieht es dem Ergebnis an.
 */
export const VORSICHTS_FENSTER = 62_000;

/**
 * Rückfall-Fenster einer Rolle aus dem Katalog — für den Zustand „noch nie
 * verbunden, also auch keine Auswahlliste gesehen".
 */
export function rueckfallFenster(rolle: KiRolle): number {
  const e = MODELL_KATALOG.find(x => x.rolle === rolle && !x.nichtWaehlbar);
  return e ? e.fensterTokens : VORSICHTS_FENSTER;
}

/**
 * Angebotene Modelle, die dieser Katalog nicht kennt — für die Drift-Anzeige in
 * den Einstellungen.
 *
 * Sichtbar zu machen, was wir nicht einordnen können, ist der halbe Zweck des
 * Umbaus: bis v5 fiel ein Modellwechsel der internen KI erst auf, wenn ein Lauf
 * scheiterte, und das mitten in einer Aufbereitung.
 */
export function unbekannteModelle(angeboten: readonly AngebotenesModell[]): string[] {
  return angeboten.filter(m => !ordneZu(m.text, m.value)).map(m => m.text).filter(Boolean);
}
