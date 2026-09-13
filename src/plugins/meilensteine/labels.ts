/**
 * Anzeige-Texte und -Stile des Meilenstein-Moduls. Farben ausschließlich über
 * `--tf-*`-Tokens (Guard `theme-token-contract`).
 */
import { parseGermanDate, formatGermanDate } from '@/core/services/csv/dateParse';
import { fristTageWort } from '@/core/utils/uhrWorte';
import { ANKER_SPALTEN, einzeiligesLabel } from '@/core/meilensteine';
import type {
  MstZustand, Prognose, SpaltenEintrag, VerbundMeilensteine,
} from '@/core/meilensteine';
import type { AntragstypBucket } from '@/core/utils/vb-phase-mappings';

export const ZUSTAND_LABEL: Record<MstZustand, string> = {
  erreicht: 'Erreicht',
  offen: 'Offen',
  faellig: 'Fällig',
  gerissen: 'Gerissen',
  nichtRelevant: 'Nicht relevant',
  // Kein Urteil über den Vorgang, sondern über den Plan (v4.134): der Knoten
  // trägt keine auswertbare Bedingung. „Ohne Bedingung" statt „Nicht bewertbar",
  // weil das Wort sagt, WAS zu tun ist — eine Bedingung nachtragen.
  ohneBedingung: 'Ohne Bedingung',
};

/**
 * **Marken-Farbe** je Zustand — Punkte, Ringe, Verzugs-Strecken.
 *
 * `offen` und `nichtRelevant` tragen bewusst Rahmen-Tokens: als 8px-Ring auf dem
 * Hintergrund sind sie „da, aber still". Für **Text** taugen sie nicht (siehe
 * `ZUSTAND_TEXT_FARBE`).
 */
export const ZUSTAND_FARBE: Record<MstZustand, string> = {
  erreicht: 'var(--tf-success-text)',
  offen: 'var(--tf-border-hover)',
  faellig: 'var(--tf-warning-text)',
  gerissen: 'var(--tf-danger-text)',
  nichtRelevant: 'var(--tf-border)',
  // Still wie `nichtRelevant`, aber unterscheidbar: hier fehlt etwas, dort gilt
  // etwas nicht. Der Unterschied steht im Wort, nicht in zwei Grautoenen.
  ohneBedingung: 'var(--tf-border-hover)',
};

/**
 * **Textfarbe** je Zustand — für beschriftete Zustands-Spalten.
 *
 * Getrennt von `ZUSTAND_FARBE`, weil Rahmen-Tokens als Schrift unlesbar sind:
 * gemessen (Alpha gegen `--tf-bg` verrechnet) kam `offen` auf 1,41:1 und
 * `nichtRelevant` auf 1,20:1 — AA verlangt 4,5:1. Bei einem Verbund, für den
 * kein Meilenstein gilt, wirkte die ganze Spalte leer.
 *
 * Die beiden stillen Zustände tragen `--tf-text-secondary` (gemessen 5,33:1);
 * `--tf-text-tertiary` läge mit 2,61:1 weiter unter AA. Unterschieden werden sie
 * durch das **Wort**, nicht durch zwei Grautöne, die niemand benennen kann —
 * zurückgenommen ist die Zeile eines nicht relevanten Meilensteins ohnehin
 * bereits an ihrer Beschriftung.
 */
export const ZUSTAND_TEXT_FARBE: Record<MstZustand, string> = {
  erreicht: 'var(--tf-success-text)',
  offen: 'var(--tf-text-secondary)',
  faellig: 'var(--tf-warning-text)',
  gerissen: 'var(--tf-danger-text)',
  nichtRelevant: 'var(--tf-text-secondary)',
  ohneBedingung: 'var(--tf-text-secondary)',
};

/**
 * Die Prognose als Wort für **Filter-Chips und Verteilungen** — eine Menge, kein
 * einzelner Verbund. Am einzelnen Verbund steht {@link prognoseText}: dort trennt
 * sich „nicht zu halten" in „über der Frist" (schon passiert) und „Frist nicht
 * mehr zu halten" (Vorhersage).
 */
export const PROGNOSE_LABEL: Record<Prognose, string> = {
  imPlan: 'Im Plan',
  gefaehrdet: 'Gefährdet',
  nichtHaltbar: 'Frist nicht zu halten',
  // Seit v6.66: die Uhr steht (Entscheidung, bewilligt vor dem VN) — dasselbe
  // Wort wie in der Frist-Spalte, statt „überfällig" einer zweiten Plan-Uhr.
  angehalten: 'Frist angehalten',
  abgeschlossen: 'Abgeschlossen',
  unbekannt: 'Unbekannt',
};

export const PROGNOSE_FARBE: Record<Prognose, string> = {
  imPlan: 'var(--tf-success-text)',
  gefaehrdet: 'var(--tf-warning-text)',
  nichtHaltbar: 'var(--tf-danger-text)',
  angehalten: 'var(--tf-text-tertiary)',
  abgeschlossen: 'var(--tf-text-tertiary)',
  unbekannt: 'var(--tf-text-tertiary)',
};

/**
 * Die Prognose eines **einzelnen** Verbunds. „Nicht haltbar" hat zwei Ursachen,
 * die sich verschieden anfühlen: die Frist ist schon überschritten, oder der
 * größte Verzug trägt das Plan-Ende über die Frist. Beides „Frist nicht haltbar"
 * zu nennen, las sich bei einer längst gerissenen Frist wie eine Vorhersage.
 */
export function prognoseText(b: Pick<VerbundMeilensteine, 'prognose' | 'restTage'>): string {
  if (b.prognose === 'nichtHaltbar') {
    return b.restTage !== null && b.restTage < 0 ? 'Über der Frist' : 'Frist nicht mehr zu halten';
  }
  return PROGNOSE_LABEL[b.prognose];
}

/**
 * Erklärt einen Ist-Termin **vor** Woche 0.
 *
 * Auf der Achse gibt es keine Woche vor dem Eingang — die Zahl entsteht, weil
 * der Anker der SPÄTESTE wirksame Eingang aller Teilvorhaben ist (Antragseingang
 * oder „alle Anträge da", das spätere), das Ist-Datum aber aus einem Feld kommt,
 * das früher datiert (etwa dem frühesten Antragsdatum). Der Wert wird darum
 * markiert statt versteckt oder geglättet.
 */
export const VOR_EINGANG_HINWEIS =
  'Ist-Termin liegt vor dem Eingang: der Anker ist der späteste wirksame Eingang des Verbunds '
  + '(Antragseingang oder „alle Anträge da", das spätere), das Ist-Datum stammt aus einem Feld, '
  + 'das früher datiert.';

/**
 * Was „Eingang" auf dieser Seite meint — derselbe Satz an jeder Stelle, die das
 * Anker-Datum zeigt. Die Codes kommen aus `ANKER_SPALTEN`, also aus derselben
 * Konstante, die die Rechnung liest.
 */
export const ANKER_ERKLAERUNG: string =
  `Wirksamer Eingang: das spätere aus ${ANKER_SPALTEN.antragseingang} (Antragseingang) und `
  + `${ANKER_SPALTEN.alleAntraegeDa} („alle Anträge da"), über die Teilvorhaben das späteste. `
  + 'Soll-Termine, Bearbeitungswoche und Gesamtfrist zählen ab hier.';

/** Reihenfolge für Filter-Leisten und Verteilungs-Anzeigen. */
export const PROGNOSE_REIHENFOLGE: readonly Prognose[] = [
  'nichtHaltbar', 'gefaehrdet', 'imPlan', 'angehalten', 'abgeschlossen', 'unbekannt',
];

export const OPERATOR_LABEL: Record<string, string> = {
  ist: 'ist',
  istNicht: 'ist nicht',
  gefuellt: 'ist gefüllt',
  leer: 'ist leer',
  datumVor: 'liegt vor',
  datumNach: 'liegt nach',
  // Vorgangssystem (To-do-Regeln); der Editor ist domänenfrei und zeigt sie
  // deshalb auch an einem Meilenstein-Plan, falls dort einer auftaucht.
  tageSeit: 'liegt länger zurück als',
  datumNachFeld: 'liegt nach dem Datum von',
  foerdervarianteIn: 'Fördervariante ist eine von',
};

export const TYP_LABEL: Record<AntragstypBucket, string> = {
  FuE: 'FuE', DS: 'DS', DL: 'DL', NW: 'NW',
};

/** Einheitliche 0,5px-Umrandung wie im Status-Cockpit. */
export const feldStil: React.CSSProperties = {
  border: '0.5px solid var(--tf-border)',
  background: 'var(--tf-bg)',
};

/**
 * Der Namens-Auflöser für den EINEN Bedingungs-Formatierer
 * ([bedingung-text.ts](../../core/status/bedingung-text.ts)).
 *
 * Der erwartet entweder eine Katalog-Fassung oder genau diese Funktion. Der
 * Meilenstein-Plan hat keine Fassung, sondern einen Spalten-Katalog — deshalb
 * hier die Brücke, statt eines zweiten Formatierers, der beim ersten neuen
 * Operator still auseinanderliefe.
 */
export function spaltenLabel(
  spalten: readonly SpaltenEintrag[],
): (feldId: string) => string {
  // `einzeiligesLabel`, weil die Label-XLS echte Umbrüche in ihren Überschriften
  // trägt („Antrags\r\neingang") — in einem Satz zerrissen die die Zeile.
  const index = new Map(spalten.map(s => [s.feldId, einzeiligesLabel(s.label)]));
  return feldId => index.get(feldId) || feldId;
}

/**
 * ISO → `DD.MM.YYYY`; leer/unlesbar → `—`.
 *
 * Über die zentrale Kette statt `toLocaleDateString`: die liefert **ohne
 * führende Null** (`1.9.2025`), und der Meilenstein-Streifen steht auf der
 * Verbund-Detailseite direkt neben Panels, die `01.09.2025` schreiben.
 */
export function formatDatum(iso: string | null | undefined): string {
  const tag = iso ? parseGermanDate(iso) : null;
  return tag ? formatGermanDate(tag) : '—';
}

/**
 * Die Frist-Angabe eines Verbunds im Kopf der Detail-Ansicht — dieselbe
 * Bearbeitungsfrist und dasselbe Wort wie in der Frist-Spalte (v6.66).
 *
 * Bei `unbekannt` steht **keine Tageszahl**: dann gilt kein Meilenstein des
 * Plans für diesen Verbund, und die Zahl läse sich als vom Plan geprüfte Frist
 * („noch 7 Tage" neben lauter „Nicht relevant").
 */
export function restzeitText(
  b: Pick<VerbundMeilensteine, 'restTage' | 'prognose' | 'fristZustand'>,
): string {
  if (b.fristZustand === 'angehalten') return 'Frist angehalten';
  if (b.restTage === null) return 'Frist nicht berechenbar';
  if (b.prognose === 'unbekannt') return 'Frist rechnerisch — kein Meilenstein belegt sie';
  return fristTageWort(b.restTage, 'lang');
}

/** „+3 Tage" / „−12 Tage" / „pünktlich". */
export function formatAbweichung(tage: number | null): string {
  if (tage === null) return '—';
  if (tage === 0) return 'pünktlich';
  return tage > 0 ? `+${tage} Tage` : `${tage} Tage`;
}
