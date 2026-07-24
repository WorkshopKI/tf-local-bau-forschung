/**
 * Widerspruchs-/Stellungnahme-Ansicht (Phase 6, Flag `artefaktWerkbank`). Erscheint,
 * sobald zum Verbund ein RNE/ABL-Bescheid existiert. Links die tragenden Gründe des
 * Bescheids, rechts die Stellungnahme des Antragstellers; pro Grund entscheidet der
 * **Mensch** „ausgeräumt / teilweise / nicht ausgeräumt" + Notiz. „Antwort in der
 * Werkbank vorbereiten" öffnet die Werkbank mit den offenen Gründen vorangekreuzt.
 */
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStorage } from '@/core/hooks/useStorage';
import { listDocsByTag, type DocumentFull } from '@/plugins/dokumente/store';
import type { KurzfassungContext } from '../kurzfassung/types';
import { useWiderspruch } from './useWiderspruch';
import { offeneWiderspruchKeys, notizVon, zustandVon } from './widerspruch';
import type { WiderspruchZustand } from './types';

/** Überschrift je Bescheid-Typ — Label, kein Roh-Status-Vergleich (Pitfall #12 n/a). */
const TITEL: Record<'rne' | 'abl', string> = {
  rne: 'Stellungnahme zur Rücknahmeempfehlung',
  abl: 'Widerspruch zur Ablehnung',
};

const ZUSTAND_OPTIONEN: Array<{ wert: WiderspruchZustand; label: string }> = [
  { wert: 'ausgeraeumt', label: 'ausgeräumt' },
  { wert: 'teilweise', label: 'teilweise' },
  { wert: 'nicht_ausgeraeumt', label: 'nicht ausgeräumt' },
];

export function WiderspruchSection({ ctx, onAntwortVorbereiten }: {
  ctx: KurzfassungContext;
  /** Öffnet die Werkbank mit diesen Punkt-Keys vorangekreuzt. */
  onAntwortVorbereiten: (offeneKeys: string[]) => void;
}): React.ReactElement | null {
  const storage = useStorage();
  const w = useWiderspruch(ctx);
  const [open, toggleOpen] = useCollapsedSection('verbund_widerspruch_collapsed');
  const [stellungnahme, setStellungnahme] = useState<DocumentFull | null>(null);

  // Zugeordnetes Stellungnahme-Dokument nachladen (für die Anzeige rechts).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!w.record?.stellungnahmeDocId) { setStellungnahme(null); return; }
      const docs = await listDocsByTag(storage.idb, ctx.key);
      if (!cancelled) setStellungnahme(docs.find(d => d.id === w.record?.stellungnahmeDocId) ?? null);
    })();
    return () => { cancelled = true; };
  }, [w.record?.stellungnahmeDocId, ctx.key, storage.idb]);

  const onStellungnahmeIngested = async (): Promise<void> => {
    const docs = await listDocsByTag(storage.idb, ctx.key);
    const neueste = docs
      .filter(d => d.tags.includes('stellungnahme'))
      .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))[0];
    if (neueste) w.setzeStellungnahme(neueste.id);
  };

  if (w.loading) return null;
  if (!w.bescheidTyp) return null; // ohne RNE/ABL-Run keine Sektion

  const offeneKeys = offeneWiderspruchKeys(w.record, w.gruende.map(g => g.punktKey));

  return (
    <div>
      <div className="flex items-center gap-3.5 mb-4">
        <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex items-center gap-1.5 cursor-pointer">
          <ChevronRight size={15} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          <span className="text-[16px] font-medium text-[var(--tf-text)]">{TITEL[w.bescheidTyp]}</span>
        </button>
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">{w.gruende.length} tragende Gründe</span>
        <span className="flex-1" />
        <Button
          variant="primary"
          disabled={offeneKeys.length === 0}
          onClick={() => onAntwortVorbereiten(offeneKeys)}
          title={offeneKeys.length === 0 ? 'Alle Gründe sind ausgeräumt — keine Antwort nötig.' : 'Öffnet die Werkbank mit den nicht ausgeräumten Gründen vorangekreuzt.'}
        >
          Antwort in der Werkbank vorbereiten ({offeneKeys.length})
        </Button>
      </div>

      <div className={open ? undefined : 'hidden'}>
        <div className="flex gap-5 items-start">
          {/* Links — tragende Gründe + Abgleich */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">Tragende Gründe des Bescheids</div>
            {w.gruende.map(g => (
              <div key={g.punktKey} className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-3.5 py-3">
                <div className="flex items-start gap-2 mb-2">
                  {g.aspektId && <span className="text-[10.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] shrink-0 mt-0.5">{g.aspektId}</span>}
                  <span className="text-[12.5px] text-[var(--tf-text)] flex-1">{g.text}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  {ZUSTAND_OPTIONEN.map(o => {
                    const aktiv = zustandVon(w.record, g.punktKey) === o.wert;
                    return (
                      <button
                        key={o.wert}
                        type="button"
                        aria-pressed={aktiv}
                        onClick={() => w.setzeGrundZustand(g.punktKey, o.wert)}
                        className={`text-[11.5px] px-2.5 py-1 rounded-[7px] border transition-colors ${
                          aktiv ? 'border-[var(--tf-primary)] bg-[var(--tf-primary)] text-white' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-hover)]'
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <Textarea
                  value={notizVon(w.record, g.punktKey)}
                  onChange={e => w.setzeGrundNotiz(g.punktKey, e.target.value)}
                  rows={2}
                  placeholder="Notiz zur Bewertung (optional) …"
                  className="text-[12px]"
                />
              </div>
            ))}
          </div>

          {/* Rechts — Stellungnahme */}
          <div className="w-[42%] shrink-0 flex flex-col gap-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">Stellungnahme des Antragstellers</div>
            <DokumentAufnahme
              relationTag={ctx.key}
              knownIds={ctx.knownIds}
              defaultTyp="stellungnahme"
              onIngested={() => { void onStellungnahmeIngested(); }}
            />
            {stellungnahme && (
              <div className="text-[12px] text-[var(--tf-text-secondary)] whitespace-pre-wrap leading-[1.55] max-h-[420px] overflow-auto rounded-[8px] bg-[var(--tf-bg-secondary)] px-3 py-2">
                <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">{stellungnahme.filename}</div>
                {stellungnahme.markdown || '— kein Text —'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
