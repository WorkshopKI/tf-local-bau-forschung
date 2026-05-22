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
import { readAntragDeskriptoren } from '../services/profil-aggregator';
import { normalizeKuerzel } from '../services/anonym-map';
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
  onToggleKategorie: (view: KlassifizierungsView, kategorieId: string, add: boolean) => void;
  onBestaetigen: (view: KlassifizierungsView) => void;
}

/** Top-1 Confidence-Score als Sort-Wert. Anträge ohne Vorschlag → 0. */
function topConfidenceScore(v: KlassifizierungsView): number {
  const vorgeschl = v.klassifizierung.vorgeschlageneKategorien;
  if (vorgeschl.length === 0) return 0;
  return vorgeschl.reduce((max, c) => (c.confidence > max ? c.confidence : max), 0);
}

/** Top-1 Kategorie-ID als Sort-Wert für die "Vorgeschlagen"-Spalte. */
function topVorschlagKey(v: KlassifizierungsView): string {
  const ids = v.klassifizierung.status === 'freigegeben'
    ? v.klassifizierung.freigegebeneKategorien
    : v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
  return ids[0] ?? '';
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
  const { kategorien, onToggleKategorie, onBestaetigen } = ctx;

  return [
    {
      key: 'aktenzeichen',
      label: 'Aktz.',
      locked: true,
      defaultVisible: true,
      sortable: true,
      width: 110,
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
      accessor: row => readVbTitel(row) || '—',
      render: row => {
        const vb = readVbTitel(row) || '—';
        return (
          <span className="block max-w-md truncate" title={vb}>{vb}</span>
        );
      },
    },
    {
      key: 'akronym',
      label: 'Akronym',
      defaultVisible: true,
      sortable: true,
      width: 120,
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
      width: 120,
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
      width: 160,
      accessor: row => row.antrag.antragsteller ?? '',
      render: row => {
        const ast = row.antrag.antragsteller ?? '';
        if (!ast) return null;
        return <span className="block truncate text-[11.5px]" title={ast}>{ast}</span>;
      },
    },
    {
      key: 'bib_kuerz',
      label: 'BIB',
      defaultVisible: false,
      sortable: true,
      width: 80,
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
      accessor: () => '',
      render: row => <TechnologieTags tags={readAntragDeskriptoren(row.antrag)} max={3} />,
    },
    {
      key: 'vorschlag',
      label: 'Vorgeschlagen',
      defaultVisible: true,
      sortable: true,
      width: 220,
      accessor: row => topVorschlagKey(row),
      render: row => <VorschlagCell view={row} kategorien={kategorien} onToggle={onToggleKategorie} />,
    },
    {
      key: 'confidence',
      label: 'Conf.',
      defaultVisible: true,
      sortable: true,
      width: 70,
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
  const ids = new Set(
    view.klassifizierung.status === 'freigegeben'
      ? view.klassifizierung.freigegebeneKategorien
      : view.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId),
  );
  return (
    <div className="flex flex-wrap gap-1">
      {kategorien.map(k => {
        const active = ids.has(k.id);
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => onToggle(view, k.id, !active)}
            className="cursor-pointer"
            aria-pressed={active}
            title={active ? `${k.name} entfernen` : `${k.name} hinzufügen`}
          >
            <KategoriePill kategorie={k} active={active} />
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
  const ids = view.klassifizierung.status === 'freigegeben'
    ? view.klassifizierung.freigegebeneKategorien
    : view.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
  return (
    <button
      type="button"
      onClick={() => onBestaetigen(view)}
      disabled={ids.length === 0}
      className="text-[11.5px] px-2 py-1 rounded cursor-pointer disabled:opacity-50"
      style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
    >
      Freigeben
    </button>
  );
}
