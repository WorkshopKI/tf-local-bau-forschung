/**
 * Phase 7 — Rückimport der anonymen Antwort + deterministische Finalisierung.
 * Phase 8 — Ausgabe (Clipboard primär, mailto sekundär).
 *
 * Die Wiedereinsetzung ist rein deterministisch (Find-Replace über das Mapping),
 * NIE per LLM. Optionaler interner Polish läuft VOR der Wiedereinsetzung.
 */
import { useEffect, useMemo, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { finalisiere, polishAntwort, pruefePlatzhalter } from './services/finalisierung';
import { FinaleAntwortAusgabe } from './FinaleAntwortAusgabe';
import { useAnfragenStore } from './store';
import { statusErreicht } from './status';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
}

export function RueckimportFinalisierung({ anfrage }: Props): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const upsert = useAnfragenStore(s => s.upsert);
  const [pasteText, setPasteText] = useState(anfrage.externeAntwortAnon);
  const [polishOn, setPolishOn] = useState(false);

  useEffect(() => { setPasteText(anfrage.externeAntwortAnon); }, [anfrage.id, anfrage.externeAntwortAnon]);

  const validierung = useMemo(
    () => pruefePlatzhalter(pasteText, anfrage.mapping),
    [pasteText, anfrage.mapping],
  );
  const istFinalisiert = statusErreicht(anfrage.status, 'finalisiert');

  const uebernehmen = useAsyncAction(async () => {
    await upsert({ ...anfrage, externeAntwortAnon: pasteText, status: 'antwort_importiert' }, storage);
  });

  const finalisieren = useAsyncAction(async () => {
    const polish = polishOn ? (anon: string) => polishAntwort(bridge, anon) : undefined;
    const finaleAntwort = await finalisiere(pasteText, anfrage.mapping, polish);
    await upsert(
      { ...anfrage, externeAntwortAnon: pasteText, finaleAntwort, status: 'finalisiert' },
      storage,
    );
  });

  return (
    <section className="mt-5">
      <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-2 flex items-center gap-1.5">
        <CornerDownLeft size={13} /> Anonyme Antwort zurück-importieren
      </h3>

      <textarea
        value={pasteText}
        onChange={e => setPasteText(e.target.value)}
        placeholder="Anonymisierte Antwort aus dem ZIM-Dashboard hier einfügen (muss die Platzhalter [TYP_N] enthalten) …"
        spellCheck={false}
        className="w-full h-40 p-3 text-[12.5px] leading-[1.5] font-mono rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none resize-y"
      />

      {(validierung.fehlend.length > 0 || validierung.unbekannt.length > 0) && pasteText.trim() && (
        <div className="mt-1.5 text-[11.5px] text-[var(--tf-warning-text)] space-y-0.5">
          {validierung.fehlend.length > 0 && (
            <p>Fehlende Platzhalter (werden nicht wiedereingesetzt): {validierung.fehlend.join(', ')}</p>
          )}
          {validierung.unbekannt.length > 0 && (
            <p>Unbekannte Platzhalter (bleiben im Text stehen): {validierung.unbekannt.join(', ')}</p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => uebernehmen.run()}
          disabled={!pasteText.trim() || uebernehmen.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] border border-[var(--tf-border)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {uebernehmen.busy ? 'Übernehme…' : 'Antwort übernehmen'}
        </button>
        <button
          type="button"
          onClick={() => finalisieren.run()}
          disabled={!pasteText.trim() || finalisieren.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity hover:opacity-90"
        >
          {finalisieren.busy ? 'Finalisiere…' : 'Finalisieren (Originaldaten einsetzen)'}
        </button>
        <label className="text-[11.5px] text-[var(--tf-text-secondary)] flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={polishOn} onChange={e => setPolishOn(e.target.checked)} />
          Vor dem Einsetzen intern glätten
        </label>
      </div>

      {(uebernehmen.error || finalisieren.error) && (
        <p className="mt-1 text-[12px] text-[var(--tf-danger-text)]">Fehler: {uebernehmen.error ?? finalisieren.error}</p>
      )}

      {istFinalisiert && <FinaleAntwortAusgabe anfrage={anfrage} />}
    </section>
  );
}
