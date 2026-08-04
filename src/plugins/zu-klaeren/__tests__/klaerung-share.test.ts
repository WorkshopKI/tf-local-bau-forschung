/**
 * Was diese Datei festnagelt:
 *
 * 1. Der Stand entsteht aus ALLEN Autor-Dateien, nicht aus einer.
 * 2. Ein fehlendes Verzeichnis ist der Zustand „noch niemand", kein Fehler.
 * 3. Ein Eintrag landet in der Datei SEINES Autors — nie in einer fremden.
 *    Das ist die Zusage, die das Schreib-Rennen beseitigt.
 * 4. Fehlendes Schreibrecht kommt als `false` zurück, nicht als Erfolg.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Der gespiegelte Share: Verzeichnis → Dateien → Rohtext. */
const share: {
  dateien: Record<string, string>;
  schreibrecht: boolean;
} = { dateien: {}, schreibrecht: true };

vi.mock('@/core/status/sidecar-datei', () => ({
  listeSidecarDateien: (_idb: unknown, verzeichnis: string): Promise<string[]> =>
    Promise.resolve(
      Object.keys(share.dateien)
        .filter(p => p.startsWith(`${verzeichnis}/`))
        .map(p => p.slice(verzeichnis.length + 1))
        .sort(),
    ),
  leseSidecarText: (_idb: unknown, pfad: string): Promise<string | null> =>
    Promise.resolve(share.dateien[pfad] ?? null),
  haengeAnSidecar: (_idb: unknown, pfad: string, zeilen: string): Promise<boolean> => {
    if (!share.schreibrecht) return Promise.resolve(false);
    const vorher = share.dateien[pfad];
    share.dateien[pfad] = vorher === undefined ? `${zeilen}\n` : `${vorher}${zeilen}\n`;
    return Promise.resolve(true);
  },
}));

const { leseKlaerung, haengeEintragAn } = await import('@/plugins/zu-klaeren/klaerung-share');
const { baueEintrag } = await import('@/plugins/zu-klaeren/fold');
const { urteilSchluessel } = await import('@/plugins/zu-klaeren/typen');

const IDB = {} as never;
const KL = 'phasenschnitt-2026-08';
const DIR = `_intern/klaerung/${KL}`;

beforeEach(() => { share.dateien = {}; share.schreibrecht = true; });

describe('leseKlaerung (je Autor eine Datei)', () => {
  it('setzt die Einträge aller Autor-Dateien zusammen', async () => {
    share.dateien[`${DIR}/MUE.jsonl`] =
      `${JSON.stringify({ ts: 'T1', autor: 'MUE', punktId: 'code-38', urteil: 'passt' })}\n`;
    share.dateien[`${DIR}/SCH.jsonl`] =
      `${JSON.stringify({ ts: 'T2', autor: 'SCH', punktId: 'code-38', urteil: 'unklar' })}\n`;

    const { stand, dateien } = await leseKlaerung(IDB, KL);
    expect(dateien).toBe(2);
    expect(stand.urteile.get(urteilSchluessel('MUE', 'code-38'))?.urteil).toBe('passt');
    expect(stand.urteile.get(urteilSchluessel('SCH', 'code-38'))?.urteil).toBe('unklar');
  });

  it('ein fehlendes Verzeichnis ergibt einen leeren Stand, keinen Fehler', async () => {
    const { stand, dateien } = await leseKlaerung(IDB, KL);
    expect(dateien).toBe(0);
    expect(stand.urteile.size).toBe(0);
    expect(stand.kommentare.size).toBe(0);
  });

  it('ignoriert Fremddateien, die nicht auf .jsonl enden', async () => {
    share.dateien[`${DIR}/liesmich.txt`] = 'kein JSONL';
    share.dateien[`${DIR}/MUE.jsonl`] =
      `${JSON.stringify({ ts: 'T1', autor: 'MUE', punktId: 'code-38', urteil: 'passt' })}\n`;
    expect((await leseKlaerung(IDB, KL)).dateien).toBe(1);
  });

  it('eine kaputte Zeile in EINER Datei kostet nicht die anderen', async () => {
    share.dateien[`${DIR}/MUE.jsonl`] = '{ kaputt\n';
    share.dateien[`${DIR}/SCH.jsonl`] =
      `${JSON.stringify({ ts: 'T2', autor: 'SCH', punktId: 'code-38', urteil: 'passt' })}\n`;
    const { stand } = await leseKlaerung(IDB, KL);
    expect(stand.urteile.get(urteilSchluessel('SCH', 'code-38'))?.urteil).toBe('passt');
  });
});

describe('haengeEintragAn (Fehlschlag ist ein Rückgabewert, kein Wurf)', () => {
  it('schreibt genau eine Zeile in die Datei des Autors', async () => {
    const ok = await haengeEintragAn(IDB, KL, baueEintrag({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }, 'T'));
    expect(ok).toBe(true);
    expect(Object.keys(share.dateien)).toEqual([`${DIR}/MUE.jsonl`]);
    expect(share.dateien[`${DIR}/MUE.jsonl`]?.trim().split('\n')).toHaveLength(1);
  });

  it('schreibt niemals in die Datei eines anderen Autors', async () => {
    await haengeEintragAn(IDB, KL, baueEintrag({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }, 'T'));
    await haengeEintragAn(IDB, KL, baueEintrag({ autor: 'SCH', punktId: 'code-38', urteil: 'unklar' }, 'T'));
    expect(Object.keys(share.dateien).sort()).toEqual([`${DIR}/MUE.jsonl`, `${DIR}/SCH.jsonl`]);
  });

  it('legt Umlaut-Kürzel unter einem lesbaren ASCII-Namen ab', async () => {
    await haengeEintragAn(IDB, KL, baueEintrag({ autor: 'THÜ', punktId: 'code-38', urteil: 'passt' }, 'T'));
    expect(Object.keys(share.dateien)).toEqual([`${DIR}/THUE.jsonl`]);
  });

  it('gibt false zurück, wenn das Schreibrecht fehlt', async () => {
    share.schreibrecht = false;
    const ok = await haengeEintragAn(IDB, KL, baueEintrag({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }, 'T'));
    expect(ok).toBe(false);
    expect(Object.keys(share.dateien)).toEqual([]);
  });

  it('mehrere Antworten desselben Autors hängen an, statt zu ersetzen', async () => {
    await haengeEintragAn(IDB, KL, baueEintrag({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }, 'T1'));
    await haengeEintragAn(IDB, KL, baueEintrag({ autor: 'MUE', punktId: 'code-38', urteil: 'zurueckgezogen' }, 'T2'));
    expect(share.dateien[`${DIR}/MUE.jsonl`]?.trim().split('\n')).toHaveLength(2);
    const { stand } = await leseKlaerung(IDB, KL);
    expect(stand.urteile.get(urteilSchluessel('MUE', 'code-38'))?.urteil).toBe('zurueckgezogen');
  });
});
