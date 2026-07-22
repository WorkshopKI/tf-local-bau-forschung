/**
 * Skill-eigene Vorgaben (Umfang & Form) → Laufzeit.
 *
 * Die Vorgaben eines Skills werden hier als synthetische `QualitaetsRegel`-Records
 * MATERIALISIERT. Das ist der ganze Trick der Umstellung: `resolveRegeln` ist die
 * einzige Stelle, an der aus Skill + Registry eine Regelliste wird — hängen die
 * Vorgaben dort mit den bekannten `typ`-Werten an, bleiben Check-Engine,
 * `buildPromptVorgaben`, `effektiveKategorie`, Judge, Eval und Batch unverändert.
 *
 * Drei Invarianten:
 *  1. **Stabile IDs** `vorgabe:<skillId>:<typ>` — Checks/Runs referenzieren sie
 *     wie echte Regel-IDs; sie kollidieren nicht mit Bibliotheks-IDs.
 *  2. **Feste Reihenfolge** (`VORGABE_KEYS`) — die Reihenfolge landet als
 *     Zeilenfolge im `## Formale Vorgaben`-Prompt-Block, ist also Prompt-Text und
 *     per Test festgeschrieben.
 *  3. **Der persönliche Override greift nur, wo der Kurator ihn freigegeben hat**
 *     (`persoenlichAnpassbar`) — er kann eine Vorgabe verschieben, nie abschalten
 *     und nie ihren Schweregrad ändern.
 *
 * Reine Funktionen — kein IO, kein React.
 */
import type {
  PersoenlicheVorgaben,
  QualitaetsRegel,
  SkillRecord,
  SkillVorgaben,
  VorgabeKey,
} from './types';

/** Präfix aller synthetischen Vorgabe-Regel-IDs. */
export const VORGABE_ID_PREFIX = 'vorgabe:';

/** True, wenn die ID eine materialisierte Vorgabe bezeichnet (kein Bibliotheks-Record). */
export function istVorgabeRegel(regelId: string): boolean {
  return regelId.startsWith(VORGABE_ID_PREFIX);
}

/**
 * Stabile Reihenfolge der Vorgaben — bestimmt die Zeilenfolge im Prompt-Block
 * „Formale Vorgaben" und die Zeilenfolge im Editor. Append-only erweitern.
 */
export const VORGABE_KEYS: readonly VorgabeKey[] = [
  'wortanzahl',
  'satzanzahl',
  'zeichenMax',
  'absatzMin',
  'satzlaengeMax',
  'keineAufzaehlungen',
  'pflichtAnfang',
];

/** Regel-`typ` je Vorgabe (die Check-Engine kennt genau diese Typen). */
export const VORGABE_TYP: Record<VorgabeKey, string> = {
  wortanzahl: 'wortanzahl',
  satzanzahl: 'satzanzahl',
  zeichenMax: 'zeichen_max',
  absatzMin: 'absatz_min',
  satzlaengeMax: 'satzlaenge_max',
  keineAufzaehlungen: 'keine_aufzaehlungen',
  pflichtAnfang: 'pflicht_anfang',
};

/** Anzeige-Name der materialisierten Regel (Checkliste, Testlauf, Befund-Labels). */
export const VORGABE_NAME: Record<VorgabeKey, string> = {
  wortanzahl: 'Wortanzahl',
  satzanzahl: 'Satzanzahl',
  zeichenMax: 'Zeichenlimit',
  absatzMin: 'Absätze',
  satzlaengeMax: 'Satzlänge',
  keineAufzaehlungen: 'Keine Aufzählungen',
  pflichtAnfang: 'Pflicht-Anfang',
};

/** Regel-`params` einer einzelnen Vorgabe (leere Werte werden ausgelassen). */
function paramsFuer(key: VorgabeKey, v: SkillVorgaben[VorgabeKey]): Record<string, unknown> {
  const any = v as unknown as Record<string, unknown>;
  switch (key) {
    case 'wortanzahl':
    case 'satzanzahl': {
      const p: Record<string, unknown> = {};
      if (typeof any.min === 'number') p.min = any.min;
      if (typeof any.max === 'number') p.max = any.max;
      return p;
    }
    case 'zeichenMax':
      return { max: any.max };
    case 'absatzMin':
      return { min: any.min };
    case 'satzlaengeMax':
      return { maxWoerter: any.maxWoerter };
    case 'pflichtAnfang':
      return { text: any.text };
    case 'keineAufzaehlungen':
    default:
      return {};
  }
}

/**
 * Materialisiert die Vorgaben eines Skills als synthetische Regeln (in
 * `VORGABE_KEYS`-Reihenfolge). `stand` ist der ISO-Zeitstempel des Skills — die
 * synthetischen Records tragen ihn als `erstellt_am`/`geaendert_am`, damit sie
 * strukturell vollwertige `QualitaetsRegel` sind.
 *
 * Vorgaben sind IMMER aktiv: das An/Aus liegt in der Existenz des Feldes, nicht
 * in einem zweiten Schalter (eine ausgeschaltete Vorgabe ist eine gelöschte).
 */
export function vorgabenZuRegeln(
  skillId: string,
  vorgaben: SkillVorgaben | undefined,
  stand: string,
): QualitaetsRegel[] {
  if (!vorgaben) return [];
  const out: QualitaetsRegel[] = [];
  for (const key of VORGABE_KEYS) {
    const v = vorgaben[key];
    if (!v) continue;
    out.push({
      id: `${VORGABE_ID_PREFIX}${skillId}:${VORGABE_TYP[key]}`,
      name: VORGABE_NAME[key],
      typ: VORGABE_TYP[key],
      params: paramsFuer(key, v),
      schweregrad: v.schweregrad,
      aktiv: true,
      erstellt_am: stand,
      geaendert_am: stand,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Persönlicher Override                                                       */
/* -------------------------------------------------------------------------- */

/** Vorgaben, die überhaupt persönlich verschiebbar sind (Zahlenwerte). */
const OVERRIDE_KEYS: readonly VorgabeKey[] = [
  'wortanzahl', 'satzanzahl', 'zeichenMax', 'absatzMin', 'satzlaengeMax',
];

/** True, wenn diese Vorgabe grundsätzlich einen persönlichen Wert tragen kann. */
export function istUeberschreibbar(key: VorgabeKey): boolean {
  return OVERRIDE_KEYS.includes(key);
}

/**
 * Legt den persönlichen Override über die Team-Vorgaben. Übernommen wird ein Wert
 * NUR, wenn die Team-Vorgabe existiert UND vom Kurator als `persoenlichAnpassbar`
 * markiert ist — Schweregrad und Freigabe-Flag bleiben in jedem Fall der
 * Team-Stand. Ohne Override (oder ohne Freigaben) ist das Ergebnis identisch zu
 * `vorgaben`.
 */
export function wendeOverrideAn(
  vorgaben: SkillVorgaben | undefined,
  override: PersoenlicheVorgaben | undefined,
): SkillVorgaben | undefined {
  if (!vorgaben || !override) return vorgaben;
  let geaendert = false;
  const next: SkillVorgaben = { ...vorgaben };
  for (const key of OVERRIDE_KEYS) {
    const team = vorgaben[key];
    const eigen = override[key as keyof PersoenlicheVorgaben];
    if (!team || !team.persoenlichAnpassbar || !eigen) continue;
    // Werte des Overrides gewinnen, Schweregrad + Freigabe bleiben Team-Stand.
    (next[key] as unknown) = { ...team, ...eigen, schweregrad: team.schweregrad, persoenlichAnpassbar: true };
    geaendert = true;
  }
  return geaendert ? next : vorgaben;
}

/**
 * Ersetzt in einer bereits aufgelösten Regelliste nur die synthetischen
 * Vorgabe-Einträge durch die Override-Variante — für die Lauf-Aufrufer, die ihre
 * Regeln aus einer zuvor gebauten Skill-Map beziehen (Gutachten-Workflow, Batch,
 * Kurzfassung) und den Tweak erst beim Lauf kennen. Bibliotheks-Regeln bleiben
 * unangetastet, die Reihenfolge bleibt erhalten. Ohne Override ein No-op.
 */
export function regelnMitOverride(
  skill: SkillRecord,
  regeln: QualitaetsRegel[],
  override: PersoenlicheVorgaben | undefined,
): QualitaetsRegel[] {
  if (!override || !skill.vorgaben) return regeln;
  const effektiv = wendeOverrideAn(skill.vorgaben, override);
  if (effektiv === skill.vorgaben) return regeln;
  const ersatz = new Map(
    vorgabenZuRegeln(skill.id, effektiv, skill.geaendert_am).map(r => [r.id, r]),
  );
  return regeln.map(r => ersatz.get(r.id) ?? r);
}
