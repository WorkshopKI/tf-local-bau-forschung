/**
 * Die **Meilenstein-Gliederung** unter dem Zeitverlauf — reine Anzeige.
 *
 * Standardmäßig zu: sie ist Nachschlagen, nicht Diagnose. Aufgeklappt zeigt sie
 * zuerst nur die oberste Ebene; Teilschritte klappen einzeln nach.
 *
 * **Der Baum läuft über `TfTree`** (Guard `no-headless-tree-outside-wrapper`) —
 * Tastaturnavigation, ARIA und Aufklapp-Zustand kommen von dort, hier stehen
 * nur die Zeileninhalte.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TfTree } from '@/components/tree';
import type { Gliederung, GliederungsZeile, PunktForm } from './gliederungBaum';

const PUNKT_STIL: Record<PunktForm, (farbe: string) => React.CSSProperties> = {
  gefuellt: farbe => ({ background: farbe, border: `2px solid ${farbe}` }),
  offen: farbe => ({ background: 'transparent', border: `2px solid ${farbe}` }),
  gestrichelt: () => ({
    background: 'transparent',
    border: '1px dashed var(--tf-border-hover)',
  }),
};

export function GliederungSektion({
  gliederung, stufen, gerissen, hervorgehoben, onHover,
}: {
  gliederung: Gliederung;
  /** Relevante Stufen der obersten Ebene. */
  stufen: number;
  /** Gerissene Blätter — dieselbe Zählung wie in der Kopfkarte. */
  gerissen: number;
  /** Wird diese Zeile gerade von der Achse her hervorgehoben? */
  hervorgehoben: (nummer: string) => boolean;
  onHover: (nummer: string | null) => void;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const [aufgeklappt, setAufgeklappt] = useState<string[]>([]);

  return (
    <div className="border-t" style={{ borderColor: 'var(--tf-border)' }}>
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-expanded={offen}
        className="flex w-full items-center gap-2.5 py-[11px] px-0.5 cursor-pointer text-left"
      >
        <ChevronRight
          size={12}
          aria-hidden="true"
          className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform duration-150"
          style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[12.5px] font-medium text-[var(--tf-text)]">Meilensteine</span>
        <span className="font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">
          {stufen} {stufen === 1 ? 'Stufe' : 'Stufen'}
          {' · '}
          <span style={gerissen > 0 ? { color: 'var(--tf-danger-text)' } : undefined}>
            {gerissen} gerissen
          </span>
        </span>
        <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)]">nach Nummer</span>
      </button>

      {offen && (
        <div
          className="rounded-[10px] overflow-hidden mb-3 bg-[var(--tf-bg)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <TfTree<GliederungsZeile>
            items={gliederung.items}
            rootId={gliederung.rootId}
            label="Meilenstein-Gliederung"
            indent={22}
            expandedItems={aufgeklappt}
            onExpandedChange={setAufgeklappt}
            onZeilenHover={(_id, data, ein) => onHover(ein ? data.nummer : null)}
            slots={{
              zeilenStil: p => ({
                height: p.level === 0 ? 30 : 27,
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 12 + p.level * 22,
                borderRadius: 0,
                ...(p.level === 0 && gliederung.obersteEbene[0] === p.id
                  ? {}
                  : { borderTop: '0.5px solid var(--tf-border)' }),
                ...(hervorgehoben(p.data.nummer)
                  ? { outline: '2px solid var(--tf-primary)', outlineOffset: -2 }
                  : {}),
              }),
              icon: p => (
                <span
                  aria-hidden="true"
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={PUNKT_STIL[p.data.punktForm](p.data.punktFarbe)}
                />
              ),
              label: p => (
                <span className="flex min-w-0 flex-1 items-center gap-2.5" title={p.data.titel}>
                  <span className="shrink-0 font-mono text-[10.5px] text-[var(--tf-text-tertiary)] min-w-[26px]">
                    {p.data.nummer}
                  </span>
                  <span
                    className={`min-w-0 truncate ${p.level === 0 ? 'text-[12.5px]' : 'text-[12px]'}`}
                    style={{
                      color: p.data.zustand === 'nichtRelevant'
                        ? 'var(--tf-text-tertiary)'
                        : p.level === 0 ? 'var(--tf-text)' : 'var(--tf-text-secondary)',
                      ...(p.data.zustand === 'gerissen' ? { fontWeight: 500 } : {}),
                    }}
                  >
                    {p.data.label}
                  </span>
                </span>
              ),
              trailing: p => (
                <span className="flex shrink-0 items-center gap-3 pl-2">
                  <span
                    className="text-[11.5px] text-right min-w-[92px]"
                    style={{ color: p.data.statusFarbe }}
                  >
                    {p.data.statusText}
                  </span>
                  <span className="font-mono text-[11px] text-right text-[var(--tf-text-tertiary)] min-w-[74px]">
                    {p.data.datumText}
                  </span>
                </span>
              ),
            }}
          />
        </div>
      )}
    </div>
  );
}
