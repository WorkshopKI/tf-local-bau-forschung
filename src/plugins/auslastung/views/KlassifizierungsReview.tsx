/**
 * Screen 1a — Klassifizierungs-Review.
 *
 * Tabelle: Aktenzeichen / VB-Titel / Deskriptoren / Vorgeschlagen /
 * Confidence / Aktion.
 *
 * Filter-Pills: Alle / Review nötig / Bereits freigegeben.
 * Batch-Aktion: "Alle hohen Confidences freigeben".
 */
import { useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useKlassifizierungenView, type KlassifizierungsView } from '../hooks/useKlassifizierungen';
import { KategoriePill } from '../components/KategoriePill';
import { ConfidenceDot } from '../components/ConfidenceDot';
import { TechnologieTags } from '../components/TechnologieTags';
import { readAntragDeskriptoren } from '../services/profil-aggregator';
import { normalizeKuerzel } from '../services/anonym-map';
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_VERBUND_TITEL,
  CANONICAL_TITEL,
  CANONICAL_TIB_KUERZ,
  CANONICAL_ANTRAGSDATUM,
  type Klassifizierung,
} from '../types';

type ViewFilter = 'alle' | 'review' | 'freigegeben';

/** Status-Werte (lowercase, getrimmt), die einen Antrag aus dem
 *  Verteil-Pool ausschliessen. Quelle: Foyer-CSV `STATUS_TV`. */
const EXCLUDED_STATUS = new Set(['abgelehnt/zurückgezogen', 'irrläufer']);

/** Extrahiert das Jahr aus `config.aktuellesQuartal` (Format `YYYY-QN`). */
function jahrAusQuartal(quartal: string): number | null {
  const m = /^(\d{4})-Q[1-4]$/.exec(quartal);
  return m ? Number(m[1]) : null;
}

/** True wenn der Antrag dem Verteil-Pool angehoert: aktuelles Jahr, ohne
 *  TiB-Zuweisung, Status nicht in `EXCLUDED_STATUS`. */
function istZuVerteilen(antrag: Antrag, jahr: number): boolean {
  const datum = antrag[CANONICAL_ANTRAGSDATUM];
  if (typeof datum !== 'string' || !datum.startsWith(`${jahr}-`)) return false;
  if (normalizeKuerzel(antrag[CANONICAL_TIB_KUERZ]) !== null) return false;
  const status = typeof antrag.status === 'string' ? antrag.status.trim().toLowerCase() : '';
  if (EXCLUDED_STATUS.has(status)) return false;
  return true;
}

export function KlassifizierungsReview(): React.ReactElement {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const upsertKlassifizierung = useAuslastungData(s => s.upsertKlassifizierung);
  const freigeben = useAuslastungData(s => s.freigebenKategorien);

  const cache = useAntraegeCache();
  const aktuellesJahr = useMemo(
    () => jahrAusQuartal(config.aktuellesQuartal),
    [config.aktuellesQuartal],
  );
  const antraegeImPool = useMemo(() => {
    if (aktuellesJahr === null) return cache.antraege;
    return cache.antraege.filter(a => istZuVerteilen(a, aktuellesJahr));
  }, [cache.antraege, aktuellesJahr]);
  const view = useKlassifizierungenView(antraegeImPool, config.ueberKategorien, klassifizierungen);

  const [filter, setFilter] = useState<ViewFilter>('alle');

  const counts = useMemo(() => {
    let neu = 0, freig = 0, review = 0;
    for (const v of view) {
      if (v.klassifizierung.status === 'freigegeben') freig++;
      else if (v.confidence === 'high') neu++;
      else review++;
    }
    return { neu, freig, review, total: view.length };
  }, [view]);

  const filtered = useMemo(() => {
    return view.filter(v => {
      if (filter === 'freigegeben') return v.klassifizierung.status === 'freigegeben';
      if (filter === 'review') return v.klassifizierung.status !== 'freigegeben' && v.confidence !== 'high';
      return true;
    });
  }, [view, filter]);

  async function bulkFreigeben(): Promise<void> {
    const candidates = view.filter(v =>
      v.klassifizierung.status !== 'freigegeben'
      && v.confidence === 'high'
      && v.klassifizierung.vorgeschlageneKategorien.length > 0
    );
    if (candidates.length === 0) return;
    if (!confirm(`${candidates.length} Anträge mit hoher Sicherheit freigeben?`)) return;
    for (const v of candidates) {
      const ids = v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
      await freigeben(storage, v.antrag.aktenzeichen, ids);
    }
  }

  async function applyManualOverride(
    v: KlassifizierungsView,
    kategorieId: string,
    add: boolean,
  ): Promise<void> {
    const current = new Set(
      v.klassifizierung.status === 'freigegeben'
        ? v.klassifizierung.freigegebeneKategorien
        : v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId),
    );
    if (add) {
      if (current.size >= 2 && !current.has(kategorieId)) return;
      current.add(kategorieId);
    } else {
      current.delete(kategorieId);
    }
    const ids = [...current];
    // Wenn bereits freigegeben: einfach updaten
    if (v.klassifizierung.status === 'freigegeben') {
      await freigeben(storage, v.antrag.aktenzeichen, ids);
    } else {
      // Andernfalls: aktualisiere vorgeschlageneKategorien (override durch PL)
      const next: Klassifizierung = {
        ...v.klassifizierung,
        vorgeschlageneKategorien: ids.map(id => ({
          kategorieId: id,
          confidence: 1.0,
          methode: 'regel',
        })),
      };
      await upsertKlassifizierung(storage, next);
    }
  }

  async function bestaetigen(v: KlassifizierungsView): Promise<void> {
    const ids = v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
    await freigeben(storage, v.antrag.aktenzeichen, ids);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pool-Hint */}
      {aktuellesJahr !== null && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)]">
          Verteil-Pool: Anträge aus {aktuellesJahr} ohne TiB-Zuweisung, ohne Status
          „abgelehnt/zurückgezogen" und „Irrläufer".
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['alle', 'review', 'freigegeben'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[11.5px] px-3 py-1 rounded-full cursor-pointer transition-colors ${
                filter === f ? 'opacity-100' : 'opacity-60 hover:opacity-90'
              }`}
              style={{
                background: filter === f ? 'var(--tf-text)' : 'transparent',
                color: filter === f ? 'var(--tf-bg)' : 'var(--tf-text-secondary)',
                border: '0.5px solid var(--tf-border)',
              }}
            >
              {f === 'alle' && `Alle (${counts.total})`}
              {f === 'review' && `Review nötig (${counts.review})`}
              {f === 'freigegeben' && `Freigegeben (${counts.freig})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            {counts.total} gesamt · {counts.freig} freigegeben · {counts.review} prüfen
          </span>
          <button
            type="button"
            disabled={counts.neu === 0}
            onClick={() => void bulkFreigeben()}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            Alle hohen Confidences freigeben ({counts.neu})
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]" style={{ background: 'var(--tf-bg-secondary)' }}>
              <th className="px-3 py-2 w-28">Aktz.</th>
              <th className="px-3 py-2">VB-Titel</th>
              <th className="px-3 py-2">Deskriptoren</th>
              <th className="px-3 py-2">Vorgeschlagen</th>
              <th className="px-3 py-2 w-16">Conf.</th>
              <th className="px-3 py-2 w-32">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <Row
                key={v.antrag.aktenzeichen}
                view={v}
                kategorien={config.ueberKategorien}
                onToggleKategorie={(id, add) => void applyManualOverride(v, id, add)}
                onBestaetigen={() => void bestaetigen(v)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--tf-text-tertiary)]">
                  Keine Anträge in dieser Ansicht.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RowProps {
  view: KlassifizierungsView;
  kategorien: Array<{ id: string; name: string; farbe: import('../types').KategorieFarbe }>;
  onToggleKategorie: (kategorieId: string, add: boolean) => void;
  onBestaetigen: () => void;
}

function Row({ view, kategorien, onToggleKategorie, onBestaetigen }: RowProps): React.ReactElement {
  const a = view.antrag;
  const vbTitel = (a[CANONICAL_VERBUND_TITEL] as string | undefined) ?? (a[CANONICAL_TITEL] as string | undefined) ?? '—';
  const desk = readAntragDeskriptoren(a);
  const ids = new Set(
    view.klassifizierung.status === 'freigegeben'
      ? view.klassifizierung.freigegebeneKategorien
      : view.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId),
  );
  const freigegeben = view.klassifizierung.status === 'freigegeben';

  return (
    <tr style={{ borderTop: '0.5px solid var(--tf-border)' }}>
      <td className="px-3 py-2 font-mono text-[11.5px]">{a.aktenzeichen}</td>
      <td className="px-3 py-2 max-w-md truncate" title={vbTitel}>{vbTitel}</td>
      <td className="px-3 py-2"><TechnologieTags tags={desk} max={3} /></td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {kategorien.map(k => {
            const active = ids.has(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => onToggleKategorie(k.id, !active)}
                className="cursor-pointer"
                aria-pressed={active}
                title={active ? `${k.name} entfernen` : `${k.name} hinzufügen`}
              >
                <KategoriePill kategorie={k} active={active} />
              </button>
            );
          })}
        </div>
      </td>
      <td className="px-3 py-2"><ConfidenceDot confidence={view.confidence} /></td>
      <td className="px-3 py-2">
        {freigegeben ? (
          <span className="text-[11.5px] text-emerald-700">✓ freigegeben</span>
        ) : (
          <button
            type="button"
            onClick={onBestaetigen}
            disabled={ids.size === 0}
            className="text-[11.5px] px-2 py-1 rounded cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            Freigeben
          </button>
        )}
      </td>
    </tr>
  );
}
