/**
 * Orchestrator der einfachen ZIP-Aufnahme (Teil A). KEIN LLM, KEINE Indexierung,
 * KEINE Triage-Pipeline. Drop → Parse (zipDurchlauf/loseDatei) → Triage-Liste →
 * „Konvertieren & ablegen": Original-ZIP nach `eingang/`, Manifest, dann
 * SEQUENZIELL je Datei Converter → `antraege/{FKZ}/dokumente/{name}.md`.
 *
 * IO-Glue über getestete reine Module; self-catching via `useAsyncAction`.
 */
import { useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { DocConverter } from '@/core/services/converter';
import { uuid } from '@/core/services/id-generator';
import { extractFkzTolerant, isValidFkz } from '@/phase2/matcher/fkz-extractor';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import {
  copyZipToEingang, writeDokumentMarkdown, writeManifest,
} from '@/core/services/personal-storage/antraege-eingang';
import { leeresManifest, setDateiStatus, type EingangManifest } from './manifest';
import { typVorschlag } from './dateiTyp';
import { zipDurchlauf, loseDatei, type ZipDatei } from './zip-durchlauf';
import type { AbschlussInfo, Fortschritt, IntakeFile } from './types';

const converter = new DocConverter();

export interface UseAufnahme {
  items: IntakeFile[];
  meldungen: string[];
  fortschritt: Fortschritt | null;
  abschluss: AbschlussInfo | null;
  addDrop: (files: File[]) => Promise<void>;
  setFkz: (localId: string, fkz: string) => void;
  setTyp: (localId: string, typ: IntakeFile['typ']) => void;
  entfernen: (localId: string) => void;
  konvertieren: UseAsyncActionResult<[]>;
  abbrechen: () => void;
  reset: () => void;
  istValiderFkz: (fkz: string) => boolean;
}

export function useAufnahme(): UseAufnahme {
  const storage = useStorage();
  const [items, setItems] = useState<IntakeFile[]>([]);
  const [meldungen, setMeldungen] = useState<string[]>([]);
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null);
  const [abschluss, setAbschluss] = useState<AbschlussInfo | null>(null);
  /** Original-ZIP-Blobs je Bundle-Name (für die eingang/-Kopie). */
  const bundlesRef = useRef<Map<string, Blob>>(new Map());
  const abortRef = useRef(false);

  const patch = (localId: string, p: Partial<IntakeFile>): void =>
    setItems(prev => prev.map(it => (it.localId === localId ? { ...it, ...p } : it)));

  const toIntake = (d: ZipDatei, bundleName?: string): IntakeFile => ({
    localId: uuid(),
    file: d.file,
    name: d.name,
    fkz: extractFkzTolerant(d.name)?.fkz ?? null,
    typ: typVorschlag(d.name),
    status: 'bereit',
    ...(bundleName ? { bundleName } : {}),
  });

  const addDrop = async (files: File[]): Promise<void> => {
    const neueItems: IntakeFile[] = [];
    const neueMeldungen: string[] = [];
    for (const f of files) {
      try {
        if (f.name.toLowerCase().endsWith('.zip')) {
          const zipname = f.name.replace(/\.zip$/i, '');
          bundlesRef.current.set(zipname, f);
          const erg = await zipDurchlauf(f);
          for (const d of erg.dateien) neueItems.push(toIntake(d, zipname));
          for (const u of erg.uebersprungen) neueMeldungen.push(`Übersprungen: ${u}`);
          for (const a of erg.abgelehnt) neueMeldungen.push(`Abgelehnt: ${a.name} — ${a.grund}`);
        } else {
          const erg = loseDatei(f);
          for (const d of erg.dateien) neueItems.push(toIntake(d));
          for (const a of erg.abgelehnt) neueMeldungen.push(`Abgelehnt: ${a.name} — ${a.grund}`);
        }
      } catch (err) {
        neueMeldungen.push(`Fehler beim Lesen von ${f.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setItems(prev => [...prev, ...neueItems]);
    if (neueMeldungen.length) setMeldungen(prev => [...prev, ...neueMeldungen]);
  };

  const setFkz = (localId: string, fkz: string): void => patch(localId, { fkz: fkz.trim() || null });
  const setTyp = (localId: string, typ: IntakeFile['typ']): void => patch(localId, { typ });
  const entfernen = (localId: string): void => setItems(prev => prev.filter(it => it.localId !== localId));

  const abbrechen = (): void => { abortRef.current = true; };

  const reset = (): void => {
    bundlesRef.current = new Map();
    abortRef.current = false;
    setItems([]); setMeldungen([]); setFortschritt(null); setAbschluss(null);
  };

  const ablegbar = (it: IntakeFile): boolean => !!it.fkz && isValidFkz(it.fkz) && it.typ !== 'unklar';

  const doKonvertieren = async (): Promise<void> => {
    abortRef.current = false;
    setAbschluss(null);
    const root = await getPersoenlichHandle(storage.idb);
    if (!root) throw new Error('Kein persönlicher Ordner verbunden — bitte zuerst einbinden.');

    const zuKonvertieren = items.filter(ablegbar);

    // 1. Original-ZIPs nach eingang/ + Manifeste (vor der Verarbeitung).
    const manifests = new Map<string, EingangManifest>();
    for (const [zipname, blob] of bundlesRef.current) {
      const memberNames = items.filter(it => it.bundleName === zipname).map(it => it.name);
      if (memberNames.length === 0) continue;
      await copyZipToEingang(root, zipname, blob);
      const m = leeresManifest(zipname, memberNames);
      manifests.set(zipname, m);
      await writeManifest(root, m);
    }

    const setManifest = async (bundleName: string, name: string, status: 'konvertiert' | 'fehlgeschlagen' | 'uebersprungen'): Promise<void> => {
      const m = manifests.get(bundleName);
      if (!m) return;
      const next = setDateiStatus(m, name, status);
      manifests.set(bundleName, next);
      await writeManifest(root, next);
    };

    // 2. Sequenziell konvertieren + ablegen.
    let done = 0;
    let konvertiert = 0, fehlgeschlagen = 0;
    const fkzMitVb = new Set<string>();
    for (const it of zuKonvertieren) {
      if (abortRef.current) break;
      setFortschritt({ aktuell: done, gesamt: zuKonvertieren.length, name: it.name });
      patch(it.localId, { status: 'konvertiere', error: undefined });
      try {
        const converted = await converter.convert(it.file);
        const now = new Date().toISOString();
        await writeDokumentMarkdown(root, it.fkz!, { fkz: it.fkz!, typ: it.typ, quelle: it.name, konvertiert_am: now }, converted.markdown);
        patch(it.localId, { status: 'konvertiert' });
        konvertiert++;
        if (it.typ === 'vorhabensbeschreibung') fkzMitVb.add(it.fkz!);
        if (it.bundleName) await setManifest(it.bundleName, it.name, 'konvertiert');
      } catch (err) {
        patch(it.localId, { status: 'fehlgeschlagen', error: err instanceof Error ? err.message : String(err) });
        fehlgeschlagen++;
        if (it.bundleName) await setManifest(it.bundleName, it.name, 'fehlgeschlagen');
      }
      done++;
    }

    // 3. Nicht-ablegbare Bundle-Mitglieder als „uebersprungen" markieren → Bundle wird löschbar.
    let uebersprungen = 0;
    for (const it of items) {
      if (!it.bundleName || ablegbar(it)) continue;
      if (it.status === 'konvertiert' || it.status === 'fehlgeschlagen') continue;
      patch(it.localId, { status: 'uebersprungen' });
      uebersprungen++;
      await setManifest(it.bundleName, it.name, 'uebersprungen');
    }

    setFortschritt(null);
    setAbschluss({ konvertiert, fehlgeschlagen, uebersprungen, fkzMitVb: [...fkzMitVb] });
  };

  const konvertieren = useAsyncAction(doKonvertieren);

  return {
    items, meldungen, fortschritt, abschluss,
    addDrop, setFkz, setTyp, entfernen, konvertieren, abbrechen, reset,
    istValiderFkz: isValidFkz,
  };
}
