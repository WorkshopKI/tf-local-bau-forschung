/**
 * Die Herkunft einer Vorgabe — der Satz, der sagt, WARUM es diese Zahl gibt.
 *
 * Sie ist reiner Anzeige-Text und trotzdem der empfindlichste Teil dieser Kette,
 * weil sie durch vier Stationen muss, die jede für sich Felder verlieren können:
 * Laden (`normalize` baut Vorgaben FELDWEISE neu), Materialisieren
 * (`vorgabenZuRegeln` baut die synthetische Regel FELDWEISE), Prüfen
 * (`runRegelChecks` baut das `CheckResult` FELDWEISE) und Migrieren.
 *
 * Fällt sie an einer dieser Stationen weg, merkt es niemand: es fehlt kein Fehler,
 * es fehlt nur eine Erklärung. Deshalb ist jede Station hier einzeln festgenagelt.
 */
import { describe, expect, it } from 'vitest';
import { normalizeRegistryFile } from '../storage';
import { vorgabenZuRegeln } from '../vorgaben';
import { runRegelChecks } from '../check-engine';
import { resolveRegeln } from '../selectors';
import { reconcileEinmaligeAktivierungen, GA_A_ZEICHEN_HERKUNFT_MIGRATION } from '../migrations';
import {
  KURZFASSUNG_SKILL_ID, SEED_SKILL,
  A_ZEICHEN_MAX, A_ZEICHEN_MAX_ALT, A_ZEICHEN_HERKUNFT,
} from '../seed';
import type { QualitaetsRegel, SkillRecord, SkillRegistryFile } from '../types';

const GRUND = 'Formularfeld der Fachprüfung — fasst max. 1.200 Zeichen.';

function skill(over: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id: KURZFASSUNG_SKILL_ID, name: 'A', beschreibung: '', version: 1, promptTemplate: 'P',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: 't', ...over,
  };
}

function file(skills: SkillRecord[], regeln: QualitaetsRegel[] = []): SkillRegistryFile {
  return { version: 1, updated_at: 't', skills, regeln };
}

describe('Herkunft überlebt das Laden', () => {
  it('an der Bibliotheks-Regel', () => {
    const roh = file([], [{
      id: 'r1', name: 'Regel', typ: 'zeichen_max', params: { max: 900 },
      schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't',
      herkunft: GRUND,
    }]);
    expect(normalizeRegistryFile(roh)!.regeln[0]!.herkunft).toBe(GRUND);
  });

  it('an der Skill-Vorgabe — die Station, die Vorgaben feldweise neu baut', () => {
    const roh = file([skill({ vorgaben: { zeichenMax: { schweregrad: 'fehler', max: 900, herkunft: GRUND } } })]);
    expect(normalizeRegistryFile(roh)!.skills[0]!.vorgaben?.zeichenMax?.herkunft).toBe(GRUND);
  });

  it('leere und weiße Herkunft wird nicht persistiert (kein Feld statt leerem Feld)', () => {
    const roh = file(
      [skill({ vorgaben: { zeichenMax: { schweregrad: 'fehler', max: 900, herkunft: '   ' } } })],
      [{
        id: 'r1', name: 'R', typ: 'zeichen_max', params: { max: 900 },
        schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't', herkunft: '',
      }],
    );
    const out = normalizeRegistryFile(roh)!;
    expect(out.skills[0]!.vorgaben?.zeichenMax).not.toHaveProperty('herkunft');
    expect(out.regeln[0]).not.toHaveProperty('herkunft');
  });
});

describe('Herkunft reist bis an die Prüfung', () => {
  it('vorgabenZuRegeln hängt sie an die synthetische Regel', () => {
    const regeln = vorgabenZuRegeln('s', { zeichenMax: { schweregrad: 'fehler', max: 900, herkunft: GRUND } }, 't');
    expect(regeln[0]!.herkunft).toBe(GRUND);
  });

  it('ohne Herkunft trägt die synthetische Regel das Feld gar nicht', () => {
    const regeln = vorgabenZuRegeln('s', { zeichenMax: { schweregrad: 'fehler', max: 900 } }, 't');
    expect(regeln[0]).not.toHaveProperty('herkunft');
  });

  it('runRegelChecks stempelt sie auf das CheckResult — auch bei erfüllter Regel', () => {
    const regeln = vorgabenZuRegeln('s', { zeichenMax: { schweregrad: 'fehler', max: 900, herkunft: GRUND } }, 't');
    const [ok] = runRegelChecks('kurz', regeln);
    const [verletzt] = runRegelChecks('x'.repeat(2000), regeln);
    expect(ok!.level).toBe('ok');
    expect(ok!.herkunft).toBe(GRUND);
    expect(verletzt!.level).toBe('fehler');
    expect(verletzt!.herkunft).toBe(GRUND);
  });

  it('der ganze Weg Skill → resolveRegeln → Check', () => {
    const s = skill({ vorgaben: { zeichenMax: { schweregrad: 'fehler', max: 900, herkunft: GRUND } } });
    const checks = runRegelChecks('kurz', resolveRegeln(file([s]), s));
    expect(checks.find(c => c.herkunft === GRUND)).toBeDefined();
  });
});

describe('A: Zeichenlimit 1.100 mit Herkunft', () => {
  /**
   * Alle Marker AUSSER dem geprüften — so läuft genau EINE Migration. Die Liste wird
   * abgeleitet statt abgeschrieben: ein leerer Stand lässt jede Migration einmal
   * laufen und hinterlässt ihren Marker. Eine später hinzugefügte Migration könnte
   * die Isolation dieses Tests sonst still aufheben.
   */
  const ALLE_MARKER = reconcileEinmaligeAktivierungen(file([])).file.angewandteMigrationen ?? [];
  const nurDiese = (skills: SkillRecord[]): SkillRegistryFile => ({
    ...file(skills),
    angewandteMigrationen: ALLE_MARKER.filter(m => m !== GA_A_ZEICHEN_HERKUNFT_MIGRATION),
  });

  it('der Seed selbst trägt 1.100 und den Grund', () => {
    expect(SEED_SKILL.vorgaben?.zeichenMax?.max).toBe(A_ZEICHEN_MAX);
    expect(SEED_SKILL.vorgaben?.zeichenMax?.herkunft).toBe(A_ZEICHEN_HERKUNFT);
    expect(A_ZEICHEN_MAX).toBeGreaterThan(A_ZEICHEN_MAX_ALT);
    // Die Obergrenze muss unter dem harten Rand des Formularfelds bleiben.
    expect(A_ZEICHEN_MAX).toBeLessThan(1200);
  });

  it('pristiner Stand 1.000 → 1.100 samt Grund, Version steigt auf 4', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(nurDiese([
      skill({ version: 3, vorgaben: { zeichenMax: { schweregrad: 'fehler', max: A_ZEICHEN_MAX_ALT } } }),
    ]));
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.vorgaben?.zeichenMax?.max).toBe(A_ZEICHEN_MAX);
    expect(out.skills[0]!.vorgaben?.zeichenMax?.herkunft).toBe(A_ZEICHEN_HERKUNFT);
    expect(out.skills[0]!.version).toBe(4);
  });

  it('ein selbst verschobener Wert bleibt stehen — bekommt aber seinen Grund', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(nurDiese([
      skill({ vorgaben: { zeichenMax: { schweregrad: 'fehler', max: 850 } } }),
    ]));
    expect(out.skills[0]!.vorgaben?.zeichenMax?.max).toBe(850);
    expect(out.skills[0]!.vorgaben?.zeichenMax?.herkunft).toBe(A_ZEICHEN_HERKUNFT);
  });

  it('ein selbst geschriebener Grund wird nicht überschrieben', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(nurDiese([
      skill({ vorgaben: { zeichenMax: { schweregrad: 'fehler', max: A_ZEICHEN_MAX_ALT, herkunft: 'Eigene Festlegung' } } }),
    ]));
    expect(out.skills[0]!.vorgaben?.zeichenMax?.herkunft).toBe('Eigene Festlegung');
    // …der Wert steigt trotzdem: die beiden Teile sind unabhängig geschützt.
    expect(out.skills[0]!.vorgaben?.zeichenMax?.max).toBe(A_ZEICHEN_MAX);
  });

  it('andere Skills bleiben unberührt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(nurDiese([
      skill({ id: 'gutachten-risiken', vorgaben: { zeichenMax: { schweregrad: 'fehler', max: A_ZEICHEN_MAX_ALT } } }),
    ]));
    expect(out.skills[0]!.vorgaben?.zeichenMax?.max).toBe(A_ZEICHEN_MAX_ALT);
    expect(out.skills[0]!.vorgaben?.zeichenMax).not.toHaveProperty('herkunft');
  });

  it('läuft nur einmal — ein späterer Kurator-Edit bleibt stehen', () => {
    const einmal = reconcileEinmaligeAktivierungen(nurDiese([
      skill({ vorgaben: { zeichenMax: { schweregrad: 'fehler', max: A_ZEICHEN_MAX_ALT } } }),
    ])).file;
    expect(einmal.angewandteMigrationen).toContain(GA_A_ZEICHEN_HERKUNFT_MIGRATION);

    const spaeterEditiert: SkillRegistryFile = {
      ...einmal,
      skills: [{ ...einmal.skills[0]!, vorgaben: { zeichenMax: { schweregrad: 'fehler', max: 700, herkunft: 'neu' } } }],
    };
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(spaeterEditiert);
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.vorgaben?.zeichenMax?.max).toBe(700);
    expect(out.skills[0]!.vorgaben?.zeichenMax?.herkunft).toBe('neu');
  });
});
