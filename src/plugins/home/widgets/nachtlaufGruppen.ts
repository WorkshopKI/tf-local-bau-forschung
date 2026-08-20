/**
 * Anzeige-Modell von „Änderungen der letzten Nacht" — rein, ohne IO und React.
 *
 * **Gruppiert wird nach ANTRAG, nicht nach Feld** (v4.134). Die Feld-Gruppierung
 * beantwortete eine Frage über den ganzen Bestand („216× D_ANT geändert") und
 * ließ genau die offen, mit der ein Arbeitstag anfängt: *ist an meinen Vorgängen
 * etwas passiert?* Am echten Bestand sind das je Nacht 7–69 Einträge auf 3–18
 * Anträgen (gemessen über fünf Läufe im August 2026, 195–525 Einträge gesamt) —
 * eine Liste, die man liest, statt sie zu überfliegen.
 *
 * **Weiterhin keine Personen-Achse** (Pitfall #48). Das Journal führt keine
 * Bearbeiter-Kürzel, und keine Zeile hier sagt, WER etwas gesetzt hat — sie sagt,
 * WAS sich an WELCHEM Vorgang geändert hat. Der Bearbeiter-Ausschnitt des
 * Widgets wählt Anträge aus (dieselbe Sicht wie Startseite und Liste), er
 * erzeugt keine Aussage über Personen.
 */
import type { JournalEintrag } from '@/core/status';

/** Wortlaut je Eintragsart — geteilt von Zeile und Zähler. */
export const ART_TEXT: Record<JournalEintrag['art'], string> = {
  gesetzt: 'gesetzt',
  geaendert: 'geändert',
  geleert: 'zurückgenommen',
  'antrag-neu': 'neu im Export',
  'antrag-fehlt': 'nicht mehr im Export',
};

/** Reihenfolge der Arten in einer Zeile — die einschneidendste zuerst. */
const ART_FOLGE: ReadonlyArray<JournalEintrag['art']> = [
  'antrag-neu', 'antrag-fehlt', 'gesetzt', 'geaendert', 'geleert',
];

/** Eine Zeile: ein Antrag mit dem, was sich an ihm geändert hat. */
export interface NachtlaufZeile {
  antragId: string;
  /** Akronym, sonst das Aktenzeichen. */
  label: string;
  /** Zahl der Einträge dieses Antrags in diesem Lauf. */
  anzahl: number;
  /** „D_AB, D_ABB gesetzt · STATUS_TV geändert" — gekappt, s. `MAX_FELDER`. */
  text: string;
  /** Mindestens ein Eintrag ist nur als Zeitraum belegt (Wochenende, Ausfall). */
  unscharf: boolean;
}

/** Wie viele Feldnamen je Art in einer Zeile stehen, bevor „+N" übernimmt. */
const MAX_FELDER = 3;

function artText(art: JournalEintrag['art'], felder: string[]): string {
  if (felder.length === 0) return ART_TEXT[art];
  const gezeigt = felder.slice(0, MAX_FELDER).join(', ');
  const rest = felder.length - MAX_FELDER;
  return `${gezeigt}${rest > 0 ? ` +${rest}` : ''} ${ART_TEXT[art]}`;
}

/**
 * Einträge → eine Zeile je Antrag, die änderungsreichsten zuerst.
 *
 * `label` löst das Aktenzeichen auf (Akronym aus dem Antrags-Store); ein
 * unbekannter Antrag behält sein Aktenzeichen, statt aus der Liste zu fallen —
 * „nicht mehr im Export" ist genau der Fall, der sonst unsichtbar würde.
 */
export function gruppiereNachAntrag(
  eintraege: readonly JournalEintrag[],
  label: (antragId: string) => string | undefined,
): NachtlaufZeile[] {
  const proAntrag = new Map<string, JournalEintrag[]>();
  for (const e of eintraege) {
    const liste = proAntrag.get(e.antragId);
    if (liste) liste.push(e); else proAntrag.set(e.antragId, [e]);
  }
  const zeilen: NachtlaufZeile[] = [];
  for (const [antragId, eigene] of proAntrag) {
    const proArt = new Map<JournalEintrag['art'], string[]>();
    for (const e of eigene) {
      const felder = proArt.get(e.art);
      const feld = e.feld ?? null;
      if (felder) { if (feld) felder.push(feld); } else proArt.set(e.art, feld ? [feld] : []);
    }
    const teile: string[] = [];
    for (const art of ART_FOLGE) {
      const felder = proArt.get(art);
      if (felder) teile.push(artText(art, felder));
    }
    zeilen.push({
      antragId,
      label: label(antragId)?.trim() || antragId,
      anzahl: eigene.length,
      text: teile.join(' · '),
      unscharf: eigene.some(e => e.unscharf === true),
    });
  }
  zeilen.sort((a, b) => b.anzahl - a.anzahl || a.label.localeCompare(b.label, 'de'));
  return eindeutigeLabel(zeilen);
}

/**
 * Zwei Teilvorhaben eines Verbunds tragen DASSELBE Akronym.
 *
 * Ungehindert stehen dann zwei Zeilen mit identischer Beschriftung
 * untereinander, und die Liste sieht aus, als zeige sie etwas doppelt
 * (gemessen: „LADScessible" zweimal, in Wahrheit 16KN110645 und 16KN110646).
 * Zusammenfassen wäre falsch — die Änderungen betreffen verschiedene Anträge —,
 * also bekommt das Akronym sein Aktenzeichen dazu, **nur wo es mehrdeutig ist**.
 */
function eindeutigeLabel(zeilen: NachtlaufZeile[]): NachtlaufZeile[] {
  const proLabel = new Map<string, number>();
  for (const z of zeilen) proLabel.set(z.label, (proLabel.get(z.label) ?? 0) + 1);
  return zeilen.map(z => ((proLabel.get(z.label) ?? 0) > 1 && z.label !== z.antragId
    ? { ...z, label: `${z.label} · ${z.antragId}` }
    : z));
}

/** „7 Änderungen an 3 Anträgen" — der Zähler der Kopfzeile. */
export function nachtlaufBilanz(zeilen: readonly NachtlaufZeile[]): string {
  const eintraege = zeilen.reduce((n, z) => n + z.anzahl, 0);
  if (eintraege === 0) return '0';
  const a = `${eintraege.toLocaleString('de-DE')} ${eintraege === 1 ? 'Änderung' : 'Änderungen'}`;
  const b = `${zeilen.length.toLocaleString('de-DE')} ${zeilen.length === 1 ? 'Vorgang' : 'Vorgängen'}`;
  return `${a} an ${b}`;
}
