/**
 * Suche in den Nachforderungs-Bausteinen für den MAP-Abschluss.
 *
 * Seit v2.309 nur noch eine dünne Schale um den geteilten Bewertungs-Kern
 * (`textbausteine/suche.ts`) — Gewichte, Stoppwörter und Wortzerlegung liegen dort
 * genau einmal, statt in zwei Kopien zu driften. Das Verhalten für die MAP-Aufrufer
 * ist unverändert (Paritäts-Tests in `__tests__/checkliste.test.ts`).
 *
 * Quelle sind weiterhin die Seed-Bausteine `NF_BAUSTEINE`, nicht der kuratierte
 * Katalog: die beiden Aufrufer (`markdown.ts`, `nf-praezision.ts`) sind rein und
 * synchron, der Katalog lädt asynchron. Solange die Verwaltung fehlt, sind beide
 * Stände identisch; die Umstellung gehört in dieselbe Phase wie die Bearbeitbarkeit
 * (siehe `docs/protokoll-artefakt-werkbank.md`).
 *
 * Pitfall #34 gilt unverändert: die Suche **wählt aus**, sie formuliert nicht um und
 * füllt keine Platzhalter.
 */
import { NF_BAUSTEINE, bewerteBausteine, type NfBaustein, type NfScope } from '@/core/services/skills';

export { zerlegeBegriffe } from '@/core/services/skills';

export interface NfTreffer {
  baustein: NfBaustein;
  /** Trefferwert, höher ist besser. */
  punkte: number;
  /** Suchbegriffe, die angeschlagen haben — macht den Vorschlag begründbar. */
  treffer: string[];
}

/**
 * Sucht passende Bausteine zu einer Liste von Begriffen.
 *
 * Bewusst schlicht: ein Wortstamm-Vergleich, kein Ranking-Modell. Der Vorschlag muss
 * nachvollziehbar bleiben — `treffer` nennt die Wörter, die angeschlagen haben,
 * damit erkennbar ist, warum ein Baustein vorgeschlagen wird. Rein.
 */
export function sucheNfBausteine(
  begriffe: readonly string[], scope: NfScope = 'tv', maxTreffer = 3,
): NfTreffer[] {
  return bewerteBausteine(NF_BAUSTEINE.filter(b => b.scope === scope), begriffe, { maxTreffer });
}
