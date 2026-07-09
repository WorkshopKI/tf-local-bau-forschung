import { describe, it, expect } from 'vitest';
import { parseVbGliederung } from '../gliederung';
import { ernteTabellen } from '../tabellen';
import { ernteRisiken, zuordneRisiken, risikoFehltKandidaten } from '../risiken';
import type { AspektMapping, RisikoEintrag, RunTabelle } from '../index';

/**
 * Fiktive VB: Kapitel 3 = Lösungsweg (Aspekt C, Unterabschnitte 3.1–3.5),
 * Kapitel 4 = Technische Risiken (Unterabschnitte 4.1–4.4, je eine Risiko-Tabelle).
 * Die Titel sind so gewählt, dass die deterministische Zuordnung 4.x → 3.y trifft.
 */
const VB = [
  '# 3 Technische Funktionalitäten',
  '',
  '## 3.1 KI-Algorithmen zur Bilderkennung',
  'Beschreibung des KI-Kernmodells und der Erkennungslogik.',
  '',
  '## 3.2 Skalierbarkeit und Anpassung der Architektur',
  'Die Architektur skaliert horizontal.',
  '',
  '## 3.3 Integration und Datenfusion der Sensordaten',
  'Zusammenführung heterogener Sensorquellen.',
  '',
  '## 3.4 Benutzerinteraktion und Bedienoberfläche',
  'Bedienkonzept und Oberfläche.',
  '',
  '## 3.5 Sicherheit und Datenschutz',
  'Verschlüsselung und Zugriffsschutz.',
  '',
  '# 4 Technische Risiken',
  '',
  '## 4.1 Integration der Datenfusion',
  '| Risiko | Beschreibung |',
  '| --- | --- |',
  '| Integration heterogener Datenfusion | Zusammenführung inkonsistenter Quellen schlägt fehl. |',
  '',
  '## 4.2 Sicherheit und Datenschutz',
  '| Risiko | Beschreibung |',
  '| --- | --- |',
  '| Sicherheit und Datenschutz der Plattform | Unbefugter Zugriff auf sensible Daten. |',
  '',
  '## 4.3 Zuverlässigkeit der KI-Algorithmen',
  '| Risiko | Beschreibung |',
  '| --- | --- |',
  '| Zuverlässigkeit und Genauigkeit der KI-Algorithmen | Modellgüte unterschreitet die Zielschwelle. |',
  '',
  '## 4.4 Skalierbarkeit und Anpassung',
  '| Risiko | Beschreibung |',
  '| --- | --- |',
  '| Skalierbarkeit und Anpassung an Lastspitzen | System bricht unter Last ein. |',
].join('\n');

const gliederung = parseVbGliederung(VB);
const tabellen: RunTabelle[] = ernteTabellen(VB).map(t => ({ ...t, rolle: 'vb' as const }));
const mapping: AspektMapping = {
  zuordnung: { C: ['k-3.1', 'k-3.2', 'k-3.3', 'k-3.4', 'k-3.5'] },
  fehlend: {},
};

describe('ernteRisiken', () => {
  it('erntet je Risiko-Tabellenzeile Titel + Beschreibung + Herkunftssektion (tiefste Ebene)', () => {
    const risiken = ernteRisiken(tabellen, gliederung);
    expect(risiken).toHaveLength(4);
    const nachSektion = Object.fromEntries(risiken.map(r => [r.sektionId, r]));
    expect(nachSektion['k-4.3']!.titel).toBe('Zuverlässigkeit und Genauigkeit der KI-Algorithmen');
    expect(nachSektion['k-4.3']!.beschreibung).toContain('Modellgüte');
    expect(new Set(risiken.map(r => r.sektionId))).toEqual(new Set(['k-4.1', 'k-4.2', 'k-4.3', 'k-4.4']));
  });

  it('Risiken aus einer separaten Anlage-5-Datei (rolle !== vb) tragen keine sektionId', () => {
    const anlage: RunTabelle[] = tabellen.map(t => ({ ...t, rolle: 'anlage5' as const }));
    const risiken = ernteRisiken(anlage, gliederung);
    expect(risiken.length).toBeGreaterThan(0);
    expect(risiken.every(r => r.sektionId === undefined)).toBe(true);
  });
});

describe('zuordneRisiken', () => {
  it('heftet jedes Risiko an den passenden Lösungsweg-Abschnitt (4.x → 3.y)', () => {
    const risiken = ernteRisiken(tabellen, gliederung);
    const z = zuordneRisiken(risiken, mapping, gliederung);
    const zielVon = (herkunft: string): string | undefined => {
      for (const [zielId, liste] of z.proSektion) if (liste.some(r => r.sektionId === herkunft)) return zielId;
      return undefined;
    };
    expect(zielVon('k-4.3')).toBe('k-3.1'); // KI
    expect(zielVon('k-4.2')).toBe('k-3.5'); // Sicherheit/Datenschutz
    expect(zielVon('k-4.1')).toBe('k-3.3'); // Integration/Datenfusion
    expect(zielVon('k-4.4')).toBe('k-3.2'); // Skalierbarkeit/Anpassung
  });

  it('Lösungsweg-Abschnitt ohne passendes Risiko landet in ohneRisiko (3.4)', () => {
    const z = zuordneRisiken(ernteRisiken(tabellen, gliederung), mapping, gliederung);
    expect(z.ohneRisiko.map(s => s.id)).toEqual(['k-3.4']);
  });

  it('Risiko unter der Schwelle bleibt unzugeordnet (Kunst-Risiko „Lieferkettenengpässe")', () => {
    const kunst: RisikoEintrag = { titel: 'Lieferkettenengpässe bei Zulieferern', beschreibung: 'Bauteile fehlen.' };
    const z = zuordneRisiken([...ernteRisiken(tabellen, gliederung), kunst], mapping, gliederung);
    expect(z.unzugeordnet).toHaveLength(1);
    expect(z.unzugeordnet[0]!.titel).toContain('Lieferkettenengpässe');
    // Das Kunst-Risiko taucht in keiner proSektion-Liste auf.
    expect([...z.proSektion.values()].flat().some(r => r.titel.includes('Lieferketten'))).toBe(false);
  });

  it('leeres Aspekt-Mapping → keine Ziel-Sektionen, alle Risiken unzugeordnet', () => {
    const z = zuordneRisiken(ernteRisiken(tabellen, gliederung), { zuordnung: {}, fehlend: {} }, gliederung);
    expect(z.proSektion.size).toBe(0);
    expect(z.ohneRisiko).toHaveLength(0);
    expect(z.unzugeordnet).toHaveLength(4);
  });
});

describe('risikoFehltKandidaten', () => {
  it('bildet stabile risiko-fehlt-Keys mit Aspekt-D-Referenz für ohneRisiko-Sektionen', () => {
    const z = zuordneRisiken(ernteRisiken(tabellen, gliederung), mapping, gliederung);
    const kand = risikoFehltKandidaten(z.ohneRisiko);
    expect(kand).toHaveLength(1);
    expect(kand[0]!.key).toBe('risiko-fehlt:k-3.4');
    expect(kand[0]!.aspektId).toBe('D');
    expect(kand[0]!.text).toContain('Lösungsweg 3.4');
    expect(kand[0]!.text).toContain('ohne benanntes technisches Risiko');
  });
});
