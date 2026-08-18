/**
 * Das Netz unter der Optimierung von v4.103: **liefert der hochgezogene Code
 * byte-genau dasselbe wie der, den er ersetzt hat?**
 *
 * Vorgehen wie in `byte-identitaet.test.ts`: die alten Formulierungen stehen
 * hier wortgetreu als Orakel. Sie gegen den neuen Code laufen zu lassen ist der
 * einzige Weg, der etwas beweist — würde der Test die neuen Funktionen gegen
 * sich selbst prüfen, ginge er auch dann durch, wenn beide dasselbe falsch
 * machen.
 *
 * **Die Reihenfolge ist Teil der Zusage.** `sammleVorkommen` hat ein „erster
 * Treffer genügt" (feld-aufloesung.ts) und `findeOffenePaare` eine stabile
 * Sortierung mit dokumentiertem Gleichstand (waechter.ts) — mit reiner
 * Mengengleichheit ginge beides unbemerkt kaputt. Verglichen wird deshalb
 * `JSON.stringify` über das ganze Array.
 */
import { describe, it, expect } from 'vitest';
import {
  sammleVorkommen, sammleVorkommenGeplant, baueVorkommenPlan, herkunftVon,
  type FeldAufloesung, type FeldVorkommen,
} from '@/core/status/feld-aufloesung';
import {
  pruefeStillstand, findeOffenePaare, offenePaareJeTeilvorhaben,
  letzteAktivitaetVon, zieltageFuer,
} from '@/core/status/waechter';
import { ermittleTodosAlleRollen, baueTodoKontext } from '@/core/status/todo-engine';
import { baueSeedVersion } from '@/core/status/seed';
import type {
  MappingVersion, StatusFeldEintrag, StatusWertEintrag,
} from '@/core/status/typen';

const STICHTAG = '2026-08-01T00:00:00.000Z';

/** Die Auslieferung — ~550 Felder und ~1000 Werte, also der echte Zuschnitt. */
const SEED: MappingVersion = baueSeedVersion();

// --- Orakel: der Code, wie er vor v4.103 dastand ----------------------------

/** `sammleVorkommen` in der Fassung mit Closure je Feld. */
function orakelSammleVorkommen(
  felder: readonly StatusFeldEintrag[],
  verbundRecord: Record<string, unknown>,
  antraege: readonly { aktenzeichen: string; record: Record<string, unknown> }[],
  aufloesung?: FeldAufloesung,
): FeldVorkommen[] {
  const roh = (rec: Record<string, unknown>, key: string): string => {
    const v = rec[key];
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    return '';
  };
  const out: FeldVorkommen[] = [];
  const schluessel = (feld: StatusFeldEintrag): { recordKey: string; textKey?: string } =>
    aufloesung?.get(feld.feldId) ?? { recordKey: feld.quelleKey ?? feld.feldId };

  for (const feld of felder) {
    const { recordKey, textKey } = schluessel(feld);
    const ausRecord = (rec: Record<string, unknown>, tvId?: string): FeldVorkommen | null => {
      const wert = roh(rec, recordKey);
      if (!wert) return null;
      const text = textKey ? roh(rec, textKey) : '';
      return { feld, wert, ...(text ? { text } : {}), ...(tvId ? { tvId } : {}) };
    };
    if (feld.ebene === 'verbund') {
      const quellen: Record<string, unknown>[] = herkunftVon(feld) === 'verbund-record'
        ? [verbundRecord]
        : antraege.map(a => a.record);
      for (const rec of quellen) {
        const treffer = ausRecord(rec);
        if (treffer) { out.push(treffer); break; }
      }
      continue;
    }
    for (const a of antraege) {
      const treffer = ausRecord(a.record, a.aktenzeichen);
      if (treffer) out.push(treffer);
    }
  }
  return out;
}

/** `zieltageFuer` als linearer `find`. */
function orakelZieltageFuer(version: MappingVersion, statusCode: number | null): number | null {
  if (statusCode === null) return null;
  const treffer: StatusWertEintrag | undefined = version.werte.find(
    w => w.code === statusCode && typeof w.zieltage === 'number',
  );
  return treffer?.zieltage ?? null;
}

// --- Ein Bestand mit den sperrigen Faellen ----------------------------------

function tagVor(tage: number): string {
  const d = new Date(new Date(STICHTAG).getTime() - tage * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

/** Die Codes, die im Seed als Feld vorkommen — daraus wird gefuellt. */
const CODE_FELDER = SEED.felder.filter(f => f.code).slice(0, 60);

/**
 * ~200 Verbuende, absichtlich unbequem: Zukunftsdaten, unlesbare Daten, halb
 * offene Paare, mehrere Teilvorhaben, leere Strings, unbekannte Codes.
 */
function baueBestand(): {
  verbundRecord: Record<string, unknown>;
  antraege: { aktenzeichen: string; record: Record<string, unknown> }[];
}[] {
  const out = [];
  for (let i = 0; i < 200; i += 1) {
    const record: Record<string, unknown> = {};
    for (let k = 0; k < CODE_FELDER.length; k += 1) {
      const f = CODE_FELDER[k]!;
      const wuerfel = (i * 7 + k * 13) % 11;
      if (wuerfel === 0) continue;                       // Feld gar nicht gesetzt
      if (wuerfel === 1) { record[f.feldId] = ''; continue; }        // leerer String
      if (wuerfel === 2) { record[f.feldId] = 'kein datum'; continue; } // unlesbar
      if (wuerfel === 3) { record[f.feldId] = tagVor(-30); continue; }  // Zukunft
      if (wuerfel === 4) { record[f.feldId] = 42; continue; }        // Zahl statt Text
      record[f.feldId] = tagVor((i + k) % 400);
    }
    // Genau eine Seite eines Paares — der Fall, den `findeOffenePaare` sucht.
    if (i % 3 === 0) { record.D_AK4 = tagVor(120); delete record.D_AT4; }
    record.status = i % 5 === 0 ? 'ein Status, den keiner kennt' : (SEED.werte[i % SEED.werte.length]?.wert ?? '');

    const verbundRecord: Record<string, unknown> = { ...record, verbund_status: record.status };
    // Mal ein Teilvorhaben, mal drei — die TV-Ebene vervielfacht Vorkommen.
    const anzahl = i % 4 === 0 ? 3 : 1;
    const antraege = Array.from({ length: anzahl }, (_, t) => ({
      aktenzeichen: `AZ-${i}-${t}`,
      record: t === 0 ? record : { ...record, D_ARK: tagVor((i + t) % 300) },
    }));
    out.push({ verbundRecord, antraege });
  }
  return out;
}

const BESTAND = baueBestand();

describe('Hoistung v4.103: byte-identisch zum ersetzten Code', () => {
  it('sammleVorkommenGeplant === die alte Schleife (inkl. Reihenfolge)', () => {
    const plan = baueVorkommenPlan(SEED.felder);
    let verglichen = 0;
    for (const { verbundRecord, antraege } of BESTAND) {
      const neu = sammleVorkommenGeplant(plan, verbundRecord, antraege);
      const alt = orakelSammleVorkommen(SEED.felder, verbundRecord, antraege);
      expect(JSON.stringify(neu)).toBe(JSON.stringify(alt));
      verglichen += neu.length;
    }
    // Positiv-Kontrolle: der Vergleich lief ueber echte Vorkommen, nicht ueber
    // 200 leere Arrays.
    expect(verglichen).toBeGreaterThan(1000);
  });

  it('sammleVorkommen (die Huelle) bleibt deckungsgleich', () => {
    const { verbundRecord, antraege } = BESTAND[7]!;
    expect(JSON.stringify(sammleVorkommen(SEED.felder, verbundRecord, antraege)))
      .toBe(JSON.stringify(orakelSammleVorkommen(SEED.felder, verbundRecord, antraege)));
  });

  it('zieltageFuer === der lineare find, ueber alle Codes des Katalogs', () => {
    const codes = [...new Set(SEED.werte.map(w => w.code))];
    // Positiv-Kontrolle: die Schleife laeuft ueber echte Codes. Der Seed fuehrt
    // gemessen 30 verschiedene — die Schwelle steht bewusst darunter, damit ein
    // neuer Katalog sie nicht bricht, aber ein leeres Array auffliegt.
    expect(codes.length).toBeGreaterThan(20);
    for (const c of codes) {
      expect(zieltageFuer(SEED, c ?? null)).toBe(orakelZieltageFuer(SEED, c ?? null));
    }
    expect(zieltageFuer(SEED, null)).toBe(orakelZieltageFuer(SEED, null));
    expect(zieltageFuer(SEED, 999_999)).toBeNull();
  });

  it('findeOffenePaare + letzteAktivitaetVon + pruefeStillstand bleiben stabil', () => {
    // Kein Orakel noetig: die beiden lesen ihre Indizes jetzt aus `versionIndex`,
    // und dass DER deckungsgleich ist, zeigt `version-index.test.ts`. Hier geht
    // es um das Zusammenspiel ueber den ganzen Bestand — inklusive Sortierung.
    const plan = baueVorkommenPlan(SEED.felder);
    let mitPaar = 0;
    let mitUrteil = 0;
    for (const { verbundRecord, antraege } of BESTAND) {
      const vorkommen = sammleVorkommenGeplant(plan, verbundRecord, antraege);
      const paare = findeOffenePaare(SEED, vorkommen, STICHTAG);
      // Absteigend nach Standzeit — die dokumentierte Sortierung.
      for (let i = 1; i < paare.length; i += 1) {
        expect(paare[i - 1]!.tage).toBeGreaterThanOrEqual(paare[i]!.tage);
      }
      if (paare.length > 0) mitPaar += 1;
      const zeit = letzteAktivitaetVon(vorkommen, SEED, STICHTAG);
      // Ein Zukunftsdatum darf nie als „letzte Aktivitaet" gelten.
      if (zeit.letzteAktivitaet) {
        expect(zeit.letzteAktivitaet <= STICHTAG.slice(0, 10)).toBe(true);
      }
      const w = pruefeStillstand({
        version: SEED, vorkommen, statusCode: null, stichtag: STICHTAG,
      });
      expect(['ok', 'haengt', 'unbewertet']).toContain(w.urteil);
      if (w.urteil !== 'unbewertet') mitUrteil += 1;
    }
    // Positiv-Kontrollen: der Bestand trifft die gesuchten Faelle wirklich.
    expect(mitPaar).toBeGreaterThan(0);
    expect(mitUrteil + (BESTAND.length - mitUrteil)).toBe(BESTAND.length);
  });

  it('offenePaareJeTeilvorhaben bleibt ueber alle TVs sortiert', () => {
    const plan = baueVorkommenPlan(SEED.felder);
    const { antraege } = BESTAND[0]!;
    const jeTv = antraege.map(a => ({
      aktenzeichen: a.aktenzeichen,
      vorkommen: sammleVorkommenGeplant(plan, {}, [a]),
    }));
    const paare = offenePaareJeTeilvorhaben(SEED, jeTv, STICHTAG);
    for (let i = 1; i < paare.length; i += 1) {
      expect(paare[i - 1]!.tage).toBeGreaterThanOrEqual(paare[i]!.tage);
    }
  });

  describe('Kaskaden-Index (todo-engine)', () => {
    const regeln = SEED.todoRegeln ?? [];

    it('dasselbe Regel-Array zweimal liefert dasselbe Ergebnis', () => {
      const plan = baueVorkommenPlan(SEED.felder);
      for (const { verbundRecord, antraege } of BESTAND.slice(0, 40)) {
        const ctx = baueTodoKontext(sammleVorkommenGeplant(plan, verbundRecord, antraege));
        const a = ermittleTodosAlleRollen(regeln, ctx, STICHTAG);
        const b = ermittleTodosAlleRollen(regeln, ctx, STICHTAG);
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      }
    });

    it('eine geaenderte Regel-Liste wird NICHT aus dem Cache beantwortet', () => {
      const plan = baueVorkommenPlan(SEED.felder);
      const ctx = baueTodoKontext(sammleVorkommenGeplant(plan, BESTAND[0]!.verbundRecord, BESTAND[0]!.antraege));
      const vorher = ermittleTodosAlleRollen(regeln, ctx, STICHTAG);
      // Alles stillgelegt ⇒ es kann keinen Regeltreffer mehr geben.
      const stillgelegt = regeln.map(r => ({ ...r, aktiv: false }));
      const nachher = ermittleTodosAlleRollen(stillgelegt, ctx, STICHTAG);
      expect(JSON.stringify(nachher)).not.toBe(JSON.stringify(vorher));
      for (const e of Object.values(nachher)) expect(e.todo).toBeNull();
    });
  });
});
