/**
 * Auto-Discovery: unbekannte Statuswerte werden beim Import als `unkuratiert`
 * gesammelt — **nie** stillschweigend einer Kategorie zugeordnet.
 *
 * Reine Kernfunktion `ermittleNeueUnkuratierte` (deterministisch, testbar); die
 * Store-Integration liegt in `import-integration.ts`.
 */
import type { MappingVersion, UnkuratierterFund } from './typen';
import { wertId } from './typen';

export interface BeobachteterWert {
  feldId: string;
  wert: string;
}

/**
 * Welche beobachteten (Feld,Wert) fehlen sowohl im aktiven Katalog als auch im
 * bestehenden Unkuratiert-Puffer? Nur Werte kuratierter **Wert-Felder** zählen
 * (Datumsfelder haben kein Enum). Deterministisch: stabile Eingangsordnung →
 * stabile Ausgangsordnung, dedupliziert per `wertId`. `erstmalsGesehen` stempelt
 * der Aufrufer (Testbarkeit).
 */
export function ermittleNeueUnkuratierte(
  version: MappingVersion,
  bestehend: readonly UnkuratierterFund[],
  beobachtet: readonly BeobachteterWert[],
  erstmalsGesehen: string,
): UnkuratierterFund[] {
  const wertFelder = new Set(
    version.felder.filter(f => f.typ === 'wert').map(f => f.feldId),
  );
  const bekannt = new Set<string>();
  for (const w of version.werte) bekannt.add(w.id);
  for (const u of bestehend) bekannt.add(u.id);

  const neu: UnkuratierterFund[] = [];
  const gesehen = new Set<string>();
  for (const b of beobachtet) {
    if (!wertFelder.has(b.feldId)) continue;
    const wert = (b.wert ?? '').trim();
    if (!wert) continue;
    const id = wertId(b.feldId, wert);
    if (bekannt.has(id) || gesehen.has(id)) continue;
    gesehen.add(id);
    neu.push({ id, feldId: b.feldId, wert, erstmalsGesehen });
  }
  return neu;
}

/**
 * Entfernt Funde, die im aktiven Katalog inzwischen kuratiert sind. Nötig, seit
 * der Katalog vom Daten-Share kommt: kuratiert die PL einen Wert auf ihrem
 * Rechner, bleibt er im Unkuratiert-Puffer aller anderen Geräte stehen und würde
 * dort dauerhaft als „neu entdeckt" gemeldet. Rein.
 */
export function pruneKuratierte(
  version: MappingVersion, bestand: readonly UnkuratierterFund[],
): UnkuratierterFund[] {
  const kuratiert = new Set(version.werte.map(w => w.id));
  return bestand.filter(u => !kuratiert.has(u.id));
}
