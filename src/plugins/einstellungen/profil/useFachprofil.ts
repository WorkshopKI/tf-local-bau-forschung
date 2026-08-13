/**
 * Zustand + Auto-Save des Fachprofils (bis v4.28 in `MeineTechnologienTab`).
 *
 * Hier liegt die gesamte Hydration/Speicher-Mechanik, damit die Gruppen
 * darüber reine Darstellung bleiben — und damit „Account" dieselben Werte
 * (Programm-Id, Hauptkategorie, Antragstypen) für seine Zusammenfassungszeile
 * lesen kann, ohne sie ein zweites Mal zu laden.
 *
 * Reihenfolge der Quellen unverändert: das persönliche Profil aus dem eigenen
 * Ordner ist autoritativ (Cross-Browser-Source-of-Truth); nur wenn es keins
 * gibt, wird aus `auslastung.json` nachhydriert.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import {
  aggregateMaProfileFromLookup,
  loadAuslastungProfil,
  resolveAnonIdForUser,
  writeAuslastungProfil,
} from '@/plugins/auslastung/services/identitaet';
import type {
  AnonymerMitarbeiter,
  AntragstypBucket,
  PersoenlichesAuslastungProfil,
  UeberKategorie,
} from '@/plugins/auslastung/types';

export interface Fachprofil {
  /** Anonyme Programm-Id oder null, solange kein Kürzel hinterlegt ist. */
  anonId: string | null;
  kategorien: UeberKategorie[];
  hauptKategorie: string;
  nebenKategorien: string[];
  antragstypBevorzugt: AntragstypBucket[];
  /** Aus den bisherigen Anträgen abgeleitete Themen. */
  autoTags: string[];
  ausgeblendeteAutoTags: string[];
  manuelleTags: string[];
  /** MA-Record des eigenen Kürzels — trägt den PL-Override. */
  eigenerMa: AnonymerMitarbeiter | undefined;
  setzeHaupt: (id: string) => void;
  toggleNeben: (id: string) => void;
  toggleAntragstyp: (bucket: AntragstypBucket) => void;
  toggleAutoTag: (tag: string) => void;
  setzeManuelleTags: (tags: string[]) => void;
  speichert: boolean;
  speicherFehler: string | null;
  /** ISO-Zeitpunkt des letzten erfolgreichen Schreibens (null = noch keins). */
  gespeichertUm: string | null;
}

export function useFachprofil(): Fachprofil {
  const storage = useStorage();
  const meinKuerzel = useMeinKuerzel();
  const data = useAuslastungData(s => s.data);
  const config = useAuslastungData(s => s.data.config);
  const load = useAuslastungData(s => s.load);
  const cache = useAntraegeCache();

  const [manualTags, setManualTags] = useState<string[]>([]);
  const [excludedAutoTags, setExcludedAutoTags] = useState<string[]>([]);
  const [hauptKategorie, setHauptKategorie] = useState<string>('');
  const [nebenKategorien, setNebenKategorien] = useState<string[]>([]);
  const [antragstypBevorzugt, setAntragstypBevorzugt] = useState<AntragstypBucket[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** null = noch nicht geladen, true = persönliches Profil existierte (autoritativ),
   *  false = keins → Fallback-Hydration aus auslastung.json erlaubt. */
  const [hasPersonalProfil, setHasPersonalProfil] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const profil = await loadAuslastungProfil(storage.idb, persHandle);
      if (cancelled) return;
      if (profil) {
        setManualTags(profil.manuelleTechnologien ?? []);
        setExcludedAutoTags(profil.ausgeblendeteAutoTags ?? []);
        setHauptKategorie(profil.hauptKategorie ?? '');
        setNebenKategorien(profil.nebenKategorien ?? []);
        setAntragstypBevorzugt(profil.antragstypBevorzugt ?? []);
      }
      setHasPersonalProfil(!!profil);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  useEffect(() => { void load(storage); }, [storage, load]);

  const myAnonId = resolveAnonIdForUser(meinKuerzel, cache.anonymMap);

  // Fallback-Hydration aus `auslastung.json` — NUR wenn kein persönliches
  // Profil existiert. Sonst ist das persönliche Profil autoritativ und darf
  // nicht vom ggf. veralteten auslastung.json-Record überschrieben werden.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (hasPersonalProfil !== false) return;
    if (!myAnonId) return;
    if (hydratedRef.current === myAnonId) return;
    const existing = data.mitarbeiter[myAnonId];
    if (!existing) return;
    setExcludedAutoTags(existing.ausgeblendeteAutoTags ?? []);
    setHauptKategorie(existing.hauptKategorie ?? '');
    setNebenKategorien(existing.nebenKategorien ?? []);
    setAntragstypBevorzugt(existing.antragstypBevorzugt ?? []);
    hydratedRef.current = myAnonId;
  }, [myAnonId, data.mitarbeiter, hasPersonalProfil]);

  const automatic = useMemo(() => {
    if (!meinKuerzel) return [];
    return aggregateMaProfileFromLookup(cache.antraege, cache.deskriptorenByAz, meinKuerzel);
  }, [cache.antraege, cache.deskriptorenByAz, meinKuerzel]);

  // Auto-Save: `dirtyRef` wird NUR von User-Mutatoren gesetzt (nicht von der
  // Hydration), damit Laden/Browser-Wechsel keinen Save auslöst.
  const dirtyRef = useRef(false);
  const markDirty = (): void => { dirtyRef.current = true; };

  // Schreibt das Selbst-Profil in den persönlichen Ordner (immer readwrite).
  // Direktschreiben nach auslastung.json scheitert für Nicht-Kuratoren am
  // Read-Only-Daten-Share — die PL sammelt die Profile ein (Pitfall #24).
  const saveAction = useAsyncAction(async () => {
    const kuerzel = meinKuerzel?.trim();
    if (!kuerzel || kuerzel.toLowerCase() === 'alle') {
      throw new Error('Kein Bearbeiter-Kürzel hinterlegt — bitte rechts unter „Welche Anträge du siehst" eintragen bzw. anmelden.');
    }
    const profil: PersoenlichesAuslastungProfil = {
      version: 1,
      kuerzel,
      manuelleTechnologien: manualTags,
      ausgeblendeteAutoTags: excludedAutoTags,
      hauptKategorie,
      nebenKategorien,
      antragstypBevorzugt,
      updatedAt: new Date().toISOString(),
    };
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    await writeAuslastungProfil(storage.idb, persHandle, profil);
    setHasPersonalProfil(true);
    setSavedAt(new Date().toISOString());
  });

  // Stabiler Save-Aufruf über Ref — vermeidet Stale-Closure + Dep-Churn im
  // Debounce-Effekt (die `run`-Identität ändert sich pro Render).
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = () => { void saveAction.run(); };
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) return;
    pendingRef.current = true;
    const t = setTimeout(() => { pendingRef.current = false; saveRef.current(); }, 800);
    return () => clearTimeout(t);
  }, [manualTags, excludedAutoTags, hauptKategorie, nebenKategorien, antragstypBevorzugt]);

  // Flush beim Verlassen: ausstehenden Debounce sofort schreiben, damit die
  // letzte Eingabe bei schnellem Seitenwechsel nicht verloren geht.
  useEffect(() => () => { if (pendingRef.current) saveRef.current(); }, []);

  return {
    anonId: myAnonId,
    kategorien: config.ueberKategorien,
    hauptKategorie,
    nebenKategorien,
    antragstypBevorzugt,
    autoTags: automatic,
    ausgeblendeteAutoTags: excludedAutoTags,
    manuelleTags: manualTags,
    eigenerMa: myAnonId ? data.mitarbeiter[myAnonId] : undefined,
    setzeHaupt: (id: string) => {
      // Neue Hauptkategorie darf nicht gleichzeitig Nebenkategorie bleiben.
      markDirty();
      setHauptKategorie(id);
      setNebenKategorien(prev => prev.filter(x => x !== id));
    },
    toggleNeben: (id: string) => {
      if (id === hauptKategorie) return;
      markDirty();
      setNebenKategorien(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    },
    toggleAntragstyp: (bucket: AntragstypBucket) => {
      markDirty();
      setAntragstypBevorzugt(prev => (prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket]));
    },
    toggleAutoTag: (tag: string) => {
      markDirty();
      setExcludedAutoTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
    },
    setzeManuelleTags: (tags: string[]) => { markDirty(); setManualTags(tags); },
    speichert: saveAction.busy,
    speicherFehler: saveAction.error,
    gespeichertUm: savedAt,
  };
}
