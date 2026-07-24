/**
 * Überführung des Code-Seeds `nf-bausteine.seed.ts` in den Katalog.
 *
 * Bis v2.308 waren die 78 NF-Bausteine hartkodierter Code — pflegbar nur durch einen
 * Entwickler. Sie werden hier zu App-Daten, **ohne** dass der Seed verschwindet: er
 * bleibt die Migrationsquelle, damit eine leere/verlorene Sidecar-Datei sich selbst
 * heilt und neue Bausteine additiv in Bestands-Installationen wachsen (Muster
 * `mergeMissingSeeds` der Skill-Registry).
 *
 * **Idempotent, nie überschreibend:** ergänzt werden nur IDs, die im Katalog FEHLEN.
 * Ein kuratierter Baustein — auch ein stillgelegter — bleibt unangetastet; weil es
 * kein Löschen gibt, kann eine Stilllegung auch nicht durch den Seed wiederauferstehen.
 *
 * Die migrierten Bausteine starten `freigegeben`: sie sind seit v2.283 im Einsatz und
 * wären als `entwurf` über Nacht aus jeder NF verschwunden. `aspekte` bleibt zunächst
 * leer (der Seed kennt keine Prüfaspekt-Tags) — die Nachpflege läuft in der Verwaltung.
 */
import { NF_BAUSTEINE } from '../registry/nf-bausteine.seed';
import type { TextbausteinKatalog, TextbausteinRecord } from './types';

/**
 * Fester Zeitstempel der Seed-Übernahme — bewusst KEINE Uhr: sonst unterschieden
 * sich zwei Installationen im Datei-Inhalt, obwohl sie denselben Stand haben.
 */
export const NF_MIGRATION_TS = '2026-07-23T00:00:00.000Z';

/** Ein Seed-Baustein als Katalog-Record der Version 1. Rein. */
function alsRecord(b: (typeof NF_BAUSTEINE)[number]): TextbausteinRecord {
  const rec: TextbausteinRecord = {
    id: b.id,
    artefaktTyp: 'nf',
    scope: b.scope,
    thema: b.thema,
    kategorie: b.kategorie,
    aspekte: [],
    stichworte: [],
    text: b.text,
    platzhalter: b.platzhalter,
    status: 'freigegeben',
    version: 1,
    historie: [],
    geaendertAm: NF_MIGRATION_TS,
  };
  return {
    ...rec,
    historie: [{
      version: 1,
      thema: rec.thema,
      kategorie: rec.kategorie,
      text: rec.text,
      aspekte: [],
      stichworte: [],
      status: 'freigegeben',
      geaendertAm: NF_MIGRATION_TS,
      begruendung: 'Übernahme aus dem kuratierten NF-Baustein-Katalog (Code-Seed)',
    }],
  };
}

/** Der vollständige NF-Seed als Katalog-Records. Rein. */
export function nfSeedAlsRecords(): TextbausteinRecord[] {
  return NF_BAUSTEINE.map(alsRecord);
}

export interface SeedErgaenzung {
  katalog: TextbausteinKatalog;
  /** IDs, die dieser Lauf ergänzt hat (leer = nichts zu tun). */
  ergaenzt: string[];
}

/**
 * Ergänzt fehlende NF-Seed-Bausteine. Zweiter Lauf ergänzt nichts mehr; der
 * zurückgegebene Katalog ist bei `ergaenzt.length === 0` **identisch** (gleiche
 * Referenz), damit der Aufrufer nicht unnötig schreibt.
 */
export function mergeFehlendeNfBausteine(katalog: TextbausteinKatalog): SeedErgaenzung {
  const vorhanden = new Set(katalog.bausteine.map(b => b.id));
  const fehlend = nfSeedAlsRecords().filter(b => !vorhanden.has(b.id));
  if (fehlend.length === 0) return { katalog, ergaenzt: [] };
  return {
    katalog: { ...katalog, bausteine: [...katalog.bausteine, ...fehlend] },
    ergaenzt: fehlend.map(b => b.id),
  };
}

/** Leerer Katalog als Startpunkt (vor der ersten Migration). Rein. */
export function leererKatalog(): TextbausteinKatalog {
  return { version: 1, updated_at: NF_MIGRATION_TS, bausteine: [] };
}
