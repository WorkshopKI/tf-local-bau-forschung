/**
 * Phase-3-Tests: Notizen-Roundtrip (strikt lokaler kv-Key) + strukturelle
 * „eine Wahrheit"-Sicherung des Config-Formulars (Popover UND Settings-Sektion
 * rendern DIESELBE WidgetConfigForm — Komponenten-DOM-Tests sind in der
 * node-only Vitest-Suite nicht möglich, daher Source-Scan als Guard).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IDBStore } from '@/core/services/storage/idb-store';
import { HOME_NOTIZEN_IDB_KEY, loadNotizen, saveNotizen } from '../notizenStore';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('Notizen-Store — Roundtrip + toleranter Read', () => {
  it('speichert und lädt Plaintext', async () => {
    const idb = new IDBStore();
    await idb.open();
    expect(await loadNotizen(idb)).toBe('');
    await saveNotizen(idb, 'SCULPT: vor Bewilligung Anlage 5 querchecken');
    expect(await loadNotizen(idb)).toBe('SCULPT: vor Bewilligung Anlage 5 querchecken');
  });

  it('leerer Text löscht den Key; Fremd-Werte → leere Notiz', async () => {
    const idb = new IDBStore();
    await idb.open();
    await saveNotizen(idb, 'x');
    await saveNotizen(idb, '');
    expect(await idb.get(HOME_NOTIZEN_IDB_KEY)).toBeNull();
    await idb.set(HOME_NOTIZEN_IDB_KEY, { kaputt: true });
    expect(await loadNotizen(idb)).toBe('');
  });
});

describe('WidgetConfigForm — eine Wahrheit (Popover ↔ Settings)', () => {
  const SRC = join(__dirname, '..', '..', '..', '..');

  it('WidgetQuickEdit und WidgetsSettingsSection rendern dieselbe Formular-Komponente', () => {
    const quickEdit = readFileSync(join(SRC, 'plugins', 'home', 'widgets', 'WidgetQuickEdit.tsx'), 'utf-8');
    const settings = readFileSync(join(SRC, 'plugins', 'einstellungen', 'WidgetsSettingsSection.tsx'), 'utf-8');
    expect(quickEdit).toContain('<WidgetConfigForm');
    expect(settings).toContain('<WidgetConfigForm');
    expect(quickEdit).toContain(`kontext="popover"`);
    expect(settings).toContain(`kontext="settings"`);
  });
});
