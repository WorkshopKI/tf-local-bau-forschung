/**
 * Rein: formt ein `AufbereitungEvalErgebnis` zu einem kopierbaren Markdown-Block.
 * Der Block ist das, was Thomas aus dem dev-Panel in den Chat einfügt — er muss
 * OHNE App-Kontext lesbar sein (Datum, Transport, Fixture-Zeilen, Gesamtmetrik,
 * bei Degradation die ersten ~400 Zeichen der Rohantwort).
 */
import { STECKBRIEF_FELDER, type AufbereitungEvalErgebnis, type FixtureErgebnis } from './runner';

export interface ReportMeta {
  /** z.B. `new Date().toLocaleString('de-DE')`. */
  zeitpunkt: string;
  /** `transport.displayName ?? transport.name`. */
  transportName: string;
  steckbriefEingeschlossen: boolean;
}

/** Länge des Rohtext-Auszugs bei Degradation. */
const ROHTEXT_AUSZUG = 400;

const p2 = (n: number): string => n.toFixed(2);
const p3 = (n: number): string => n.toFixed(3);

function fixtureBlock(f: FixtureErgebnis): string[] {
  const zeilen: string[] = [`### ${f.vbFile}`];
  if (!f.gefunden) {
    zeilen.push('- ⚠ Fixture nicht gefunden (übersprungen)');
    return zeilen;
  }

  const a = f.aspekte;
  if (a?.status === 'ok' && a.metrik) {
    const m = a.metrik;
    zeilen.push(`- Aspekte: ok — P=${p2(m.precision)} R=${p2(m.recall)} F1=${p2(m.f1)} (${m.treffer}/${m.goldPaare})`);
    zeilen.push(`- Fehlzuordnungen: ${a.fehlzuordnungen && a.fehlzuordnungen.length ? a.fehlzuordnungen.join('; ') : 'keine'}`);
  } else if (a?.status === 'degradiert') {
    zeilen.push('- Aspekte: degradiert (nicht parsebar)');
    zeilen.push('```', (a.rohtext ?? '').slice(0, ROHTEXT_AUSZUG), '```');
  } else if (a?.status === 'fehler') {
    zeilen.push(`- Aspekte: fehler — ${a.fehler ?? 'unbekannt'}`);
  }

  if (f.steckbrief) {
    const s = f.steckbrief;
    if (s.status === 'ok') {
      zeilen.push(`- Steckbrief (Smoke): ok — ${s.gefuellteFelder ?? 0}/${STECKBRIEF_FELDER} Felder`);
    } else if (s.status === 'degradiert') {
      zeilen.push('- Steckbrief (Smoke): degradiert (nicht parsebar)');
      zeilen.push('```', (s.rohtext ?? '').slice(0, ROHTEXT_AUSZUG), '```');
    } else {
      zeilen.push(`- Steckbrief (Smoke): fehler — ${s.fehler ?? 'unbekannt'}`);
    }
  }

  const resetTeile: string[] = [];
  if (a?.chatResetStatus) resetTeile.push(`Aspekte=${a.chatResetStatus}`);
  if (f.steckbrief?.chatResetStatus) resetTeile.push(`Steckbrief=${f.steckbrief.chatResetStatus}`);
  if (resetTeile.length) zeilen.push(`- Chat-Reset: ${resetTeile.join(', ')}`);

  if (f.dauerMs != null) zeilen.push(`- Dauer: ${(f.dauerMs / 1000).toFixed(1)}s`);
  return zeilen;
}

export function formatEvalReport(erg: AufbereitungEvalErgebnis, meta: ReportMeta): string {
  const z = erg.zusammenfassung;
  const gemessen = erg.fixtures.filter(f => f.aspekte?.status === 'ok').length;
  const kopf = [
    '# Aufbereitung — Baustein-Eval (In-App, Bridge)',
    '',
    `- Datum: ${meta.zeitpunkt}`,
    `- Transport: ${meta.transportName}`,
    `- Steckbrief-Smoke: ${meta.steckbriefEingeschlossen ? 'ja' : 'nein'}`,
    `- Fixtures: ${erg.fixtures.length} (Aspekte gemessen: ${gemessen})`,
    ...(erg.abgebrochen ? ['- ⚠ Lauf abgebrochen (Teilergebnis)'] : []),
    '',
    '## Gesamt (Aspekt-Mapping)',
    `- Makro: P=${p3(z.makroPrecision)} R=${p3(z.makroRecall)}`,
    `- Mikro: P=${p3(z.mikroPrecision)} R=${p3(z.mikroRecall)} F1=${p3(z.mikroF1)}`,
    '',
    '## Fixtures',
  ];
  const koerper = erg.fixtures.flatMap(f => [...fixtureBlock(f), '']);
  return [...kopf, ...koerper].join('\n').trimEnd() + '\n';
}
