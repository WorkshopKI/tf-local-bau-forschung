/**
 * **Golden Test des Rückbaus (P6)**: die alte, aus Rängen abgeleitete Lesart
 * gegen die neue, am Status-Code hängende — mit der Zusage „null *unerklärte*
 * Abweichungen".
 *
 * ## Was dieser Test beweist
 *
 * - Die **Ursachen-Mechanik** ist genau die behauptete: `beantragt` + ein
 *   Vollständigkeits-Datum erzeugt reproduzierbar „Eingang vs. Vollständigkeit",
 *   ein terminales Feld erzeugt „… vs. Schluss".
 * - **Ohne Treiberfeld weicht kein einziger Katalog-Code ab.** Das ist die
 *   eigentliche Aussage: die neue Lesart deckt sich mit der alten überall dort,
 *   wo die alte nichts vorwegnimmt.
 * - Ein **13. Ursachenmuster** ließe entweder den Gesamt-Korpus-Test oder den
 *   „ohne Treiber"-Test fallen.
 * - Deterministisch, ohne Uhr, ohne echte Daten — läuft in CI.
 *
 * ## Was er NICHT beweist
 *
 * - **Die Zahlen 260/68/53/… sind Behauptungen.** Der Test rechnet sie nicht
 *   nach, er stellt sie her: `anzahl: 260` erzeugt 260 synthetische Verbünde und
 *   zählt 260. Wäre die echte Zahl 300, merkte hier niemand etwas. Sie sind ein
 *   PROTOKOLL aus dem Diagnose-Lauf (`BESTAND_STAND`), dessen einzige Kontrolle
 *   ein Mensch mit dem echten Bestand ist — im dev-Build über
 *   Status-Katalog → Diagnose → „Bilanz kopieren".
 * - **Nicht, dass es im echten Bestand nur zwölf Muster gibt.** Ein Statuswert,
 *   den weder die Fixtures noch der Messlauf kannten, taucht hier nie auf.
 * - **Nichts über die fachliche Richtigkeit** des Phasen-Schnitts (sind die 260
 *   „beantragt → Eingang" die gewollte Lesart?). Das ist eine PL-Entscheidung,
 *   kein Test.
 *
 * Lebensdauer: **stirbt mit `ableitung.ts`** (P6 Phase 3).
 */
import { describe, it, expect } from 'vitest';
import { vergleichePhasen, abweichungsMuster } from '../phasen-vergleich';
import { baueSeedVersion } from '../seed';
import { STATUS_CODE_KATALOG } from '../status-codes';
import { SEED_MARKER_CODES } from '../zah-phasen';
import type { VerbundFelder } from '../cockpit-berechnung';
import {
  ABWEICHUNGS_MUSTER, BESTAND_STAND, STRUKTURELLE_ABWEICHUNGEN,
  CODES_OHNE_ZAH_PHASE, type MusterErwartung,
} from './fixtures/phasen-vergleich-muster';

const HEUTE = '2026-08-02T00:00:00.000Z';
const seed = baueSeedVersion();

/** Ein Verbund mit gesetztem Verbund-Status und optionalem Treiberfeld. */
function verbund(id: string, statusRoh: string, m?: MusterErwartung): VerbundFelder {
  const felder: Record<string, string> = { verbund_status: statusRoh };
  const tvFelder: Record<string, Record<string, string>> = {};
  const t = m?.treiber;
  if (t) {
    if (t.ebene === 'verbund') felder[t.feldId] = '01.03.2026';
    else tvFelder['TV-1'] = { [t.feldId]: '01.03.2026' };
  }
  return { verbundId: id, felder, tvFelder };
}

/** So viele Verbünde wie das Muster im Bestand hat — die Zahl wird HERGESTELLT. */
function korpus(m: MusterErwartung): VerbundFelder[] {
  return Array.from({ length: m.anzahl }, (_, i) => verbund(`${m.code}-${m.spinePhase}-${i}`, m.statusRoh, m));
}

describe('Golden Test — die zwölf Muster reproduzieren sich', () => {
  it.each(ABWEICHUNGS_MUSTER.map(m => [`${m.statusRoh} → ${m.spinePhase}`, m] as const))(
    'Muster „%s"', (_name, m) => {
      const v = vergleichePhasen(seed, korpus(m), HEUTE);
      expect(v.abweichend).toBe(m.anzahl);
      expect(v.gleich).toBe(0);
      const [treffer, ...weitere] = abweichungsMuster(v);
      expect(weitere).toHaveLength(0);
      expect(treffer).toMatchObject({
        statusRoh: m.statusRoh, code: m.code, zahPhase: m.zahPhase,
        spinePhase: m.spinePhase, anzahl: m.anzahl,
      });
    },
  );

  it('der Gesamt-Korpus erzeugt genau diese Muster und keines mehr', () => {
    const alle = ABWEICHUNGS_MUSTER.flatMap(korpus);
    const v = vergleichePhasen(seed, alle, HEUTE);
    expect(v.abweichend).toBe(BESTAND_STAND.abweichend);
    expect(v.unvergleichbar).toBe(0);
    expect(abweichungsMuster(v)).toHaveLength(ABWEICHUNGS_MUSTER.length);
  });

  it('die protokollierten Zählungen summieren sich auf die Bilanz', () => {
    const summe = ABWEICHUNGS_MUSTER.reduce((s, m) => s + m.anzahl, 0);
    expect(summe).toBe(BESTAND_STAND.abweichend);
    expect(BESTAND_STAND.gleich + BESTAND_STAND.abweichend + BESTAND_STAND.unvergleichbar)
      .toBe(BESTAND_STAND.verbuende);
  });
});

describe('Golden Test — die Ursache ist das Feld, nicht der Statustext', () => {
  it('OHNE Treiberfeld weicht kein Muster ab (außer dem strukturellen)', () => {
    for (const m of ABWEICHUNGS_MUSTER) {
      const v = vergleichePhasen(seed, [verbund('X', m.statusRoh)], HEUTE);
      const erwartet = m.treiber === null ? 1 : 0;
      expect(
        v.abweichend,
        `„${m.statusRoh}" ohne Treiber sollte ${erwartet} Abweichung haben`,
      ).toBe(erwartet);
    }
  });

  it('über den ganzen Katalog weichen nur die drei strukturellen Codes ab', () => {
    const v = vergleichePhasen(
      seed, STATUS_CODE_KATALOG.map(e => verbund(`c${e.code}`, e.text)), HEUTE,
    );
    expect(v.abweichend).toBe(STRUKTURELLE_ABWEICHUNGEN.length);
    const codes = v.zeilen.filter(z => z.grund === 'abweichung').map(z => z.code).sort((a, b) => a! - b!);
    expect(codes).toEqual(STRUKTURELLE_ABWEICHUNGEN.map(s => s.code).sort((a, b) => a - b));
    // Der Rest: was der Katalog unter seinem AMTLICHEN Namen nicht kennt.
    expect(v.unvergleichbar).toBe(CODES_OHNE_ZAH_PHASE.length);
    expect(v.gleich).toBe(
      STATUS_CODE_KATALOG.length
      - STRUKTURELLE_ABWEICHUNGEN.length
      - CODES_OHNE_ZAH_PHASE.length,
    );
  });

  it('jeder amtliche Text löst auf — unvergleichbar sind nur die Marker', () => {
    // Vor v2.383 standen hier neun Codes: die handgeschriebene Kategorie-Tabelle
    // kannte nur 21 der 30 unter ihrem amtlichen Namen (siehe Fixture-Kommentar).
    // Seit die Fassade aus dem Code-Katalog gespeist wird, bleiben die vier
    // Marker — und die sind bewusst ohne Phase, nicht vergessen.
    const v = vergleichePhasen(
      seed, STATUS_CODE_KATALOG.map(e => verbund(`c${e.code}`, e.text)), HEUTE,
    );
    const ohne = v.zeilen
      .filter(z => z.grund === 'ohne-code' || z.grund === 'marker')
      .map(z => STATUS_CODE_KATALOG.find(e => e.text === z.statusRoh)!.code)
      .sort((a, b) => a - b);
    expect(ohne).toEqual([...CODES_OHNE_ZAH_PHASE].sort((a, b) => a - b));
    expect(new Set(CODES_OHNE_ZAH_PHASE)).toEqual(new Set(SEED_MARKER_CODES));
    // Kein einziger „ohne-code": der Join trifft jeden amtlichen Text.
    expect(v.zeilen.filter(z => z.grund === 'ohne-code')).toHaveLength(0);
  });

  it('trifft auch die gepflegten Varianten, wie der Export sie schreibt', () => {
    // „VN techn. geprüft", „Ablehnung", „Rücknahmeempfehlung" stehen so im
    // Export; der Katalog führt sie als Varianten am amtlichen Eintrag. Ohne
    // Varianten-Auflösung fielen sie im Vergleich als „ohne Code" heraus.
    const varianten = STATUS_CODE_KATALOG.flatMap(e => e.varianten.map(t => [e.code, t] as const));
    expect(varianten.length).toBeGreaterThan(0);
    const v = vergleichePhasen(seed, varianten.map(([c, t]) => verbund(`v${c}`, t)), HEUTE);
    expect(v.zeilen.filter(z => z.grund === 'ohne-code')).toHaveLength(0);
    for (const z of v.zeilen) {
      const erwartet = varianten.find(([, t]) => t === z.statusRoh)![0];
      expect(z.code).toBe(erwartet);
    }
  });

  it('jede Ursache ist eine der drei dokumentierten', () => {
    const erlaubt = new Set([
      'datum-laeuft-status-voraus', 'terminal-flag-zieht-vor', 'wert-selbst-anders-eingeordnet',
    ]);
    for (const m of ABWEICHUNGS_MUSTER) expect(erlaubt.has(m.ursache)).toBe(true);
  });

  it('ist deterministisch', () => {
    const alle = ABWEICHUNGS_MUSTER.flatMap(korpus);
    expect(JSON.stringify(abweichungsMuster(vergleichePhasen(seed, alle, HEUTE))))
      .toBe(JSON.stringify(abweichungsMuster(vergleichePhasen(seed, alle, HEUTE))));
  });
});
