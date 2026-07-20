/**
 * Vorhabensbeschreibung: Zuordnung, Gliederung, Steckbrief.
 *
 * Rein darstellend. Die Zuordnung bestätigt ausdrücklich der Mensch — ein
 * falsch zugeordnetes Dokument würde die gesamte inhaltliche Prüfung auf den
 * falschen Antrag stützen.
 */
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { FileText, Sparkles } from 'lucide-react';
import type { UseMapVbResult } from '../useMapVb';

function KiHinweis({ lage, fehler }: { lage: string; fehler: string | null }): React.ReactElement | null {
  if (lage === 'ok' || lage === 'aus') return null;
  if (lage === 'laeuft') {
    return <p className="text-[12px] text-[var(--tf-text-tertiary)]">Analyse läuft …</p>;
  }
  return (
    <div
      className="rounded px-3 py-2 text-[12.5px]"
      style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
    >
      <p className="text-[var(--tf-text)]">Die KI-Analyse ist nicht durchgelaufen.</p>
      {fehler != null && (
        <p className="text-[var(--tf-text-secondary)] mt-0.5">{fehler}</p>
      )}
      <p className="text-[var(--tf-text-tertiary)] mt-1">
        Gliederung, Rechenchecks und Checkliste bleiben davon unberührt.
      </p>
    </div>
  );
}

export function VbPanel({ vb }: { vb: UseMapVbResult }): React.ReactElement {
  const waehlen = useAsyncAction(async (docId: string) => { await vb.waehleDokument(docId); });
  const loesen = useAsyncAction(async () => { await vb.loeseZuordnung(); });
  const analyse = useAsyncAction(async () => { await vb.starteAnalyse(); });

  if (vb.dokument === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          Ordnen Sie der Einreichung die Vorhabensbeschreibung zu. Sie ist die Grundlage
          für Steckbrief, Fundstellen und Lesemodus.
        </p>

        {vb.kandidaten.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
              Vorschläge
            </h3>
            {vb.kandidaten.map(k => (
              <button
                key={k.doc.id}
                type="button"
                disabled={waehlen.busy}
                onClick={() => waehlen.run(k.doc.id)}
                className="text-left rounded px-3 py-2 cursor-pointer"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <p className="text-[12.5px] text-[var(--tf-text)] flex items-center gap-1.5">
                  <FileText size={13} /> {k.doc.filename}
                </p>
                <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                  {k.grund.join(' · ')}
                </p>
              </button>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
            Alle Dokumente
          </h3>
          {vb.alleDokumente.length === 0 ? (
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
              Es sind noch keine Dokumente aufgenommen.
            </p>
          ) : (
            <select
              className="w-full text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
              defaultValue=""
              disabled={waehlen.busy}
              onChange={e => { if (e.target.value) waehlen.run(e.target.value); }}
            >
              <option value="">Dokument wählen …</option>
              {vb.alleDokumente.map(d => (
                <option key={d.id} value={d.id}>{d.filename}</option>
              ))}
            </select>
          )}
        </section>

        {waehlen.error != null && (
          <p className="text-[12.5px]" style={{ color: 'var(--tf-danger, #dc2626)' }}>
            {waehlen.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-[var(--tf-text)] flex items-center gap-1.5">
            <FileText size={14} /> {vb.dokument.filename}
          </p>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
            {vb.gliederung.length} Abschnitte erkannt
          </p>
        </div>
        <Button variant="ghost" size="sm" disabled={loesen.busy} onClick={() => loesen.run()}>
          Zuordnung lösen
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="primary" size="sm"
          disabled={analyse.busy || vb.gliederung.length === 0}
          onClick={() => analyse.run()}
        >
          <Sparkles size={14} />
          {analyse.busy ? 'Analysiert …' : 'Mit KI analysieren'}
        </Button>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Erzeugt Steckbrief und Aspekt-Zuordnung — läuft nur intern.
        </span>
      </div>

      <KiHinweis lage={vb.steckbriefLage} fehler={vb.steckbriefFehler} />
      <KiHinweis lage={vb.aspekteLage} fehler={vb.aspekteFehler} />

      {vb.steckbrief !== null && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Steckbrief</h3>
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">
              KI-generiert aus der Vorhabensbeschreibung
            </span>
          </div>
          <p className="text-[13px] text-[var(--tf-text)] leading-relaxed">
            {vb.steckbrief.einSatz?.text
              ?? <em className="text-[var(--tf-text-tertiary)]">In der Vorhabensbeschreibung nicht belegt.</em>}
          </p>
          {vb.steckbrief.innovation.length > 0 && (
            <div>
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] uppercase tracking-wide">Innovation</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {vb.steckbrief.innovation.map((b, i) => (
                  <li key={i} className="text-[12.5px] text-[var(--tf-text-secondary)]">{b.text}</li>
                ))}
              </ul>
            </div>
          )}
          {vb.steckbrief.zielmaerkte.length > 0 && (
            <div>
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] uppercase tracking-wide">Zielmärkte</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {vb.steckbrief.zielmaerkte.map((m, i) => (
                  <li key={i} className="text-[12.5px] text-[var(--tf-text-secondary)]">
                    {m.markt}{m.zielwert != null && ` — ${m.zielwert}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section>
        <h3 className="text-[13px] font-medium text-[var(--tf-text)] mb-1.5">Gliederung</h3>
        <ol className="flex flex-col gap-0.5">
          {vb.gliederung.map(s => (
            <li
              key={s.id}
              className="text-[12.5px] text-[var(--tf-text-secondary)]"
              style={{ paddingLeft: (s.ebene - 1) * 14 }}
            >
              {s.nummer != null && <span className="font-mono text-[11px] mr-1.5">{s.nummer}</span>}
              {s.titel}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
