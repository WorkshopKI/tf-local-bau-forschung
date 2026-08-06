/**
 * Assistent-Panel (Phase 1) — unreiner Kontext-Snapshot.
 *
 * Liest die aktuelle Route (Hash-Router) + die selektierte Entität aus dem
 * Antraege-Store und baut daraus die `KontextEntitaet` für den deterministischen
 * Assembler. Nur bestehende reine Fakten-Funktionen werden angezapft — hier
 * entsteht KEINE neue Ableitung. Diese Datei ist die unreine Grenze (Stores,
 * `window.location`, `Date.now()`); der Assembler selbst bleibt rein.
 */
import { useAntraegeStore } from '@/plugins/antraege/store';
import { getVbPhaseLabel } from '@/core/utils/vb-phase-mappings';
import { isTerminalStatus } from '@/core/utils/status-canonical';
import type { AntragListItem } from '@/core/services/csv/types';
import type { EingangAmpel } from '@/plugins/antraege/eingangAmpel';
import { fristAnzeigeFromDays, fristTageVon } from '@/plugins/antraege/fristAnzeige';
import { criticalFristErgebnis } from '@/plugins/antraege/groupAggregates';
import type { KontextEntitaet } from '@/core/services/assistent/kontext';
import { baueArbeitsvorratUebersicht } from './arbeitsvorratUebersicht';
import type { AssistentTurnKontext } from './turn';

const AMPEL_WORT: Record<EingangAmpel, string> = {
  rot: 'überfällig',
  orange: 'dringend',
  gelb: 'näher rückend',
  gruen: 'im Zeitplan',
};

function routeBeschreibung(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  if (path === '' || path === '/' || path.startsWith('/home')) return 'Startseite';
  if (path.includes('/aufbereitung')) return 'Antrag-Aufbereitung';
  if (path.includes('/antraege/verbund/')) return 'Detailansicht Verbund';
  if (/^\/antraege\/[^/]+$/.test(path)) return 'Detailansicht Antrag';
  if (path.startsWith('/antraege')) return 'Förderanträge-Liste';
  if (path.startsWith('/suche')) return 'Suche';
  if (path.startsWith('/auslastung')) return 'Auslastung';
  return path || 'App';
}

function euro(n: number | undefined): string | null {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toLocaleString('de-DE')} €` : null;
}

function fristHinweis(status: string | undefined, days: number | null): string | undefined {
  if (isTerminalStatus(status)) return undefined;
  const anz = fristAnzeigeFromDays(days);
  return anz ? `${anz.text} (${AMPEL_WORT[anz.ampel]})` : undefined;
}

function stammdatenZeilen(rows: Array<[string, string | null]>): Array<{ label: string; wert: string }> {
  return rows
    .filter((r): r is [string, string] => typeof r[1] === 'string' && r[1].trim().length > 0)
    .map(([label, wert]) => ({ label, wert }));
}

function antragEntitaet(a: AntragListItem, now: number): KontextEntitaet {
  const laufzeit = a.laufzeitbeginn && a.laufzeitende ? `${a.laufzeitbeginn} – ${a.laufzeitende}` : null;
  const hinweis = fristHinweis(a.status, fristTageVon(a, now));
  return {
    art: 'antrag',
    id: a.aktenzeichen,
    titel: a.akronym || a.titel || a.aktenzeichen,
    status: a.status,
    precheckLabel: a.precheck_status_label ?? null,
    phaseLabel: getVbPhaseLabel(a.vb_phase) ?? undefined,
    fristHinweis: hinweis,
    fristenAnzahl: hinweis ? 1 : 0,
    stammdaten: stammdatenZeilen([
      ['Antragsteller', a.antragsteller ?? null],
      ['Ort', a.ort_ast ?? null],
      ['Fördersumme', euro(a.foerdersumme)],
      ['Laufzeit', laufzeit],
    ]),
  };
}

function verbundEntitaet(verbundId: string, now: number): KontextEntitaet {
  const st = useAntraegeStore.getState();
  const v = st.verbundById.get(verbundId);
  const tvs = st.antraege.filter(a => a.verbund_id === verbundId);
  const rep = tvs[0];
  const status = v?.status ?? rep?.status;
  // Die dringendste LAUFENDE Frist im Verbund — nicht die aus dem spätesten
  // Antragsdatum gerechnete. Wo keine Uhr läuft, sagt der Assistent nichts,
  // statt eine Zahl zu melden, die die Liste nicht zeigt.
  const hinweis = fristHinweis(status, criticalFristErgebnis(tvs, now).tageRest ?? null);
  const offeneFristen = tvs.filter(t => fristTageVon(t, now) !== null).length;
  const summe = tvs.reduce((s, t) => s + (typeof t.foerdersumme === 'number' ? t.foerdersumme : 0), 0);
  return {
    art: 'verbund',
    id: verbundId,
    titel: v?.akronym || v?.titel || verbundId,
    status,
    phaseLabel: getVbPhaseLabel(rep?.vb_phase) ?? undefined,
    fristHinweis: hinweis,
    fristenAnzahl: offeneFristen,
    stammdaten: stammdatenZeilen([
      ['Teilvorhaben', tvs.length > 0 ? String(tvs.length) : null],
      ['Antragsteller (Konsortialführer)', rep?.antragsteller ?? null],
      ['Fördersumme (Verbund)', summe > 0 ? euro(summe) : null],
    ]),
  };
}

/**
 * Baut den aktuellen Route-/Entitäts-Kontext. `now` injizierbar (Frist-Relativität).
 * Priorität der Entität = die aktive Store-Selektion (auf Detailseiten die
 * angesehene, sonst die zuletzt gewählte — bewusst indirekt, siehe Panel-Ort).
 */
export function baueKontextSnapshot(now: number = Date.now()): AssistentTurnKontext {
  const st = useAntraegeStore.getState();
  const rb = routeBeschreibung(typeof window !== 'undefined' ? window.location.hash : '');
  if (st.selectedVerbundId) return { routeBeschreibung: rb, entitaet: verbundEntitaet(st.selectedVerbundId, now) };
  if (st.selectedAktenzeichen) {
    const a = st.antraege.find(x => x.aktenzeichen === st.selectedAktenzeichen);
    return {
      routeBeschreibung: rb,
      entitaet: a
        ? antragEntitaet(a, now)
        : { art: 'antrag', id: st.selectedAktenzeichen, titel: st.selectedAktenzeichen },
    };
  }
  // Kein-Entität-Fall (Liste/Startseite): deterministische Arbeitsvorrat-Übersicht
  // beilegen, damit „Fristen"/„Was ist heute dran?" faktengestützt sind.
  return {
    routeBeschreibung: rb,
    entitaet: null,
    arbeitsvorratUebersicht: baueArbeitsvorratUebersicht(st.antraege, now),
  };
}
