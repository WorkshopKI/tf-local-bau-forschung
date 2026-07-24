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

const SEED_ZEITSTEMPEL = '2026-07-24T00:00:00.000Z';

/** Statuswert-Vokabular wird unter beiden Wert-Feldern geführt (TV + Verbund
 *  tragen dieselben Rohwerte). Die Datumsfelder haben kein Wert-Enum. */
const WERT_FELDER = ['status', 'verbund_status'] as const;

/** Kategorie → Spine-Phase (deckungsgleich mit `statusZuStepperPosition.ts`:
 *  in_pruefung/nachforderung/entscheidung = Fachprüfung; bewilligt/begleitung =
 *  Bewilligung; abgeschlossen = Schluss; abgelehnt bricht an Fachprüfung ab). */
const KATEGORIE_ZU_SPINE: Record<StatusCategory, SpinePhase> = {
  offen: 'eingang',
  in_pruefung: 'fachpruefung',
  nachforderung: 'fachpruefung',
  entscheidung: 'fachpruefung',
  bewilligt: 'bewilligung',
  begleitung: 'bewilligung',
  abgeschlossen: 'schluss',
  abgelehnt: 'fachpruefung',
  sonstige: 'keine',
};

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

/** Wert-Ebene: `bearbeitungsreif`/`NL eingegangen` sitzen in „Vollständigkeit",
 *  alle übrigen `offen`-Werte in „Eingang" (wie der Stepper). */
function spineFor(normalisierterWert: string, kategorie: StatusCategory): SpinePhase {
  if (kategorie === 'offen'
    && (normalisierterWert === 'bearbeitungsreif' || normalisierterWert === 'nl eingegangen')) {
    return 'vollstaendigkeit';
  }
  return KATEGORIE_ZU_SPINE[kategorie];
}

function rangFor(spinePhase: SpinePhase, kategorie: StatusCategory): number {
  if (spinePhase === 'keine') return 0;
  return SPINE_BASIS_RANG[spinePhase] + (KATEGORIE_SUBRANG[kategorie] ?? 0);
}

function prominenzFor(normalisierterWert: string): Prominenz {
  return MEILENSTEIN_WERTE.has(normalisierterWert) ? 'meilenstein' : 'normal';
}

/** Die kuratierbaren Felder. Wert-Felder tragen ein Enum, Datumsfelder nicht.
 *  `ebene`/`quelleKey` steuern, aus welchem Record (Verbund vs. Antrag) und unter
 *  welchem Key der Wert gelesen wird — insb. `verbund_status`, das der Verbund-
 *  Record unter `status` führt (`VB_FIELD_MAP` im Merger). */
const FELDER: StatusFeldEintrag[] = [
  { feldId: 'status', label: 'TV-Status', typ: 'wert', ebene: 'tv', prominenzDefault: 'normal', aktiv: true, unkuratiert: false },
  { feldId: 'verbund_status', label: 'Verbund-Status', typ: 'wert', ebene: 'verbund', quelleKey: 'status', prominenzDefault: 'normal', aktiv: true, unkuratiert: false },
  { feldId: 'vb_phase', label: 'Verbund-Phase (Fördervariante)', typ: 'wert', ebene: 'tv', prominenzDefault: 'nebensaechlich', aktiv: true, unkuratiert: false },
  { feldId: 'antragsdatum', label: 'Antragseingang', typ: 'datum', ebene: 'tv', prominenzDefault: 'meilenstein', aktiv: true, unkuratiert: false },
  { feldId: 'erstentscheidung', label: 'Vorläufige Erstentscheidung', typ: 'datum', ebene: 'tv', prominenzDefault: 'meilenstein', aktiv: true, unkuratiert: false },
  { feldId: 'bewilligung_datum', label: 'Bewilligung', typ: 'datum', ebene: 'tv', prominenzDefault: 'meilenstein', aktiv: true, unkuratiert: false },
  { feldId: 'vn_eingang_datum', label: 'VN-Eingang (Begleitphase)', typ: 'datum', ebene: 'tv', prominenzDefault: 'normal', aktiv: true, unkuratiert: false },
];

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
  return werte;
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

/** Baut die deterministische Seed-Version 1. Reine Funktion. */
export function baueSeedVersion(): MappingVersion {
  return {
    version: 1,
    autor: null,
    zeitstempel: SEED_ZEITSTEMPEL,
    kommentar: 'Auslieferungs-Seed (aus status-canonical.ts abgeleitet)',
    felder: FELDER.map(f => ({ ...f })),
    werte: baueWerte(),
    regeln: baueSeedRegeln(),
  };
}
