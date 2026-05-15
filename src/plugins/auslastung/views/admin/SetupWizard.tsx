/**
 * Setup-Wizard fuer das Auslastungs-Modul.
 *
 * Schritt 1: Mindestens 1, max 7 Ueberkategorien anlegen.
 * Schritt 2: Deskriptoren-Mapping (jeder Wert -> 1..2 Kategorien).
 * Schritt 3: "Abschliessen" — schreibt MA-Stub-Profile aus den Antraegen +
 *            setzt `setupAbgeschlossen=true`.
 */
import { useMemo, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import {
  KATEGORIE_FARBEN,
  type AnonymerMitarbeiter,
  type KategorieFarbe,
} from '../../types';
import { KategoriePill } from '../../components/KategoriePill';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { syncMitarbeiterFromAntraege } from '../../services/profil-aggregator';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymMap } from '../../services/anonym-map';

interface Props {
  storage: StorageService;
  antraege: Antrag[];
  anonymMap: AnonymMap;
  allDeskriptoren: Array<{ wert: string; count: number }>;
}

export function SetupWizard({ storage, antraege, anonymMap, allDeskriptoren }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const upsertKategorie = useAuslastungData(s => s.upsertKategorie);
  const updateConfig = useAuslastungData(s => s.updateConfig);
  const removeKategorie = useAuslastungData(s => s.removeKategorie);
  const persist = useAuslastungData(s => s.persist);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  // Lokale Form-States fuer Schritt 1
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newFarbe, setNewFarbe] = useState<KategorieFarbe>('blue');

  // Lokales Mapping fuer Schritt 2: Wert -> Set<kategorieId>
  const [mappingDraft, setMappingDraft] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    for (const k of data.config.ueberKategorien) {
      for (const d of k.deskriptorenMapping) {
        const lower = d.toLowerCase();
        if (!m.has(lower)) m.set(lower, new Set());
        m.get(lower)!.add(k.id);
      }
    }
    return m;
  });

  const kategorien = data.config.ueberKategorien;

  const usedColors = useMemo(() => new Set(kategorien.map(k => k.farbe)), [kategorien]);
  const nextDefaultFarbe = useMemo<KategorieFarbe>(() => {
    return KATEGORIE_FARBEN.find(f => !usedColors.has(f)) ?? 'slate';
  }, [usedColors]);

  async function addKategorie(): Promise<void> {
    const id = newId.trim().toUpperCase();
    const name = newName.trim();
    if (!id || !name) return;
    if (kategorien.some(k => k.id === id)) return;
    if (kategorien.length >= 7) return;
    await upsertKategorie(storage, {
      id,
      name,
      farbe: newFarbe,
      deskriptorenMapping: [],
    });
    setNewId('');
    setNewName('');
    setNewFarbe(nextDefaultFarbe);
  }

  function toggleMapping(wert: string, kategorieId: string): void {
    setMappingDraft(prev => {
      const next = new Map(prev);
      const cur = new Set(next.get(wert) ?? []);
      if (cur.has(kategorieId)) cur.delete(kategorieId);
      else if (cur.size < 2) cur.add(kategorieId);  // Max 2 Kategorien pro Deskriptor
      next.set(wert, cur);
      return next;
    });
  }

  async function finish(): Promise<void> {
    setBusy(true);
    try {
      // 1) Mapping in Kategorien schreiben
      const byKat = new Map<string, string[]>();
      for (const [wert, set] of mappingDraft.entries()) {
        for (const katId of set) {
          if (!byKat.has(katId)) byKat.set(katId, []);
          byKat.get(katId)!.push(wert);
        }
      }
      // Sequenziell upserten — persist ist atomar
      for (const k of kategorien) {
        const mapping = byKat.get(k.id) ?? [];
        await upsertKategorie(storage, { ...k, deskriptorenMapping: mapping });
      }

      // 2) Mitarbeiter-Stubs aus Antraegen ableiten
      const current = data.mitarbeiter;
      const sync = syncMitarbeiterFromAntraege(
        current,
        antraege,
        anonymMap,
        // Lese frisches kategorien-State aus dem Store nach den Upserts
        useAuslastungData.getState().data.config.ueberKategorien,
        { overrideKategorien: true },
      );

      const next = { ...useAuslastungData.getState().data };
      next.mitarbeiter = sync.next as Record<string, AnonymerMitarbeiter>;
      next.config = { ...next.config, setupAbgeschlossen: true };
      useAuslastungData.setState({ data: next });
      await persist(storage);

      // Re-fetch + Config-flag (persist hat das schon erledigt)
      await updateConfig(storage, { setupAbgeschlossen: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[12px] p-6 mb-6" style={{ border: '0.5px solid var(--tf-primary)', background: 'var(--tf-primary-soft, var(--tf-bg-secondary))' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-medium text-[var(--tf-text)]">Setup-Wizard</h2>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            Bevor das Auslastungs-Modul genutzt werden kann, müssen Überkategorien angelegt und die Deskriptoren zugeordnet werden.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
          <StepDot active={step >= 1} done={step > 1}>1</StepDot>
          <StepDot active={step >= 2} done={step > 2}>2</StepDot>
          <StepDot active={step === 3}>3</StepDot>
        </div>
      </div>

      {/* Schritt 1: Kategorien anlegen */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
              Schritt 1 — Überkategorien anlegen ({kategorien.length}/7)
            </div>
            <div className="flex flex-col gap-1.5 mb-3">
              {kategorien.length === 0 && (
                <p className="text-[12px] text-[var(--tf-text-tertiary)]">
                  Noch keine Kategorien angelegt. Mindestens eine Kategorie ist nötig.
                </p>
              )}
              {kategorien.map(k => (
                <div key={k.id} className="flex items-center gap-3 py-1.5 px-2 rounded" style={{ background: 'var(--tf-bg)' }}>
                  <KategoriePill kategorie={k} size="md" />
                  <span className="text-[12.5px] text-[var(--tf-text)] flex-1">{k.name}</span>
                  <button
                    type="button"
                    onClick={() => void removeKategorie(storage, k.id)}
                    className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text,#b91c1c)] cursor-pointer"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
            {kategorien.length < 7 && (
              <div className="flex items-end gap-2 mt-2">
                <div className="flex flex-col">
                  <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-0.5">ID</label>
                  <input
                    value={newId}
                    onChange={e => setNewId(e.target.value)}
                    placeholder="z.B. IKT"
                    maxLength={6}
                    className="text-[12.5px] px-2 py-1 rounded w-20 outline-none"
                    style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
                  />
                </div>
                <div className="flex flex-col flex-1">
                  <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-0.5">Name</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="z.B. Informations- und Kommunikationstechnologie"
                    className="text-[12.5px] px-2 py-1 rounded outline-none"
                    style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-0.5">Farbe</label>
                  <select
                    value={newFarbe}
                    onChange={e => setNewFarbe(e.target.value as KategorieFarbe)}
                    className="text-[12.5px] px-2 py-1 rounded outline-none"
                    style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
                  >
                    {KATEGORIE_FARBEN.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void addKategorie()}
                  disabled={!newId.trim() || !newName.trim()}
                  className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
                >
                  Hinzufügen
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={kategorien.length === 0}
              className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              Weiter zu Schritt 2 →
            </button>
          </div>
        </div>
      )}

      {/* Schritt 2: Mapping */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
              Schritt 2 — Deskriptoren-Mapping ({mappingDraft.size}/{allDeskriptoren.length} zugeordnet)
            </div>
            <p className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
              Ordne jedem Technologie-Wert eine oder zwei Überkategorien zu. Werte ohne Zuordnung werden als „nicht zugeordnet" markiert.
            </p>
            <div
              className="max-h-[400px] overflow-y-auto rounded"
              style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
            >
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                    <th className="px-3 py-1.5">Deskriptor</th>
                    <th className="px-3 py-1.5">Anzahl</th>
                    <th className="px-3 py-1.5">Zuordnung</th>
                  </tr>
                </thead>
                <tbody>
                  {allDeskriptoren.map(({ wert, count }) => {
                    const assigned = mappingDraft.get(wert) ?? new Set<string>();
                    return (
                      <tr key={wert} style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                        <td className="px-3 py-1.5 text-[var(--tf-text)]">{wert}</td>
                        <td className="px-3 py-1.5 text-[var(--tf-text-tertiary)]">{count}×</td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            {kategorien.map(k => {
                              const active = assigned.has(k.id);
                              return (
                                <button
                                  key={k.id}
                                  type="button"
                                  onClick={() => toggleMapping(wert, k.id)}
                                  className={`text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-all ${
                                    active
                                      ? 'opacity-100'
                                      : 'opacity-40 hover:opacity-70'
                                  }`}
                                >
                                  <KategoriePill kategorie={k} />
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {allDeskriptoren.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-center text-[var(--tf-text-tertiary)]">
                        Keine Deskriptoren in den Anträgen gefunden — möglicherweise sind die CSVs noch nicht importiert.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
            >
              ← Zurück
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              Weiter zu Schritt 3 →
            </button>
          </div>
        </div>
      )}

      {/* Schritt 3: Abschluss */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
              Schritt 3 — Setup abschließen
            </div>
            <ul className="text-[12.5px] text-[var(--tf-text-secondary)] space-y-1">
              <li>· {kategorien.length} Überkategorien angelegt</li>
              <li>· {mappingDraft.size} von {allDeskriptoren.length} Deskriptoren zugeordnet</li>
              <li>· {anonymMap.toAnon.size} anonyme MA-IDs aus den historischen Anträgen abgeleitet</li>
              <li>· {allDeskriptoren.length - mappingDraft.size} Deskriptoren ohne Zuordnung (kein Problem — können später ergänzt werden)</li>
            </ul>
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-3">
              Nach Abschluss kannst du Anträge klassifizieren und MAs zuweisen. Stufe-2-Embedding-Matching bleibt deaktiviert,
              bis du den Corpus separat aufbaust (Admin → Embedding-Corpus).
            </p>
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
            >
              ← Zurück
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy}
              className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              {busy ? 'Speichere…' : 'Setup abschließen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepDot({ children, active, done }: { children: React.ReactNode; active?: boolean; done?: boolean }): React.ReactElement {
  const cls = done
    ? 'bg-emerald-500 text-white'
    : active
      ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]'
      : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium ${cls}`}>
      {done ? '✓' : children}
    </span>
  );
}
