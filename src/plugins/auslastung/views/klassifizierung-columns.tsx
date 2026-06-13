/**
 * Spalten-Definitionen fuer den Klassifizierungs-Tab.
 *
 * Baut eine `SortableColumn<KlassifizierungsView>[]` — der Caller (View)
 * injiziert die Kategorie-Definitionen + Aktions-Callbacks via Kontext,
 * damit die `render`-Funktionen sie als Closure sehen.
 */
import { type ReactNode } from 'react';
import type { SortableColumn } from '@/components/data-table';
import type { KlassifizierungsView } from '../hooks/useKlassifizierungen';
import { KategoriePill } from '../components/KategoriePill';
import { ConfidenceDot } from '../components/ConfidenceDot';
import { TechnologieTags } from '../components/TechnologieTags';
import { normalizeKuerzel } from '../services/identitaet';
import {
  CANONICAL_AKRONYM,
  CANONICAL_VERBUND_TITEL,
  CANONICAL_TITEL,
  CANONICAL_BIB_KUERZ,
  CANONICAL_ANTRAGSDATUM,
  type UeberKategorie,
} from '../types';

export interface ClassifierColumnsContext {
  kategorien: UeberKategorie[];
  /** Deskriptoren pro Aktenzeichen aus dem Slim-Cache-Stream-Pass (v2.63). */
  deskriptorenByAz: ReadonlyMap<string, readonly string[]>;
  onToggleKategorie: (view: KlassifizierungsView, kategorieId: string, add: boolean) => void;
  onBestaetigen: (view: KlassifizierungsView) => void;
}

/** Top-1 Confidence-Score als Sort-Wert. Anträge ohne Vorschlag → 0. */
function topConfidenceScore(v: KlassifizierungsView): number {
  return v.klassifizierung.vorgeschlagenePrimaer?.confidence ?? 0;
}

/** Top-1 Kategorie-ID als Sort-Wert für die "Vorgeschlagen"-Spalte. */
function topVorschlagKey(v: KlassifizierungsView): string {
  if (v.klassifizierung.status === 'freigegeben') return v.klassifizierung.freigegebenePrimaer;
  return v.klassifizierung.vorgeschlagenePrimaer?.kategorieId ?? '';
}

function readString(row: KlassifizierungsView, key: string): string {
  const v = (row.antrag as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

function readVbTitel(row: KlassifizierungsView): string {
  return readString(row, CANONICAL_VERBUND_TITEL) || readString(row, CANONICAL_TITEL);
}

export function buildClassifierColumns(
  ctx: ClassifierColumnsContext,
): SortableColumn<KlassifizierungsView>[] {
  const { kategorien, deskriptorenByAz, onToggleKategorie, onBestaetigen } = ctx;

  return [
    {
      key: 'aktenzeichen',
      label: 'Aktz.',
      locked: true,
      defaultVisible: true,
      sortable: true,
      width: 110,
      wrap: false,
      accessor: row => row.antrag.aktenzeichen,
      render: row => (
        <span className="font-mono text-[11.5px]">{row.antrag.aktenzeichen}</span>
      ),
    },
    {
      key: 'vb_titel',
      label: 'VB-Titel',
      defaultVisible: true,
      sortable: true,
      width: 320,
      wrap: true,
      accessor: row => readVbTitel(row) || '—',
      render: row => {
        const vb = readVbTitel(row) || '—';
        return <span>{vb}</span>;
      },
    },
    {
      key: 'akronym',
      label: 'Akronym',
      defaultVisible: true,
      sortable: true,
      width: 120,
      wrap: false,
      accessor: row => readString(row, CANONICAL_AKRONYM),
      render: row => {
        const a = readString(row, CANONICAL_AKRONYM);
        if (!a) return null;
        return <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{a}</span>;
      },
    },
    {
      key: 'antragsdatum',
      label: 'Antragsdatum',
      defaultVisible: true,
      sortable: true,
      width: 110,
      wrap: false,
      accessor: row => readString(row, CANONICAL_ANTRAGSDATUM),
      render: row => {
        const d = readString(row, CANONICAL_ANTRAGSDATUM);
        if (!d) return null;
        return <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{d}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      defaultVisible: true,
      sortable: true,
      width: 140,
      wrap: true,
      accessor: row => (typeof row.antrag.status === 'string' ? row.antrag.status : ''),
      render: row => {
        const s = typeof row.antrag.status === 'string' ? row.antrag.status : '';
        if (!s) return null;
        return <span className="text-[11.5px]" title={s}>{s}</span>;
      },
    },
    {
      key: 'antragsteller',
      label: 'AST',
      defaultVisible: true,
      sortable: true,
      width: 180,
      wrap: true,
      accessor: row => row.antrag.antragsteller ?? '',
      render: row => {
        const ast = row.antrag.antragsteller ?? '';
        if (!ast) return null;
        return <span className="text-[11.5px]" title={ast}>{ast}</span>;
      },
    },
    {
      key: 'bib_kuerz',
      label: 'BIB',
      defaultVisible: false,
      sortable: true,
      width: 80,
      wrap: false,
      accessor: row => normalizeKuerzel((row.antrag as Record<string, unknown>)[CANONICAL_BIB_KUERZ]) ?? '',
      render: row => {
        const bib = normalizeKuerzel((row.antrag as Record<string, unknown>)[CANONICAL_BIB_KUERZ]);
        if (!bib) return null;
        return (
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{
              background: 'var(--tf-bg-secondary)',
              color: 'var(--tf-text-secondary)',
              border: '0.5px solid var(--tf-border)',
            }}
            title="Administrativer Bearbeiter (BIB)"
          >
            {bib}
          </span>
        );
      },
    },
    {
      key: 'deskriptoren',
      label: 'Deskriptoren',
      defaultVisible: true,
      sortable: false,
      width: 180,
      wrap: true,
      accessor: () => '',
      render: row => <TechnologieTags tags={deskriptorenByAz.get(row.antrag.aktenzeichen) ?? []} max={3} />,
    },
    {
      key: 'vorschlag',
      label: 'Vorgeschlagen',
      defaultVisible: true,
      sortable: true,
      width: 220,
      wrap: true,
      accessor: row => topVorschlagKey(row),
      render: row => <VorschlagCell view={row} kategorien={kategorien} onToggle={onToggleKategorie} />,
    },
    {
      key: 'confidence',
      label: 'Conf.',
      defaultVisible: true,
      sortable: true,
      width: 70,
      wrap: false,
      accessor: row => topConfidenceScore(row),
      render: row => <ConfidenceDot confidence={row.confidence} />,
    },
    {
      key: 'aktion',
      label: 'Aktion',
      locked: true,
      defaultVisible: true,
      sortable: false,
      width: 130,
      wrap: false,
      accessor: () => '',
      render: row => <AktionCell view={row} onBestaetigen={onBestaetigen} />,
    },
  ];
}

interface VorschlagCellProps {
  view: KlassifizierungsView;
  kategorien: UeberKategorie[];
  onToggle: (view: KlassifizierungsView, kategorieId: string, add: boolean) => void;
}

function VorschlagCell({ view, kategorien, onToggle }: VorschlagCellProps): ReactNode {
  // 1.17: Primaer vs Aspekt visuell unterscheiden.
  const istFreigegeben = view.klassifizierung.status === 'freigegeben';
  const primaer = istFreigegeben
    ? view.klassifizierung.freigegebenePrimaer
    : (view.klassifizierung.vorgeschlagenePrimaer?.kategorieId ?? '');
  const aspekte = istFreigegeben
    ? view.klassifizierung.freigegebeneAspekte
    : view.klassifizierung.vorgeschlageneAspekte.map(a => a.kategorieId);
  const aspekteSet = new Set(aspekte);
  return (
    <div className="flex flex-wrap gap-1">
      {kategorien.map(k => {
        const isPrimaer = k.id === primaer;
        const isAspekt = aspekteSet.has(k.id);
        const mode: 'primaer' | 'aspekt' | 'inactive' =
          isPrimaer ? 'primaer' : isAspekt ? 'aspekt' : 'inactive';
        const active = isPrimaer || isAspekt;
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => onToggle(view, k.id, !active)}
            className="cursor-pointer"
            aria-pressed={active}
            title={
              isPrimaer ? `${k.name} (Primär) — entfernen`
              : isAspekt ? `${k.name} (Aspekt) — entfernen`
              : `${k.name} als Aspekt hinzufügen`
            }
          >
            <KategoriePill kategorie={k} mode={mode} />
          </button>
        );
      })}
    </div>
  );
}

interface AktionCellProps {
  view: KlassifizierungsView;
  onBestaetigen: (view: KlassifizierungsView) => void;
}

function AktionCell({ view, onBestaetigen }: AktionCellProps): ReactNode {
  const freigegeben = view.klassifizierung.status === 'freigegeben';
  if (freigegeben) {
    return <span className="text-[11.5px] text-emerald-700">✓ freigegeben</span>;
  }
  const hasPrimaer = view.klassifizierung.vorgeschlagenePrimaer !== null;
  return (
    <button
      type="button"
      onClick={() => onBestaetigen(view)}
      disabled={!hasPrimaer}
      className="text-[11.5px] px-2 py-1 rounded cursor-pointer disabled:opacity-50"
      style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
    >
      Freigeben
    </button>
  );
}
