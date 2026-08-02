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
import {
  getCanonicalStatusEntries,
  TERMINAL_STATUS_CATEGORIES,
} from '@/core/utils/status-canonical';
import type {
  MappingVersion, NaechsterSchrittRegel, Prominenz, SpinePhase, StatusCategory,
  StatusFeldEintrag, StatusWertEintrag,
} from './typen';
import { wertId } from './typen';
import { baueSeedCodeFelder } from './seed-codes';
import { SEED_KATEGORIEN } from './seed-kategorien';
import { KATEGORIE_ZU_SPINE } from './spine-kategorie';
import { findeStatusCode, reichereWerteAn } from './status-codes';
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

// Die Kategorie→Spine-Abbildung wohnt in `spine-kategorie.ts`, weil die
// Ableitung sie auch rückwärts braucht (Datumsfelder tragen die Phase, nicht
// die Kategorie) und beide Richtungen zueinander passen müssen.

/** Basisrang je Spine-Phase (Zehnerlücken). `keine` trägt nicht bei (0). */
const SPINE_BASIS_RANG: Record<SpinePhase, number> = {
  eingang: 10,
  vollstaendigkeit: 20,
  fachpruefung: 30,
  bewilligung: 40,
  schluss: 50,
  keine: 0,
};

/** Feinordnung innerhalb einer Spine-Phase (additiv, 0..8). */
const KATEGORIE_SUBRANG: Partial<Record<StatusCategory, number>> = {
  in_pruefung: 0,
  nachforderung: 2,
  entscheidung: 6,
  bewilligt: 0,
  begleitung: 4,
};

/** Meilenstein-Rohwerte (normalisiert). Antragseingang, Bewilligung, Abschluss,
 *  finaler Negativausgang — die Fixpunkte der amtlichen Reise. */
const MEILENSTEIN_WERTE = new Set<string>([
  'beantragt',
  'bewilligt',
  'schlussvermerk',
  'abgelehnt/zurückgezogen',
]);

/**
 * Status-Codes, deren Wert die Station „Vollständigkeit" markiert: 34
 * (bearbeitungsreif) und 36 (NL eingegangen).
 *
 * Über den CODE, nicht über den Rohtext plus `kategorie === 'offen'`: dieselbe
 * Zuordnung hing bis v2.383 an zwei Literalen, und der Kategorie-Wechsel von
 * „NL eingegangen" auf `nachforderung` hätte sie still ausgehebelt — die
 * Spine-Phase wäre von `vollstaendigkeit` auf `fachpruefung` gesprungen und
 * hätte jeden NL-Verbund zu einer neuen Abweichung im Phasen-Vergleich gemacht.
 * Bewusst NICHT 33/35/37: das reproduziert die Zuordnung, die vorher galt.
 */
const VOLLSTAENDIGKEITS_CODES: ReadonlySet<number> = new Set([34, 36]);

/** Wert-Ebene: siehe {@link VOLLSTAENDIGKEITS_CODES}; sonst die Kategorie-Abbildung. */
function spineFor(normalisierterWert: string, kategorie: StatusCategory): SpinePhase {
  const code = findeStatusCode(normalisierterWert)?.eintrag.code;
  if (code !== undefined && VOLLSTAENDIGKEITS_CODES.has(code)) return 'vollstaendigkeit';
  return KATEGORIE_ZU_SPINE[kategorie];
}

function rangFor(spinePhase: SpinePhase, kategorie: StatusCategory): number {
  if (spinePhase === 'keine') return 0;
  return SPINE_BASIS_RANG[spinePhase] + (KATEGORIE_SUBRANG[kategorie] ?? 0);
}

function prominenzFor(normalisierterWert: string): Prominenz {
  return MEILENSTEIN_WERTE.has(normalisierterWert) ? 'meilenstein' : 'normal';
}


function baueWerte(): StatusWertEintrag[] {
  const werte: StatusWertEintrag[] = [];
  for (const feldId of WERT_FELDER) {
    for (const [normalisierterWert, kategorie] of getCanonicalStatusEntries()) {
      const spinePhase = spineFor(normalisierterWert, kategorie);
      werte.push({
        id: wertId(feldId, normalisierterWert),
        feldId,
        wert: normalisierterWert,
        kategorie,
        spinePhase,
        rang: rangFor(spinePhase, kategorie),
        prominenz: prominenzFor(normalisierterWert),
        terminal: TERMINAL_STATUS_CATEGORIES.has(kategorie),
        aktiv: true,
        unkuratiert: false,
      });
    }
  }
  // Vorgangssystem: Code, Varianten, ZAH-Phase und Marker-Flag anreichern.
  // Additiv — die Kategorie/Spine/Rang-Wertung oben bleibt unangetastet, damit
  // `getStatusCategory` über den Snapshot bitweise identisch bleibt
  // (`byte-identitaet`). Werte der Bauantrag-Domäne treffen keinen Förder-Code
  // und laufen unverändert durch.
  return reichereWerteAn(werte);
}

/**
 * Kleine, dokumentierte Default-Regelmenge (nächste Schritte). Werkzeug-Verweise
 * sind reine Navigation, nie selbst ein Status. Details: KATALOG-V1.md.
 */
function baueSeedRegeln(): NaechsterSchrittRegel[] {
  return [
    { id: 'nf-offen', prioritaet: 10, aktiv: true, beschreibung: 'Offene Nachforderung bearbeiten',
      bedingung: { feldId: 'status', op: 'ist', wert: 'nf gestellt' },
      schritte: [{ label: 'Nachforderung bearbeiten', werkzeug: 'nachforderung' }] },
    { id: 'ga-fertig', prioritaet: 20, aktiv: true, beschreibung: 'Gutachten liegt vor → Erstentscheidung',
      bedingung: { feldId: 'status', op: 'ist', wert: 'gutachten fertig' },
      schritte: [{ label: 'Erstentscheidung vorbereiten', werkzeug: 'gutachten' }] },
    { id: 'bewilligungsreif', prioritaet: 20, aktiv: true, beschreibung: 'Bewilligung vorbereiten',
      bedingung: { feldId: 'status', op: 'ist', wert: 'bewilligungsreif' },
      schritte: [{ label: 'Bewilligung vorbereiten' }] },
    { id: 'ablehnungsreif', prioritaet: 20, aktiv: true, beschreibung: 'Ablehnung vorbereiten',
      bedingung: { feldId: 'status', op: 'ist', wert: 'ablehnungsreif' },
      schritte: [{ label: 'Ablehnung vorbereiten', werkzeug: 'ablehnung' }] },
    { id: 'eingang-vollstaendigkeit', prioritaet: 40, aktiv: true, beschreibung: 'Neuer Antrag → Vollständigkeit prüfen',
      bedingung: { feldId: 'status', op: 'ist', wert: 'beantragt' },
      schritte: [{ label: 'Vollständigkeit prüfen' }] },
  ];
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
    regeln: baueSeedRegeln(),
    // Vorgangssystem: Beschriftung + Reihenfolge der ZAH-Phasen. Die Zuordnung
    // Code→Phase steckt am Statuswert (`zahPhaseId`), nicht hier.
    zahPhasen: SEED_ZAH_PHASEN.map(p => ({ ...p })),
    // Der AB-Regelsatz aus der XLSX-Mappe. Die Reihenfolge IST die Kaskade.
    todoRegeln: baueTodoRegelSeed(),
  };
}
