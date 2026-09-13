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
import { artDesSchluessels } from '@/plugins/antraege/detailAufloesung';
import { aufgabenAnzeige } from '@/core/status';
import { schrittText, precheckUrteilVonZeile } from '@/core/utils/naechsterSchritt';
import type { ZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import type { KontextEntitaet } from '@/core/services/assistent/kontext';
import { baueArbeitsvorratUebersicht } from './arbeitsvorratUebersicht';
import { vorgangAbgeschlossen } from './abgeschlossen';
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

function fristHinweis(abgeschlossen: boolean, days: number | null): string | undefined {
  if (abgeschlossen) return undefined;
  const anz = fristAnzeigeFromDays(days);
  if (!anz) return undefined;
  // Rot trägt kein Wort dahinter: „12 T über Frist (überfällig)" sagte dasselbe zweimal.
  return anz.ampel === 'rot' ? anz.text : `${anz.text} (${AMPEL_WORT[anz.ampel]})`;
}

/**
 * Die Kennungen, unter denen Dokumente eines Vorgangs liegen, ohne leere und
 * doppelte Einträge. Das Retrieval schneidet damit auf die eigenen Dokumente zu.
 */
function kennungenAus(...ids: ReadonlyArray<string | null | undefined>): string[] {
  return [...new Set(ids.filter((k): k is string => typeof k === 'string' && k.trim().length > 0))];
}

function stammdatenZeilen(rows: Array<[string, string | null]>): Array<{ label: string; wert: string }> {
  return rows
    .filter((r): r is [string, string] => typeof r[1] === 'string' && r[1].trim().length > 0)
    .map(([label, wert]) => ({ label, wert }));
}

/**
 * „Was ist zu tun?" aus der To-do-Kaskade — dieselbe Rechnung wie in den Karten.
 *
 * `zeilen` kommt aus `useZeilenAufgaben('nie', …)`: ein **reiner Leser** der
 * bereits gerechneten Ablage, der keinen Bestandslauf auslöst (der kostet
 * Sekunden, und das Panel ist auf jeder Route gemountet). Liegt nichts vor,
 * bleibt das Feld weg und der Assembler nimmt wieder `schrittText`.
 */
function aufgabeVon(
  aktenzeichen: readonly string[],
  status: string | undefined,
  zeilen: ZeilenAufgaben | null | undefined,
): KontextEntitaet['aufgabe'] {
  if (!zeilen || aktenzeichen.length === 0) return undefined;
  const anzeige = aufgabenAnzeige({
    aufgabe: zeilen.fuer(aktenzeichen),
    rueckfall: schrittText(status ?? ''),
    laeuftNoch: zeilen.laeuftNoch,
    ausserhalbLauf: zeilen.ausserhalb(aktenzeichen),
    regeln: zeilen.regeln,
    status: status ?? null,
  });
  // Ein Platzhalter ist keine Aussage — er gehört nicht in einen Faktenblock.
  // (Mit `'nie'` ist `laeuftNoch` false, der Fall also ohnehin nicht zu erwarten.)
  // Ein vorläufiger Stand (vor dem letzten Import) auch nicht: der Bildschirm
  // markiert ihn, ein Faktenblock kann das nicht — dann lieber `schrittText`.
  if (anzeige.quelle === 'laedt' || anzeige.vorlaeufig || !anzeige.text.trim()) return undefined;
  return {
    text: anzeige.text,
    ausKaskade: anzeige.quelle !== 'rueckfall',
    ...(anzeige.neben ? { neben: anzeige.neben } : {}),
  };
}

function antragEntitaet(a: AntragListItem, now: number, zeilen?: ZeilenAufgaben | null): KontextEntitaet {
  const laufzeit = a.laufzeitbeginn && a.laufzeitende ? `${a.laufzeitbeginn} – ${a.laufzeitende}` : null;
  const hinweis = fristHinweis(isTerminalStatus(a.status), fristTageVon(a, now));
  const aufgabe = aufgabeVon([a.aktenzeichen], a.status, zeilen);
  return {
    art: 'antrag',
    id: a.aktenzeichen,
    titel: a.akronym || a.titel || a.aktenzeichen,
    status: a.status,
    precheckLabel: precheckUrteilVonZeile(a).label || null,
    phaseLabel: getVbPhaseLabel(a.vb_phase) ?? undefined,
    fristHinweis: hinweis,
    fristenAnzahl: hinweis ? 1 : 0,
    ...(aufgabe ? { aufgabe } : {}),
    // Mit Verbund-Nummer: die Verbund-VB gehört zu jedem seiner Teilvorhaben.
    kennungen: kennungenAus(a.aktenzeichen, a.verbund_id),
    stammdaten: stammdatenZeilen([
      ['Antragsteller', a.antragsteller ?? null],
      ['Ort', a.ort_ast ?? null],
      ['Fördersumme', euro(a.foerdersumme)],
      ['Laufzeit', laufzeit],
    ]),
  };
}

/**
 * Frist-Satz und Frist-Zahl des Verbunds für Faktenblock und Kontext-Chip.
 *
 * Der Satz nennt die dringendste LAUFENDE Frist im Verbund — nicht die aus dem
 * spätesten Antragsdatum gerechnete. Wo keine Uhr läuft, sagt der Assistent
 * nichts, statt eine Zahl zu melden, die die Liste nicht zeigt.
 *
 * Abgeschlossen ist der Verbund erst, wenn auch jedes Teilvorhaben es ist
 * (`vorgangAbgeschlossen` — ein TV im Widerspruch hält ihn offen). Die Zahl
 * folgt dem Satz, wie beim Einzelantrag (`hinweis ? 1 : 0`): sonst meldete der
 * Chip eine Frist, zu der Faktenblock und Vorgangsakte schweigen.
 */
export function verbundFrist(
  status: string | undefined, tvs: readonly AntragListItem[], now: number,
): { hinweis: string | undefined; anzahl: number } {
  const abgeschlossen = vorgangAbgeschlossen(status, tvs.map(t => t.status));
  const hinweis = fristHinweis(abgeschlossen, criticalFristErgebnis([...tvs], now).tageRest ?? null);
  const anzahl = hinweis ? tvs.filter(t => fristTageVon(t, now) !== null).length : 0;
  return { hinweis, anzahl };
}

function verbundEntitaet(verbundId: string, now: number, zeilen?: ZeilenAufgaben | null): KontextEntitaet {
  const st = useAntraegeStore.getState();
  const v = st.verbundById.get(verbundId);
  const tvs = st.antraege.filter(a => a.verbund_id === verbundId);
  const rep = tvs[0];
  const status = v?.status ?? rep?.status;
  // Die Kaskade faltet über ALLE Teilvorhaben des Verbunds — wie die Verbundzeile.
  const aufgabe = aufgabeVon(tvs.map(t => t.aktenzeichen), status, zeilen);
  const frist = verbundFrist(status, tvs, now);
  const summe = tvs.reduce((s, t) => s + (typeof t.foerdersumme === 'number' ? t.foerdersumme : 0), 0);
  return {
    art: 'verbund',
    id: verbundId,
    titel: v?.akronym || v?.titel || verbundId,
    status,
    phaseLabel: getVbPhaseLabel(rep?.vb_phase) ?? undefined,
    fristHinweis: frist.hinweis,
    fristenAnzahl: frist.anzahl,
    ...(aufgabe ? { aufgabe } : {}),
    kennungen: kennungenAus(verbundId, ...tvs.map(t => t.aktenzeichen)),
    stammdaten: stammdatenZeilen([
      ['Teilvorhaben', tvs.length > 0 ? String(tvs.length) : null],
      ['Antragsteller (Konsortialführer)', rep?.antragsteller ?? null],
      ['Fördersumme (Verbund)', summe > 0 ? euro(summe) : null],
    ]),
  };
}

/**
 * Die Entität hinter einem Schlüssel, der ein Aktenzeichen ODER eine
 * Verbund-Nummer sein kann.
 *
 * Die Detailseite verkraftet diese Zweideutigkeit seit v4.82 (`loeseDetailAuf`),
 * der Assistent tat es nicht: Deep-Links legen regelmäßig eine Verbund-Nummer in
 * den Aktenzeichen-Slot (Tagesbrief, Dokument-Panel, Vorgangs-Board), und wo die
 * Seite den richtigen Verbund zeigte, sah das Modell den nackten Stub
 * `{art:'antrag', id:'ZDS26026', titel:'ZDS26026'}` — ohne Status, Frist und
 * nächsten Schritt. Die Auflösung fragt deshalb dieselbe reine Ableitung, statt
 * die Vorrangregel „Aktenzeichen zuerst" hier ein zweites Mal hinzuschreiben.
 *
 * Das kostet im Treffer-Fall einen zweiten Durchlauf über die Projektion (das
 * `find` nach der Art-Frage). Bewusst in Kauf genommen: `verbundEntitaet`
 * darunter filtert ohnehin einmal voll durch, und eine zweite Handtabelle für die
 * Reihenfolge wäre der teurere Fehler.
 */
function entitaetFuerSchluessel(
  schluessel: string, now: number, zeilen?: ZeilenAufgaben | null,
): KontextEntitaet {
  const st = useAntraegeStore.getState();
  const art = artDesSchluessels(st.antraege, schluessel);
  if (art === 'verbund') return verbundEntitaet(schluessel, now, zeilen);
  if (art === 'antrag') {
    const a = st.antraege.find(x => x.aktenzeichen === schluessel);
    if (a) return antragEntitaet(a, now, zeilen); // `artDesSchluessels` hat ihn eben gefunden
  }
  // Unbekannt: der Schlüssel selbst ist alles, was wir ehrlich sagen können.
  return { art: 'antrag', id: schluessel, titel: schluessel, kennungen: kennungenAus(schluessel) };
}

/**
 * Baut den aktuellen Route-/Entitäts-Kontext. `now` injizierbar (Frist-Relativität).
 *
 * Vorrang der Entität:
 * 1. ein **ausdrücklich mitgegebener** `scopeSchluessel` — eine Karte, die eine
 *    Frage vorlegt, benennt damit auch deren Subjekt (Tagesbrief: „dazu
 *    nachfragen"). Ohne ihn käme auf der Startseite „Keine Entität ausgewählt"
 *    an, und das Modell antwortete prompt-konform, es wisse nichts über den
 *    Vorgang, nach dem gerade gefragt wurde.
 * 2. sonst die aktive Store-Selektion (auf Detailseiten die angesehene, sonst die
 *    zuletzt gewählte — bewusst indirekt, siehe Panel-Ort).
 */
export function baueKontextSnapshot(
  now: number = Date.now(),
  scopeSchluessel?: string | null,
  zeilen?: ZeilenAufgaben | null,
): AssistentTurnKontext {
  const st = useAntraegeStore.getState();
  const rb = routeBeschreibung(typeof window !== 'undefined' ? window.location.hash : '');
  if (scopeSchluessel) {
    return { routeBeschreibung: rb, entitaet: entitaetFuerSchluessel(scopeSchluessel, now, zeilen) };
  }
  if (st.selectedVerbundId) {
    return { routeBeschreibung: rb, entitaet: verbundEntitaet(st.selectedVerbundId, now, zeilen) };
  }
  if (st.selectedAktenzeichen) {
    return { routeBeschreibung: rb, entitaet: entitaetFuerSchluessel(st.selectedAktenzeichen, now, zeilen) };
  }
  // Kein-Entität-Fall (Liste/Startseite): deterministische Arbeitsvorrat-Übersicht
  // beilegen, damit „Fristen"/„Was ist heute dran?" faktengestützt sind.
  return {
    routeBeschreibung: rb,
    entitaet: null,
    arbeitsvorratUebersicht: baueArbeitsvorratUebersicht(st.antraege, now),
  };
}
