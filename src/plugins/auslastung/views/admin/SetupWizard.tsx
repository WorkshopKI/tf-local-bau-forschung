// TODO(refactor v2.4+): Multi-Step-Wizard — 3 Steps (Kategorien/Mapping/Abschluss) + Finish-Persist in einer Datei; Steps extrahieren (siehe CLAUDE.md → File Size Limit).
// Vorschlag: SetupStep1.tsx..SetupStep3.tsx als eigene Files, Wizard bleibt als Schritt-Navigator.
/**
 * Setup-Wizard fuer das Auslastungs-Modul.
 *
 * Schritt 1: Mindestens 1, max 7 Ueberkategorien anlegen.
 * Schritt 2: Deskriptoren-Mapping (jeder Wert -> 1..2 Kategorien).
 * Schritt 3: "Abschliessen" — schreibt MA-Stub-Profile aus den Antraegen +
 *            setzt `setupAbgeschlossen=true`.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { StorageService } from '@/core/services/storage';
import {
  KATEGORIE_FARBEN,
  type AnonymerMitarbeiter,
  type KategorieFarbe,
} from '../../types';
import { KategoriePill } from '../../components/KategoriePill';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { syncMitarbeiterFromAntraege } from '../../services/identitaet';
import type { AntragOderSlim } from '@/core/services/csv/types';
import type { AnonymMap } from '../../services/identitaet';

interface Props {
  storage: StorageService;
  antraege: ReadonlyArray<AntragOderSlim>;
  /** Vorberechnete per-Anon-Profile aus dem Slim-Cache (v2.63) — der Wizard
   *  braucht die vollen Records damit nicht mehr. */
  profilesByAnon: Map<string, string[]>;
  anonymMap: AnonymMap;
  allDeskriptoren: Array<{ wert: string; count: number }>;
}

export function SetupWizard({ storage, antraege, anonymMap, allDeskriptoren, profilesByAnon }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const upsertKategorie = useAuslastungData(s => s.upsertKategorie);
  const removeKategorie = useAuslastungData(s => s.removeKategorie);
  const persist = useAuslastungData(s => s.persist);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lokale Form-States fuer Schritt 1
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newFarbe, setNewFarbe] = useState<KategorieFarbe>('blue');

  // Lokales Mapping fuer Schritt 2: echter-Wert (lowercase) -> Set<kategorieId>.
  // Pre-Fill via Substring-Match: ein echter Deskriptor wie "energietechnologien"
  // wird automatisch der Kategorie EU zugeordnet, weil deren Default-Mapping das
  // Keyword "energie" enthaelt (Substring-Treffer).
  const [mappingDraft, setMappingDraft] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    for (const { wert } of allDeskriptoren) {
      const lower = wert.toLowerCase();
      const matched = new Set<string>();
      for (const k of data.config.ueberKategorien) {
        for (const d of k.deskriptorenMapping) {
          const needle = d.toLowerCase().trim();
          if (!needle) continue;
          // Treffer wenn echter Wert das Default-Keyword als Substring enthaelt
          // ODER umgekehrt (z.B. exakter Match einer ZT-Klartext-Zuordnung).
          if (lower.includes(needle) || needle.includes(lower)) {
            matched.add(k.id);
            break;
          }
        }
      }
      if (matched.size > 0) m.set(lower, matched);
    }
    return m;
  });

  const kategorien = data.config.ueberKategorien;

  // Korrektes Zaehlen: nur Deskriptoren-Werte, die a) in den echten CSV-Werten
  // vorkommen UND b) mindestens eine Kategorie-Zuordnung haben. Die Default-
  // Heuristik-Keywords ("ki", "energie", ...) stehen zwar in mappingDraft,
  // sind aber selten echte Deskriptoren-Werte und sollen nicht mitzaehlen.
  const realDeskSet = useMemo(
    () => new Set(allDeskriptoren.map(d => d.wert.toLowerCase())),
    [allDeskriptoren],
  );
  const zugeordnetCount = useMemo(() => {
    let n = 0;
    for (const [wert, set] of mappingDraft.entries()) {
      if (set.size > 0 && realDeskSet.has(wert)) n++;
    }
    return n;
  }, [mappingDraft, realDeskSet]);
  const ohneZuordnungCount = Math.max(0, allDeskriptoren.length - zugeordnetCount);

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
    setError(null);
    try {
      // 1) Mapping in alle Kategorien schreiben — in EINEM Schritt aufbauen,
      //    nicht 5x einzelne upsertKategorie-Calls. Jeder upsert wuerde
      //    persist() triggern; mehrere parallel laufende persists fallen
      //    durch den `if (saving) return;`-Lock raus -> Setup wird nicht
      //    konsistent gespeichert.
      const byKat = new Map<string, string[]>();
      for (const [wert, set] of mappingDraft.entries()) {
        for (const katId of set) {
          const list = byKat.get(katId) ?? [];
          list.push(wert);
          byKat.set(katId, list);
        }
      }
      const naechstenKategorien = kategorien.map(k => ({
        ...k,
        deskriptorenMapping: byKat.get(k.id) ?? [],
      }));

      // 2) Mitarbeiter-Stubs aus Antraegen ableiten — single-pass
      //    via aggregateMaProfilesByAnon (siehe profil-aggregator.ts).
      const sync = syncMitarbeiterFromAntraege(
        useAuslastungData.getState().data.mitarbeiter,
        antraege,
        anonymMap,
        naechstenKategorien,
        { overrideKategorien: true, profilesByAnon },
      );

      // 3) Single state-update + single persist. Damit kein Race im
      //    persist-Lock und nur EIN SMB-Roundtrip statt 7+.
      useAuslastungData.setState(state => ({
        data: {
          ...state.data,
          config: {
            ...state.data.config,
            ueberKategorien: naechstenKategorien,
            setupAbgeschlossen: true,
          },
          mitarbeiter: sync.next as Record<string, AnonymerMitarbeiter>,
        },
      }));
      await persist(storage);
    } catch (err) {
      console.error('[SetupWizard] finish failed:', err);
      setError(err instanceof Error ? err.message : String(err));
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
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void addKategorie()}
                  disabled={!newId.trim() || !newName.trim()}
                >
                  Hinzufügen
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setStep(2)}
              disabled={kategorien.length === 0}
            >
              Weiter zu Schritt 2 →
            </Button>
          </div>
        </div>
      )}

      {/* Schritt 2: Mapping */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
              Schritt 2 — Deskriptoren-Mapping ({zugeordnetCount}/{allDeskriptoren.length} zugeordnet)
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
                                  className="cursor-pointer"
                                  aria-pressed={active}
                                  title={`${k.name}${active ? ' (zugeordnet)' : ' (nicht zugeordnet)'}`}
                                >
                                  <KategoriePill kategorie={k} active={active} />
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setStep(1)}
            >
              ← Zurück
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setStep(3)}
            >
              Weiter zu Schritt 3 →
            </Button>
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
              <li>· {zugeordnetCount} von {allDeskriptoren.length} Deskriptoren zugeordnet</li>
              <li>
                · {anonymMap.toAnon.size} anonyme MA-IDs aus den TIB-Kürzeln der historischen Anträge
                <span className="text-[var(--tf-text-tertiary)]"> — inkl. ehemalige Bearbeiter, deren Kompetenz-Profile beim Matching neuer MAs als Referenz dienen können</span>
              </li>
              <li>· {ohneZuordnungCount} Deskriptoren ohne Zuordnung (kein Problem — können später ergänzt werden)</li>
            </ul>
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-3">
              Nach Abschluss kannst du Anträge klassifizieren und MAs zuweisen. Die automatische Themen-Erkennung
              greift, sobald die Themen-Vektoren gebaut sind (Admin → „Themen-Vektoren für Klassifizierung").
            </p>
            {error && (
              <div className="rounded p-2.5 text-[12px] mt-3" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
                ⚠ Setup konnte nicht gespeichert werden: <span className="font-mono">{error}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setStep(2)}
            >
              ← Zurück
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={busy}
              onClick={() => void finish()}
            >
              Setup abschließen
            </Button>
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
      ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
      : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium ${cls}`}>
      {done ? '✓' : children}
    </span>
  );
}
