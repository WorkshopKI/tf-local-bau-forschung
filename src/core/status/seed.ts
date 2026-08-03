/**
 * Deterministischer Auslieferungs-Seed (Version 1) des Status-Katalogs.
 *
 * Wird beim ersten Start ohne gespeicherten Katalog geschrieben. Die
 * Wert→Kategorie-Zuordnung stammt **1:1** aus `status-canonical.ts`
 * (`getCanonicalStatusEntries`) — dadurch ist `getStatusCategory` über den
 * Katalog-Snapshot **bitweise identisch** zum eingebauten Fallback (Test
 * `byte-identitaet`). Angereichert wird nur additiv um Spine-Phase, Rang,
 * Prominenz und Terminal-Flag entlang einer dokumentierten Default-Tabelle
 * (siehe `docs/status-system/KATALOG-V1.md`).
 *
 * Strikt deterministisch (fester Zeitstempel, keine `Date.now()`/`Math.random()`)
 * — sonst schlägt der Determinismus-Test fehl.
 */
import { getCanonicalStatusEntries } from '@/core/utils/status-canonical';
import type {
  MappingVersion, Prominenz, StatusFeldEintrag, StatusWertEintrag,
} from './typen';
import { wertId } from './typen';
import { baueSeedCodeFelder } from './seed-codes';
import { SEED_KATEGORIEN } from './seed-kategorien';
import { reichereWerteAn } from './status-codes';
import { SEED_ZAH_PHASEN } from './zah-phasen';
import { KANONISCHE_FELDER, KANONISCHE_CODE_FELDER } from './seed-kanonisch';
import { baueTodoRegelSeed } from './todo-regeln.seed';

/** Re-Export: die kanonischen Felder leben in `seed-kanonisch.ts` (Zyklenschnitt). */
export { KANONISCHE_FELDER, KANONISCHE_CODE_FELDER };

/** Kurzname im Modul — der Seed baut daraus die Fassung. */
const FELDER = KANONISCHE_FELDER;

const SEED_ZEITSTEMPEL = '2026-07-24T00:00:00.000Z';

/** Statuswert-Vokabular wird unter beiden Wert-Feldern geführt (TV + Verbund
 *  tragen dieselben Rohwerte). Die Datumsfelder haben kein Wert-Enum. */
const WERT_FELDER = ['status', 'verbund_status'] as const;

/** Meilenstein-Rohwerte (normalisiert). Antragseingang, Bewilligung, Abschluss,
 *  finaler Negativausgang — die Fixpunkte der amtlichen Reise. Reine Anzeige
 *  (Punktgröße in Chronik und Zeitstrahl), keine Ableitung. */
const MEILENSTEIN_WERTE = new Set<string>([
  'beantragt',
  'bewilligt',
  'schlussvermerk',
  'abgelehnt/zurückgezogen',
]);

function prominenzFor(normalisierterWert: string): Prominenz {
  return MEILENSTEIN_WERTE.has(normalisierterWert) ? 'meilenstein' : 'normal';
}

function baueWerte(): StatusWertEintrag[] {
  const werte: StatusWertEintrag[] = [];
  for (const feldId of WERT_FELDER) {
    for (const [normalisierterWert, kategorie] of getCanonicalStatusEntries()) {
      werte.push({
        id: wertId(feldId, normalisierterWert),
        feldId,
        wert: normalisierterWert,
        kategorie,
        prominenz: prominenzFor(normalisierterWert),
        aktiv: true,
        unkuratiert: false,
      });
    }
  }
  // Vorgangssystem: Code, Varianten, ZAH-Phase und Marker-Flag anreichern.
  // Additiv — die Kategorie oben bleibt unangetastet, damit `getStatusCategory`
  // über den Snapshot bitweise identisch bleibt (`byte-identitaet`). Werte der
  // ohne Code laufen unverändert durch.
  return reichereWerteAn(werte);
}

/**
 * Der Code-Katalog OHNE die Codes, die schon als kanonisches Feld im Katalog
 * stehen (`AAE` zu `antragsdatum`, `ABB` zu `bewilligung_datum`, …).
 *
 * Diese Spalten sind app-weit gemappt (`CANONICAL_FIELD_NAME_ALIASES`); ein
 * zweiter Eintrag darauf zählte jedes Ereignis doppelt. Die Ausschlussliste
 * wird aus den kanonischen Feldern ABGELEITET statt gepflegt — ein neues
 * kanonisches Feld mit `code` wirkt hier automatisch.
 */
export function baueSeedCodeFelderOhneKanonische(): StatusFeldEintrag[] {
  return baueSeedCodeFelder().filter(f => !f.code || !KANONISCHE_CODE_FELDER.has(f.code));
}

/**
 * Baut die deterministische Seed-Version 1. Reine Funktion.
 *
 * Enthält den kompletten Code-Katalog des Fachsystems — eine frische
 * Installation startet damit vollständig. **Bestehende** Installationen führen
 * eine kuratierte Fassung > 1; die bekommt die neuen Felder nicht von hier,
 * sondern über `ergaenzeSeedFelder` im Cockpit, damit Handarbeit der PL nicht
 * überschrieben wird.
 */
export function baueSeedVersion(): MappingVersion {
  return {
    version: 1,
    autor: null,
    zeitstempel: SEED_ZEITSTEMPEL,
    kommentar: 'Auslieferungs-Seed (status-canonical.ts + Code-Katalog des Fachsystems)',
    kategorien: SEED_KATEGORIEN.map(k => ({ ...k })),
    felder: [...FELDER.map(f => ({ ...f })), ...baueSeedCodeFelderOhneKanonische()],
    werte: baueWerte(),
    // Vorgangssystem: Beschriftung + Reihenfolge der ZAH-Phasen. Die Zuordnung
    // Code→Phase steckt am Statuswert (`zahPhaseId`), nicht hier.
    zahPhasen: SEED_ZAH_PHASEN.map(p => ({ ...p })),
    // Der AB-Regelsatz aus der XLSX-Mappe. Die Reihenfolge IST die Kaskade.
    todoRegeln: baueTodoRegelSeed(),
  };
}
