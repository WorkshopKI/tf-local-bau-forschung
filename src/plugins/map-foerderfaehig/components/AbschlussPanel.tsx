/**
 * Abschluss: Gutachten-Gerüst, Nachforderung oder Ablehnung als kopierbarer
 * Markdown-Entwurf. Rein darstellend — die Entwürfe baut `abschluss/markdown.ts`.
 */
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { CopyButton } from '@/plugins/chat/components/CopyButton';
import { useMemo, useState } from 'react';
import { baueAbschluss, type AbschlussArt } from '../abschluss/markdown';
import type { MapBewertungsErgebnis } from '../checkliste/bewertung';
import type { MapChecklistenDefinition, MapPraezisionsNf } from '../checkliste/typen';
import type { Zielkriterium } from '../substanz/zielkriterien';
import type { MapEinreichung } from '../types';

export function AbschlussPanel({
  einreichung, definition, ergebnis, zielkriterien, praezisionsNf,
}: {
  einreichung: MapEinreichung;
  definition: MapChecklistenDefinition;
  ergebnis: MapBewertungsErgebnis;
  /** Übernommene Zielkriterien — landen als Tabelle im Gutachten-Gerüst. */
  zielkriterien: readonly Zielkriterium[];
  praezisionsNf: readonly MapPraezisionsNf[];
}): React.ReactElement {
  const [art, setArt] = useState<AbschlussArt>('gutachten');
  const [titelGeprueft, setTitelGeprueft] = useState(false);
  const [hinweis, setHinweis] = useState('');

  const markdown = useMemo(
    () => baueAbschluss(art, einreichung, definition, ergebnis, {
      titelGeprueft, hinweis, zielkriterien, praezisionsNf,
    }),
    [art, einreichung, definition, ergebnis, titelGeprueft, hinweis, zielkriterien, praezisionsNf],
  );

  return (
    <div className="flex flex-col gap-3">
      {!ergebnis.abschlussbereit && (
        <div
          className="rounded px-3 py-2 text-[12.5px]"
          style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
        >
          <p className="text-[var(--tf-text)] font-medium">Noch nicht abschlussreif</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[var(--tf-text-secondary)]">
            {ergebnis.offen.length > 0 && (
              <li>{ergebnis.offen.length} Kriterien noch nicht bewertet</li>
            )}
            {ergebnis.nfOffen.length > 0 && (
              <li>{ergebnis.nfOffen.length} Nachforderungen offen</li>
            )}
            {ergebnis.bemerkungFehlt.length > 0 && (
              <li>{ergebnis.bemerkungFehlt.length} Pflicht-Bemerkungen fehlen</li>
            )}
          </ul>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5">
            Der Entwurf lässt sich trotzdem erzeugen — er bildet dann den aktuellen Stand ab.
          </p>
        </div>
      )}

      <ScopeTabs
        variant="pills"
        items={[
          { key: 'gutachten', label: 'Gutachten' },
          {
            key: 'nachforderung', label: 'Nachforderung',
            count: ergebnis.nfOffen.length + praezisionsNf.length,
          },
          { key: 'ablehnung', label: 'Ablehnung', count: ergebnis.nichtErfuellt.length },
        ]}
        activeKey={art}
        onChange={k => setArt(k as AbschlussArt)}
        aria-label="Art des Abschlusses"
      />

      <label className="flex items-center gap-2 text-[12.5px] text-[var(--tf-text)]">
        <input
          type="checkbox"
          checked={titelGeprueft}
          onChange={e => setTitelGeprueft(e.target.checked)}
        />
        Teilvorhabentitel geprüft, gegebenenfalls angepasst
      </label>

      <textarea
        value={hinweis}
        onChange={e => setHinweis(e.target.value)}
        rows={2}
        placeholder="Hinweis für die weiterverarbeitende Rolle (optional)"
        className="w-full text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Entwurf — deterministisch aus den Bewertungen erzeugt, ohne KI.
        </span>
        <CopyButton text={markdown} title="Markdown kopieren" />
      </div>

      <pre
        className="text-[12px] leading-relaxed whitespace-pre-wrap rounded px-3 py-2.5 max-h-[420px] overflow-y-auto bg-[var(--tf-bg)] text-[var(--tf-text)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {markdown}
      </pre>
    </div>
  );
}
