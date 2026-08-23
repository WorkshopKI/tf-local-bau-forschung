/**
 * Die gefundenen ZIM-Vorhaben einer Meldungszeile.
 *
 * **Der Deckel sagt sich an.** Gezeigt werden zehn Befunde; darüber steht
 * „10 von 203 angezeigt" mit einem Aufklapper. Ein stiller Schnitt läse sich als
 * Vollständigkeit — und bei einem zu weiten Schlagwort sind 200 Treffer der
 * Normalfall, nicht die Ausnahme.
 */
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { antragDetailPfad } from '@/plugins/antraege/detailPfad';
import { BEFUNDE_SICHTBAR } from '../services/abgleich';
import type { TrefferBefund } from '../types';

export interface TrefferListeProps {
  befunde: readonly TrefferBefund[];
  /** Wie viele Schlagworte die Zeile trägt — der Nenner der Abdeckung. */
  schlagworte: number;
}

const QUELLE_TEXT: Record<TrefferBefund['quelle'], string> = {
  wortlaut: 'Wortlaut',
  aehnlichkeit: 'inhaltlich ähnlich',
  beide: 'Wortlaut + ähnlich',
};

function BefundZeile(props: { b: TrefferBefund; nenner: number }): React.ReactElement {
  const { b, nenner } = props;
  const titel = b.verbundTitel || b.titel || '(ohne Titel)';
  return (
    <li
      className="flex flex-col gap-1 rounded-[var(--tf-radius)] px-3 py-2"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className="rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
          style={{ background: 'var(--tf-bg-secondary)', color: 'var(--tf-text-secondary)' }}
          title={b.getroffeneWorte.length > 0
            ? `Getroffen: ${b.getroffeneWorte.join(', ')}`
            : 'Kein Schlagwort wörtlich gefunden'}
        >
          {b.abdeckung}/{nenner}
        </span>
        {/* Der Weg zur Detailseite wird NICHT hier entschieden: Verbund oder
            Teilvorhaben klärt `antragDetailPfad` — sechs Aufrufer hatten das
            früher von Hand nachgebaut, einer davon falsch. */}
        <a
          href={`#${antragDetailPfad({ verbundId: b.verbundId, aktenzeichen: b.aktenzeichen })}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--tf-text)] hover:underline"
        >
          {titel}
          <ExternalLink size={11} className="text-[var(--tf-text-tertiary)]" />
        </a>
        <span className="text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)]">{b.aktenzeichen}</span>
      </div>
      {b.titel && b.verbundTitel && b.titel !== b.verbundTitel && (
        <div className="text-[12px] text-[var(--tf-text-secondary)]">Teilvorhaben: {b.titel}</div>
      )}
      {b.kurzbeschreibung && (
        <p className="line-clamp-3 text-[12px] leading-[1.5] text-[var(--tf-text-secondary)]">
          {b.kurzbeschreibung}
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 text-[11.5px] text-[var(--tf-text-tertiary)]">
        <span>{QUELLE_TEXT[b.quelle]}</span>
        {b.aehnlichkeit !== null && <span className="tabular-nums">Ähnlichkeit {b.aehnlichkeit.toFixed(2)}</span>}
        {b.status && <span>{b.status}</span>}
        {b.antragsdatum && <span className="tabular-nums">{b.antragsdatum}</span>}
        {b.antragsteller && <span className="truncate">{b.antragsteller}</span>}
      </div>
    </li>
  );
}

export function TrefferListe(props: TrefferListeProps): React.ReactElement {
  const { befunde, schlagworte } = props;
  const [alleZeigen, setAlleZeigen] = useState(false);

  if (befunde.length === 0) {
    return (
      <p className="px-3 py-2 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Kein Vorhaben im Betrachtungsbereich trägt eines dieser Schlagworte.
      </p>
    );
  }

  const sichtbar = alleZeigen ? befunde : befunde.slice(0, BEFUNDE_SICHTBAR);
  const versteckt = befunde.length - sichtbar.length;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {sichtbar.map(b => <BefundZeile key={b.aktenzeichen} b={b} nenner={schlagworte} />)}
      </ul>
      {versteckt > 0 && (
        <button
          type="button"
          onClick={() => setAlleZeigen(true)}
          className="self-start rounded-[8px] px-2 py-1 text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
        >
          <span className="tabular-nums">{sichtbar.length} von {befunde.length}</span> angezeigt — alle zeigen
        </button>
      )}
      {alleZeigen && befunde.length > BEFUNDE_SICHTBAR && (
        <button
          type="button"
          onClick={() => setAlleZeigen(false)}
          className="self-start rounded-[8px] px-2 py-1 text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
        >
          Wieder auf {BEFUNDE_SICHTBAR} kürzen
        </button>
      )}
    </div>
  );
}
