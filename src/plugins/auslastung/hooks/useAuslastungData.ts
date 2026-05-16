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
  error: string | null;
  /** Initial-Load — idempotent, kann beliebig oft aufgerufen werden. */
  load: (storage: StorageService) => Promise<void>;
  /** Persistiert das gesamte data-Objekt zurueck auf den Share. */
  persist: (storage: StorageService) => Promise<void>;
  // ── Config ────────────────────────────────────────────────────────────
  updateConfig: (storage: StorageService, partial: Partial<AuslastungConfig>) => Promise<void>;
  // ── Ueberkategorien ──────────────────────────────────────────────────
  upsertKategorie: (storage: StorageService, k: UeberKategorie) => Promise<void>;
  removeKategorie: (storage: StorageService, kategorieId: string) => Promise<void>;
  // ── Mitarbeiter ──────────────────────────────────────────────────────
  upsertMitarbeiter: (storage: StorageService, ma: AnonymerMitarbeiter) => Promise<void>;
  createMitarbeiter: (storage: StorageService, init?: Partial<AnonymerMitarbeiter>) => Promise<AnonymerMitarbeiter>;
  removeMitarbeiter: (storage: StorageService, anonId: string) => Promise<void>;
  // ── Klassifizierungen ────────────────────────────────────────────────
  upsertKlassifizierung: (storage: StorageService, k: Klassifizierung) => Promise<void>;
  freigebenKategorien: (storage: StorageService, antragId: string, kategorieIds: string[]) => Promise<void>;
  // ── Zuweisungen ──────────────────────────────────────────────────────
  upsertZuweisung: (storage: StorageService, z: Zuweisung) => Promise<void>;
  removeZuweisung: (storage: StorageService, antragId: string, anonId: string) => Promise<void>;
  // ── Kalibrierung ─────────────────────────────────────────────────────
  upsertKalibrierungsErgebnis: (storage: StorageService, e: KalibrierungsErgebnis) => Promise<void>;
  setOptimalConfidence: (storage: StorageService, kannIch: number, teilweise: number) => Promise<void>;
  clearKalibrierung: (storage: StorageService) => Promise<void>;
}

const initialData = emptyAuslastungData();

export const useAuslastungData = create<AuslastungDataState>((set, get) => ({
  data: initialData,
  loading: false,
  loaded: false,
  saving: false,
  error: null,

  load: async (storage) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const data = await loadAuslastungData(storage);
      set({ data, loaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  persist: async (storage) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const next = await saveAuslastungData(storage, get().data);
      set({ data: next, saving: false });
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
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
      ueberKategorien: init?.ueberKategorien ?? [],
      virtuelleProjekte: init?.virtuelleProjekte ?? [],
      profilEmbeddingText: init?.profilEmbeddingText,
      onboardingAbgeschlossen: init?.onboardingAbgeschlossen ?? false,
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
    const next: Klassifizierung = {
      antragId,
      vorgeschlageneKategorien: existing?.vorgeschlageneKategorien ?? [],
      freigegebeneKategorien: kategorieIds,
      status: 'freigegeben',
      freigegebenAm: new Date().toISOString(),
    };
    await get().upsertKlassifizierung(storage, next);
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

