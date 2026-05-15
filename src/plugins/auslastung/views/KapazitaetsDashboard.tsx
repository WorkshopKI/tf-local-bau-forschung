/**
 * Screen 2 — Kapazitaets-Dashboard (PL-Ansicht).
 *
 * Liste aller MAs mit horizontalem Auslastungs-Balken. Filter-Pills nach
 * Ueberkategorie. Klick auf MA -> Flyout mit zugewiesenen Antraegen.
 */
import { useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { KategoriePill } from '../components/KategoriePill';
import { AnonymIdBadge } from '../components/AnonymIdBadge';
import { KapazitaetsBalken } from '../components/KapazitaetsBalken';
import { TechnologieTags } from '../components/TechnologieTags';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  type AnonymerMitarbeiter,
} from '../types';

export function KapazitaetsDashboard(): React.ReactElement {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const upsertMitarbeiter = useAuslastungData(s => s.upsertMitarbeiter);
  const cache = useAntraegeCache();

  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [openMa, setOpenMa] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = Object.values(mitarbeiter);
    const filtered = kategorieFilter ? all.filter(m => m.ueberKategorien.includes(kategorieFilter)) : all;
    return filtered.sort((a, b) => a.anonId.localeCompare(b.anonId));
  }, [mitarbeiter, kategorieFilter]);

  const verbrauchByAnon = useMemo(() => {
    const map = new Map<string, { freigegeben: number; selbst: number; vorgeschlagen: number }>();
    for (const z of zuweisungen) {
      if (z.quartal !== config.aktuellesQuartal) continue;
      const e = map.get(z.anonId) ?? { freigegeben: 0, selbst: 0, vorgeschlagen: 0 };
      if (z.status === 'freigegeben') e.freigegeben += z.stunden;
      else if (z.status === 'selbst') e.selbst += z.stunden;
      else if (z.status === 'vorgeschlagen') e.vorgeschlagen += z.stunden;
      map.set(z.anonId, e);
    }
    return map;
  }, [zuweisungen, config.aktuellesQuartal]);

  const openMaObj = openMa ? mitarbeiter[openMa] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Kategorie</span>
        <button
          type="button"
          onClick={() => setKategorieFilter('')}
          className={`text-[11.5px] px-2.5 py-1 rounded-full cursor-pointer ${kategorieFilter === '' ? '' : 'opacity-50'}`}
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Alle ({Object.keys(mitarbeiter).length})
        </button>
        {config.ueberKategorien.map(k => {
          const count = Object.values(mitarbeiter).filter(m => m.ueberKategorien.includes(k.id)).length;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKategorieFilter(k.id === kategorieFilter ? '' : k.id)}
              className={`cursor-pointer flex items-center gap-1 ${kategorieFilter === k.id ? '' : 'opacity-50'}`}
            >
              <KategoriePill kategorie={k} />
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* MA-Liste */}
      <div className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
        {list.map(ma => {
          const v = verbrauchByAnon.get(ma.anonId) ?? { freigegeben: 0, selbst: 0, vorgeschlagen: 0 };
          const quartalsKap = ma.jahresKapazitaet / 4;
          const abgemeldet = ma.abgemeldet.includes(config.aktuellesQuartal);
          const onboardingPending = !ma.onboardingAbgeschlossen;
          return (
            <div
              key={ma.anonId}
              className="px-4 py-3 cursor-pointer flex items-center gap-4"
              style={{ borderBottom: '0.5px solid var(--tf-border)' }}
              onClick={() => setOpenMa(ma.anonId)}
            >
              <AnonymIdBadge anonId={ma.anonId} />
              <div className="flex-1 min-w-0">
                <KapazitaetsBalken
                  freigegeben={v.freigegeben}
                  selbst={v.selbst}
                  vorgeschlagen={v.vorgeschlagen}
                  quartalsKapazitaet={quartalsKap}
                />
              </div>
              <div className="flex gap-1">
                {ma.ueberKategorien.map(id => {
                  const k = config.ueberKategorien.find(x => x.id === id);
                  return k ? <KategoriePill key={id} kategorie={k} /> : null;
                })}
              </div>
              {abgemeldet && (
                <span className="text-[10.5px] text-amber-700">⏸ abgemeldet</span>
              )}
              {onboardingPending && (
                <span className="text-[10.5px] text-amber-700">⚙ Onboarding</span>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="px-3 py-8 text-center text-[var(--tf-text-tertiary)] text-[12.5px]">
            Keine MAs in dieser Kategorie.
          </div>
        )}
      </div>

      {/* Flyout */}
      {openMaObj && (
        <MaFlyout
          ma={openMaObj}
          quartal={config.aktuellesQuartal}
          zuweisungen={zuweisungen.filter(z => z.anonId === openMaObj.anonId && z.quartal === config.aktuellesQuartal)}
          kategorien={config.ueberKategorien}
          antraegeIndex={new Map(cache.antraege.map(a => [a.aktenzeichen, a]))}
          onClose={() => setOpenMa(null)}
          onToggleAbmeldung={async (q) => {
            const next = openMaObj.abgemeldet.includes(q)
              ? openMaObj.abgemeldet.filter(x => x !== q)
              : [...openMaObj.abgemeldet, q];
            await upsertMitarbeiter(storage, { ...openMaObj, abgemeldet: next });
          }}
        />
      )}
    </div>
  );
}

function MaFlyout({
  ma, quartal, zuweisungen, kategorien, antraegeIndex, onClose, onToggleAbmeldung,
}: {
  ma: AnonymerMitarbeiter;
  quartal: string;
  zuweisungen: import('../types').Zuweisung[];
  kategorien: import('../types').UeberKategorie[];
  antraegeIndex: Map<string, import('@/core/services/csv/types').Antrag>;
  onClose: () => void;
  onToggleAbmeldung: (quartal: string) => Promise<void>;
}): React.ReactElement {
  const abgemeldet = ma.abgemeldet.includes(quartal);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="w-[480px] max-h-full rounded-[12px] p-5 overflow-y-auto flex flex-col gap-4"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AnonymIdBadge anonId={ma.anonId} size="lg" />
            <div className="flex gap-1">
              {ma.ueberKategorien.map(id => {
                const k = kategorien.find(x => x.id === id);
                return k ? <KategoriePill key={id} kategorie={k} /> : null;
              })}
            </div>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-[var(--tf-text-tertiary)]">×</button>
        </div>

        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Jahreskapazität</div>
          <div className="text-[13px]">{ma.jahresKapazitaet}h ({ma.jahresKapazitaet / 4}h/Quartal)</div>
        </div>

        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Technologien</div>
          <TechnologieTags tags={ma.manuelleTechnologien} />
        </div>

        <div>
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={abgemeldet}
              onChange={() => void onToggleAbmeldung(quartal)}
            />
            <span>Für Quartal {quartal} abmelden</span>
          </label>
        </div>

        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Zuweisungen ({zuweisungen.length})
          </div>
          <ul className="space-y-1">
            {zuweisungen.map(z => {
              const a = antraegeIndex.get(z.antragId);
              const titel = (a?.[CANONICAL_VERBUND_TITEL] as string | undefined)
                ?? (a?.[CANONICAL_TITEL] as string | undefined)
                ?? '—';
              return (
                <li key={`${z.antragId}-${z.anonId}`} className="flex items-center gap-2 text-[11.5px]">
                  <span className="font-mono text-[var(--tf-text-secondary)]">{z.antragId}</span>
                  <span className="flex-1 truncate">{titel}</span>
                  <span className="text-[var(--tf-text-tertiary)]">{z.stunden}h</span>
                  <span className="text-[10px] text-[var(--tf-text-tertiary)]">{z.status}</span>
                </li>
              );
            })}
            {zuweisungen.length === 0 && (
              <li className="text-[11.5px] text-[var(--tf-text-tertiary)]">Keine Zuweisungen in diesem Quartal.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
