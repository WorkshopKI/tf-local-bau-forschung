/**
 * Zentraler Auslastungs-Store (Zustand).
 *
 * Faehrt die `auslastung.json`-Datei vom SMB-Share als In-Memory-State und
 * bietet typsichere Mutator-Helfer. Schreibt nach jeder Mutation zurueck
 * (Last-Write-Wins).
 *
 * Subscriber: alle Auslastungs-Tabs + die "Meine Technologien"-Section im
 * Profil.
 */
import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import {
  loadAuslastungData,
  saveAuslastungData,
} from '../services/auslastung-store';
import {
  DEFAULT_JAHRESKAPAZITAET,
  emptyAuslastungData,
  type AuslastungConfig,
  type AuslastungData,
  type AnonymerMitarbeiter,
  type KalibrierungsErgebnis,
  type KalibrierungsState,
  type Klassifizierung,
  type UeberKategorie,
  type Zuweisung,
} from '../types';
import { nextFreeAnonId } from '../services/anonym-map';

interface AuslastungDataState {
  data: AuslastungData;
  loading: boolean;
  loaded: boolean;
  saving: boolean;
  /** True wenn waehrend eines laufenden Saves eine weitere Mutation kam —
   *  loest nach dem aktuellen Save einen Nachschreib-Durchlauf aus (kein Drop,
   *  Pitfall #16/#20). */
  persistDirty: boolean;
  error: string | null;
  /** Initial-Load — idempotent, kann beliebig oft aufgerufen werden. */
  load: (storage: StorageService) => Promise<void>;
  /** Persistiert das gesamte data-Objekt sofort zurueck auf den Share. */
  persist: (storage: StorageService) => Promise<void>;
  /** Interne Save-Logik: cleart den Debounce-Timer, schreibt (oder markiert
   *  persistDirty falls bereits ein Save laeuft) und schreibt bei gesetztem
   *  persistDirty hinterher nach. Von persist/schedulePersist/flushPersist genutzt. */
  persistNow: (storage: StorageService) => Promise<void>;
  /** Debounced Persist (~600 ms) — coalesct rapide Mutationen (Pill-Klicks)
   *  zu einem SMB-Write. */
  schedulePersist: (storage: StorageService) => void;
  /** Schreibt einen ausstehenden Debounce-Write sofort (Unmount/App-Close). */
  flushPersist: (storage: StorageService) => Promise<void>;
  // ── Config ────────────────────────────────────────────────────────────
  updateConfig: (storage: StorageService, partial: Partial<AuslastungConfig>) => Promise<void>;
  // ── Ueberkategorien ──────────────────────────────────────────────────
  upsertKategorie: (storage: StorageService, k: UeberKategorie) => Promise<void>;
  removeKategorie: (storage: StorageService, kategorieId: string) => Promise<void>;
  // ── Mitarbeiter ──────────────────────────────────────────────────────
  upsertMitarbeiter: (storage: StorageService, ma: AnonymerMitarbeiter) => Promise<void>;
  createMitarbeiter: (storage: StorageService, init?: Partial<AnonymerMitarbeiter>) => Promise<AnonymerMitarbeiter>;
  removeMitarbeiter: (storage: StorageService, anonId: string) => Promise<void>;
  /** Toggle aktiv-Flag fuer einen einzelnen MA. No-op wenn MA nicht existiert
   *  oder Flag bereits den Zielwert hat (verhindert unnoetige Saves). */
  setMitarbeiterAktiv: (storage: StorageService, anonId: string, aktiv: boolean) => Promise<void>;
  /** Bulk: setzt aktiv-Flag fuer mehrere MAs in EINEM setState + persist.
   *  Wird vom Auto-Vorschlag-Banner genutzt (sonst N persist-Roundtrips
   *  durch den `if (saving) return`-Lock raus, siehe CLAUDE.md Lesson 16). */
  applyAktivMap: (storage: StorageService, aktivById: Record<string, boolean>) => Promise<void>;
  /** Stellt sicher, dass fuer jede anonId aus der Kuerzel-Map ein
   *  `data.mitarbeiter`-Eintrag existiert. Fehlende MAs werden mit
   *  Default-Werten (aktiv: true) angelegt — EIN setState + EIN persist
   *  (Lesson 16). No-op wenn alles schon da ist. */
  ensureMitarbeiterForAnonIds: (storage: StorageService, anonIds: Iterable<string>) => Promise<void>;
  // ── Klassifizierungen ────────────────────────────────────────────────
  upsertKlassifizierung: (storage: StorageService, k: Klassifizierung) => Promise<void>;
  /** Mergt mehrere Klassifizierungen in EINEM setState, OHNE persist. Caller
   *  triggert die Persistenz selbst (z.B. schedulePersist). Fuer den
   *  optimistischen Pill-Klick-Pfad. */
  upsertKlassifizierungenLocal: (ks: Klassifizierung[]) => void;
  freigebenKategorien: (storage: StorageService, antragId: string, kategorieIds: string[]) => Promise<void>;
  /** Bulk-Freigabe: mehrere Antraege (z.B. alle TVs mehrerer Verbuende) in
   *  EINEM setState + EINEM persist. Verhindert N sequentielle SMB-Roundtrips
   *  (Pitfall #16/#20). Bestehende Vorschlaege werden gemergt wie bei der
   *  Einzel-Freigabe. No-op bei leeren entries. */
  freigebenKategorienBulk: (
    storage: StorageService,
    entries: ReadonlyArray<{ antragId: string; kategorieIds: string[] }>,
  ) => Promise<void>;
  // ── Zuweisungen ──────────────────────────────────────────────────────
  upsertZuweisung: (storage: StorageService, z: Zuweisung) => Promise<void>;
  removeZuweisung: (storage: StorageService, antragId: string, anonId: string) => Promise<void>;
  // ── Kalibrierung ─────────────────────────────────────────────────────
  upsertKalibrierungsErgebnis: (storage: StorageService, e: KalibrierungsErgebnis) => Promise<void>;
  setOptimalConfidence: (storage: StorageService, kannIch: number, teilweise: number) => Promise<void>;
  clearKalibrierung: (storage: StorageService) => Promise<void>;
}

const initialData = emptyAuslastungData();

/** Debounce-Timer fuer `schedulePersist` — modul-global, ueberlebt Re-Mounts.
 *  ~600 ms: lang genug, dass rapides Pill-Klicken zu EINEM SMB-Write coalesced,
 *  kurz genug, dass das Verlust-Fenster (App-Close vor Flush) klein bleibt. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 600;

/** Baut einen freigegebenen Klassifizierungs-Record. Bestehende Vorschlaege
 *  (`vorgeschlagene*`) bleiben erhalten, erste kategorieId wird Primaer, Rest
 *  Aspekte. Pure — geteilt von Einzel-, Bulk- und View-Override-Freigabe. */
export function buildFreigegebenRecord(
  existing: Klassifizierung | undefined,
  antragId: string,
  kategorieIds: string[],
): Klassifizierung {
  return {
    antragId,
    vorgeschlagenePrimaer: existing?.vorgeschlagenePrimaer ?? null,
    vorgeschlageneAspekte: existing?.vorgeschlageneAspekte ?? [],
    freigegebenePrimaer: kategorieIds[0] ?? '',
    freigegebeneAspekte: kategorieIds.slice(1),
    status: 'freigegeben',
    freigegebenAm: new Date().toISOString(),
  };
}

export const useAuslastungData = create<AuslastungDataState>((set, get) => ({
  data: initialData,
  loading: false,
  loaded: false,
  saving: false,
  persistDirty: false,
  error: null,

  load: async (storage) => {
    if (get().loading) return;
    // Idempotenz: schon geladen ohne Fehler → kein SMB-Re-Fetch. Sonst wuerde
    // jedes Plugin-Wechsel-Re-Mount der AuslastungView einen vollen Roundtrip
    // gegen `_intern/auslastung.json` triggern (~0.5–2 s). Manuelle Invalidierung
    // via Mutatoren (upsertKategorie, upsertMitarbeiter etc.) bleibt unberührt.
    if (get().loaded && !get().error) return;
    set({ loading: true, error: null });
    try {
      const data = await loadAuslastungData(storage);
      set({ data, loaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  persist: async (storage) => {
    await get().persistNow(storage);
  },

  persistNow: async (storage) => {
    // Ausstehenden Debounce-Write absorbieren — wir schreiben jetzt sowieso.
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    // Laeuft bereits ein Save? Dann nur als "noch zu schreiben" markieren statt
    // den Write zu verwerfen (Pitfall #16/#20). Der laufende Save schreibt nach.
    if (get().saving) { set({ persistDirty: true }); return; }
    set({ saving: true, persistDirty: false, error: null });
    try {
      const written = await saveAuslastungData(storage, get().data);
      // NICHT `data: written` setzen — `written` ist der Snapshot vom Write-Start.
      // Mutationen waehrend des await wuerden sonst ueberschrieben (Clobber-Bug).
      // Nur den Timestamp auf den aktuellen Stand stempeln.
      set(s => ({ data: { ...s.data, updatedAt: written.updatedAt }, saving: false }));
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
    // Kam waehrend des Writes eine weitere Mutation? Dann den neuesten Stand
    // nachschreiben.
    if (get().persistDirty) {
      set({ persistDirty: false });
      await get().persistNow(storage);
    }
  },

  schedulePersist: (storage) => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void get().persistNow(storage).catch(err => {
        console.warn('[auslastung] debounced persist fehlgeschlagen:', err);
      });
    }, PERSIST_DEBOUNCE_MS);
  },

  flushPersist: async (storage) => {
    const hadPending = persistTimer !== null;
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    // Nur schreiben wenn wirklich etwas aussteht — sonst keine redundanten
    // SMB-Writes bei jedem Unmount.
    if (hadPending || get().persistDirty) {
      await get().persistNow(storage);
    }
  },

  updateConfig: async (storage, partial) => {
    set(state => ({
      data: { ...state.data, config: { ...state.data.config, ...partial } },
    }));
    await get().persist(storage);
  },

  upsertKategorie: async (storage, k) => {
    set(state => {
      const existing = state.data.config.ueberKategorien;
      const idx = existing.findIndex(x => x.id === k.id);
      const next = idx >= 0
        ? existing.map((x, i) => i === idx ? k : x)
        : [...existing, k];
      return { data: { ...state.data, config: { ...state.data.config, ueberKategorien: next } } };
    });
    await get().persist(storage);
  },

  removeKategorie: async (storage, kategorieId) => {
    set(state => ({
      data: {
        ...state.data,
        config: {
          ...state.data.config,
          ueberKategorien: state.data.config.ueberKategorien.filter(k => k.id !== kategorieId),
        },
      },
    }));
    await get().persist(storage);
  },

  upsertMitarbeiter: async (storage, ma) => {
    set(state => ({
      data: { ...state.data, mitarbeiter: { ...state.data.mitarbeiter, [ma.anonId]: ma } },
    }));
    await get().persist(storage);
  },

  createMitarbeiter: async (storage, init) => {
    const id = nextFreeAnonId(Object.keys(get().data.mitarbeiter));
    const ma: AnonymerMitarbeiter = {
      anonId: id,
      jahresKapazitaet: init?.jahresKapazitaet ?? DEFAULT_JAHRESKAPAZITAET,
      abgemeldet: init?.abgemeldet ?? [],
      manuelleTechnologien: init?.manuelleTechnologien ?? [],
      ausgeblendeteAutoTags: init?.ausgeblendeteAutoTags ?? [],
      hauptKategorie: init?.hauptKategorie ?? '',
      nebenKategorien: init?.nebenKategorien ?? [],
      abschlagProzent: init?.abschlagProzent ?? 0,
      virtuelleProjekte: init?.virtuelleProjekte ?? [],
      profilEmbeddingText: init?.profilEmbeddingText,
      onboardingAbgeschlossen: init?.onboardingAbgeschlossen ?? false,
      aktiv: init?.aktiv ?? true,
    };
    await get().upsertMitarbeiter(storage, ma);
    return ma;
  },

  removeMitarbeiter: async (storage, anonId) => {
    set(state => {
      const next = { ...state.data.mitarbeiter };
      delete next[anonId];
      return { data: { ...state.data, mitarbeiter: next } };
    });
    await get().persist(storage);
  },

  setMitarbeiterAktiv: async (storage, anonId, aktiv) => {
    const current = get().data.mitarbeiter[anonId];
    if (!current || current.aktiv === aktiv) return;
    set(state => ({
      data: {
        ...state.data,
        mitarbeiter: { ...state.data.mitarbeiter, [anonId]: { ...current, aktiv } },
      },
    }));
    await get().persist(storage);
  },

  applyAktivMap: async (storage, aktivById) => {
    let changed = false;
    set(state => {
      const next = { ...state.data.mitarbeiter };
      for (const [id, aktiv] of Object.entries(aktivById)) {
        const ma = next[id];
        if (!ma || ma.aktiv === aktiv) continue;
        next[id] = { ...ma, aktiv };
        changed = true;
      }
      if (!changed) return state;
      return { data: { ...state.data, mitarbeiter: next } };
    });
    if (changed) await get().persist(storage);
  },

  ensureMitarbeiterForAnonIds: async (storage, anonIds) => {
    const state = get();
    let changed = false;
    const next = { ...state.data.mitarbeiter };
    for (const anonId of anonIds) {
      if (next[anonId]) continue;
      next[anonId] = {
        anonId,
        jahresKapazitaet: DEFAULT_JAHRESKAPAZITAET,
        abgemeldet: [],
        manuelleTechnologien: [],
        ausgeblendeteAutoTags: [],
        hauptKategorie: '',
        nebenKategorien: [],
        abschlagProzent: 0,
        virtuelleProjekte: [],
        onboardingAbgeschlossen: false,
        aktiv: true,
      };
      changed = true;
    }
    if (!changed) return;
    set(s => ({ data: { ...s.data, mitarbeiter: next } }));
    await get().persist(storage);
  },

  upsertKlassifizierung: async (storage, k) => {
    set(state => {
      const idx = state.data.klassifizierungen.findIndex(x => x.antragId === k.antragId);
      const list = idx >= 0
        ? state.data.klassifizierungen.map((x, i) => i === idx ? k : x)
        : [...state.data.klassifizierungen, k];
      return { data: { ...state.data, klassifizierungen: list } };
    });
    await get().persist(storage);
  },

  freigebenKategorien: async (storage, antragId, kategorieIds) => {
    const existing = get().data.klassifizierungen.find(k => k.antragId === antragId);
    await get().upsertKlassifizierung(storage, buildFreigegebenRecord(existing, antragId, kategorieIds));
  },

  upsertKlassifizierungenLocal: (ks) => {
    if (ks.length === 0) return;
    set(state => {
      const list = [...state.data.klassifizierungen];
      const idxById = new Map(list.map((k, i) => [k.antragId, i]));
      for (const k of ks) {
        const idx = idxById.get(k.antragId);
        if (idx !== undefined) {
          list[idx] = k;
        } else {
          idxById.set(k.antragId, list.length);
          list.push(k);
        }
      }
      return { data: { ...state.data, klassifizierungen: list } };
    });
  },

  freigebenKategorienBulk: async (storage, entries) => {
    if (entries.length === 0) return;
    set(state => {
      const list = [...state.data.klassifizierungen];
      const idxById = new Map(list.map((k, i) => [k.antragId, i]));
      for (const { antragId, kategorieIds } of entries) {
        const idx = idxById.get(antragId);
        const existing = idx !== undefined ? list[idx] : undefined;
        const rec = buildFreigegebenRecord(existing, antragId, kategorieIds);
        if (idx !== undefined) {
          list[idx] = rec;
        } else {
          idxById.set(antragId, list.length);
          list.push(rec);
        }
      }
      return { data: { ...state.data, klassifizierungen: list } };
    });
    await get().persist(storage);
  },

  upsertZuweisung: async (storage, z) => {
    set(state => {
      const idx = state.data.zuweisungen.findIndex(
        x => x.antragId === z.antragId && x.anonId === z.anonId,
      );
      const list = idx >= 0
        ? state.data.zuweisungen.map((x, i) => i === idx ? z : x)
        : [...state.data.zuweisungen, z];
      return { data: { ...state.data, zuweisungen: list } };
    });
    await get().persist(storage);
  },

  removeZuweisung: async (storage, antragId, anonId) => {
    set(state => ({
      data: {
        ...state.data,
        zuweisungen: state.data.zuweisungen.filter(
          z => !(z.antragId === antragId && z.anonId === anonId),
        ),
      },
    }));
    await get().persist(storage);
  },

  upsertKalibrierungsErgebnis: async (storage, e) => {
    set(state => {
      const current: KalibrierungsState = state.data.kalibrierung ?? {
        ergebnisse: [],
        optimaleConfidenceKannIch: 0.7,
        optimaleConfidenceTeilweise: 0.3,
      };
      const idx = current.ergebnisse.findIndex(x => x.anonId === e.anonId);
      const ergebnisse = idx >= 0
        ? current.ergebnisse.map((x, i) => i === idx ? e : x)
        : [...current.ergebnisse, e];
      return {
        data: {
          ...state.data,
          kalibrierung: {
            ...current,
            ergebnisse,
            letzteKalibrierung: new Date().toISOString(),
          },
        },
      };
    });
    await get().persist(storage);
  },

  setOptimalConfidence: async (storage, kannIch, teilweise) => {
    set(state => {
      const current: KalibrierungsState = state.data.kalibrierung ?? {
        ergebnisse: [],
        optimaleConfidenceKannIch: 0.7,
        optimaleConfidenceTeilweise: 0.3,
      };
      return {
        data: {
          ...state.data,
          kalibrierung: {
            ...current,
            optimaleConfidenceKannIch: kannIch,
            optimaleConfidenceTeilweise: teilweise,
          },
        },
      };
    });
    await get().persist(storage);
  },

  clearKalibrierung: async (storage) => {
    set(state => ({ data: { ...state.data, kalibrierung: undefined } }));
    await get().persist(storage);
  },
}));

