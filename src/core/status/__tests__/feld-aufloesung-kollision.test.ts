/**
 * Der Spalten-Schlüssel der Feld-Auflösung — und die Kollisionen, die er nicht
 * mehr erzeugen darf.
 *
 * **Der Befund** (v4.82.0, gemessen an Fassung 22 + den drei Import-Schemas):
 * die Auflösung lief über `normCode`, das `-`, `_` und Leerzeichen wegwirft. Im
 * Vokabular des Fachsystems sind das aber **bedeutungstragende** Zeichen: `QS`
 * („kaufm. QS erfolgt") und `QS-` („kaufm. QS zurück an AB") sind zwei Kürzel.
 * `D_QS` und `D_QS-` fielen damit auf denselben Index-Schlüssel, der Zweite
 * verdrängte den Ersten aus der Auflösung — und `D_QS` trug in der ganzen App
 * nie einen Wert, obwohl der Export ihn in **7 135 Zeilen** führt (3 954 davon in
 * den aktuellen Richtlinien). Ebenso `AQ4` (6 758), `VQK` (3 208), `ARQ` (1 260),
 * `ABLQ` (821).
 *
 * Schlimmer als das Verschwinden war die **Fehl-Lesung**: `D_ARQ-` und `D_VQK-`
 * haben gar keine eigene Spalte im Export. Über den normalisierten Schlüssel
 * griffen sie die Spalte ihres Geschwisters ab und zeigten dessen Daten unter
 * ihrem Namen.
 *
 * Gebraucht wurde der unscharfe Schlüssel nur für **Groß-/Kleinschreibung**
 * (`vb_phase` gegen die Spalte `VB_PHASE`) — gemessen fünf Felder, und vier davon
 * waren genau die schädlichen Fälle. Deshalb normalisiert `spaltenSchluessel`
 * jetzt nur noch Unicode-Form, Rand-Leerraum und Groß-/Kleinschreibung.
 *
 * Zweiter Teil: der Kollisionsschutz vergaß die **Herkunft**. `verbund_status`
 * liest `status` aus dem VERBUND-Record, das kanonische `status` aus dem
 * TV-Record — kein Konflikt, trotzdem fiel `verbund_status` heraus. Der
 * Verlaufs-Bestandslauf sucht es namentlich und bekam immer den leeren String.
 */
import { describe, it, expect } from 'vitest';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  baueFeldAufloesung, baueSpaltenIndex, spaltenSchluessel,
} from '../feld-aufloesung';
import type { StatusFeldEintrag } from '../typen';

const feld = (p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag => ({
  label: p.feldId, typ: 'datum', ebene: 'tv', rollen: [],
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
});

/** Ein Schema mit `spalte → canonical`, wie es der Import ablegt. */
const schema = (mapping: Record<string, string>): CsvSchema => ({
  id: 'test', programm_id: 'p', is_master: true,
  column_mapping: Object.fromEntries(
    Object.entries(mapping).map(([k, v]) => [k, { canonical: v }]),
  ),
} as unknown as CsvSchema);

/** Die echte Konstellation aus dem Export, auf das Nötigste eingedampft. */
const SCHEMAS = [schema({
  D_QS: 'kaufmannische_qs_erfolgt',
  'D_QS-': 'kaufmannische_qs_zuruck_an_ab',
  D_AQ4: 'fachliche_qs_fertig',
  'D_AQ4-': 'fachliche_qs_zuruck_an_fb',
  D_ARQ: 'rucknahmeempfehlung_qualitatssicherung',
  VB_PHASE: 'vb_phase',
})];

describe('spaltenSchluessel', () => {
  it('unterscheidet Kürzel, die sich nur im Satzzeichen unterscheiden', () => {
    expect(spaltenSchluessel('D_QS')).not.toBe(spaltenSchluessel('D_QS-'));
    expect(spaltenSchluessel('D_AQ4')).not.toBe(spaltenSchluessel('D_AQ4-'));
  });

  it('bleibt unempfindlich gegen Groß-/Kleinschreibung und Rand-Leerraum', () => {
    expect(spaltenSchluessel('VB_PHASE')).toBe(spaltenSchluessel('vb_phase'));
    expect(spaltenSchluessel(' D_QS ')).toBe(spaltenSchluessel('D_QS'));
  });
});

describe('baueSpaltenIndex', () => {
  it('führt beide Geschwister getrennt statt nur das erste', () => {
    const idx = baueSpaltenIndex(SCHEMAS);
    expect(idx.get(spaltenSchluessel('D_QS'))).toBe('kaufmannische_qs_erfolgt');
    expect(idx.get(spaltenSchluessel('D_QS-'))).toBe('kaufmannische_qs_zuruck_an_ab');
  });
});

describe('baueFeldAufloesung — Geschwister-Kollision', () => {
  it('löst beide Kürzel eines K/T-artigen Paares auf ihre EIGENE Spalte auf', () => {
    const aufl = baueFeldAufloesung(SCHEMAS, [
      feld({ feldId: 'D_QS-', code: 'QS-' }),
      feld({ feldId: 'D_QS', code: 'QS' }),
      feld({ feldId: 'D_AQ4-', code: 'AQ4-' }),
      feld({ feldId: 'D_AQ4', code: 'AQ4' }),
    ]);
    expect(aufl.get('D_QS')?.recordKey).toBe('kaufmannische_qs_erfolgt');
    expect(aufl.get('D_QS-')?.recordKey).toBe('kaufmannische_qs_zuruck_an_ab');
    expect(aufl.get('D_AQ4')?.recordKey).toBe('fachliche_qs_fertig');
    expect(aufl.get('D_AQ4-')?.recordKey).toBe('fachliche_qs_zuruck_an_fb');
  });

  it('lässt ein Feld OHNE eigene Spalte nicht die des Geschwisters lesen', () => {
    // `D_ARQ-` steht in keinem Export. Vorher griff es über den unscharfen
    // Schlüssel `darq` die Spalte von `D_ARQ` ab und zeigte deren 1 260 Werte
    // unter seinem Namen — während `D_ARQ` selbst leer blieb.
    const aufl = baueFeldAufloesung(SCHEMAS, [
      feld({ feldId: 'D_ARQ-', code: 'ARQ-' }),
      feld({ feldId: 'D_ARQ', code: 'ARQ' }),
    ]);
    expect(aufl.get('D_ARQ')?.recordKey).toBe('rucknahmeempfehlung_qualitatssicherung');
    expect(aufl.get('D_ARQ-')?.recordKey).not.toBe('rucknahmeempfehlung_qualitatssicherung');
  });

  it('trifft die Spalte weiterhin über die Groß-/Kleinschreibung', () => {
    const aufl = baueFeldAufloesung(SCHEMAS, [feld({ feldId: 'vb_phase', typ: 'wert' })]);
    expect(aufl.get('vb_phase')?.recordKey).toBe('vb_phase');
  });
});

describe('baueFeldAufloesung — Kollisionsschutz kennt die Herkunft', () => {
  it('hält Verbund- und TV-Feld auf demselben Key nebeneinander', () => {
    // Beide lesen `status`, aber aus verschiedenen Records — kein Konflikt.
    // Vorher fiel `verbund_status` heraus, und der Verlaufs-Bestandslauf, der
    // es namentlich sucht, bekam immer den leeren String.
    const aufl = baueFeldAufloesung([], [
      feld({ feldId: 'status', typ: 'wert' }),
      feld({ feldId: 'verbund_status', typ: 'wert', ebene: 'verbund', quelleKey: 'status' }),
    ]);
    expect(aufl.get('status')?.recordKey).toBe('status');
    expect(aufl.get('verbund_status')?.recordKey).toBe('status');
  });

  it('schützt weiter innerhalb DERSELBEN Herkunft, kanonisch gewinnt', () => {
    // Der ursprüngliche Zweck bleibt: mappt ein Programm eine Code-Spalte
    // kanonisch, zählte die Spalte sonst zweimal.
    const aufl = baueFeldAufloesung(
      [schema({ D_AAE: 'antragsdatum' })],
      [feld({ feldId: 'D_AAE', code: 'AAE' }), feld({ feldId: 'antragsdatum' })],
    );
    expect(aufl.has('D_AAE'), 'Code-Feld weicht dem kanonischen').toBe(false);
    expect(aufl.get('antragsdatum')?.recordKey).toBe('antragsdatum');
  });
});
