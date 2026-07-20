/**
 * Reader Lite: Prüfaspekte links, die zugehörigen VB-Abschnitte rechts im
 * Wortlaut.
 *
 * Der „0 Fundstellen"-Zustand ist ausdrücklich sichtbar — ein Aspekt ohne
 * Abschnitt ist eine Prüfaussage, kein leerer Bildschirm.
 *
 * Rein darstellend; die Zuordnung kommt aus `vb/fundstellen.ts`.
 */
import { PRUEF_ASPEKTE, type AspektMapping } from '@/plugins/antraege/aufbereitung';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import { useMemo, useState } from 'react';
import { fundstellenFuerAspekte } from '../vb/fundstellen';

export function ReaderLite({
  gliederung, markdown, mapping,
}: {
  gliederung: readonly VbSektion[];
  markdown: string;
  mapping: AspektMapping | null;
}): React.ReactElement {
  const [aspektId, setAspektId] = useState(PRUEF_ASPEKTE[0]!.id);

  const proAspekt = useMemo(() => {
    const out = new Map<string, number>();
    for (const a of PRUEF_ASPEKTE) {
      out.set(a.id, fundstellenFuerAspekte([a.id], mapping, gliederung, markdown).length);
    }
    return out;
  }, [mapping, gliederung, markdown]);

  const fundstellen = useMemo(
    () => fundstellenFuerAspekte([aspektId], mapping, gliederung, markdown),
    [aspektId, mapping, gliederung, markdown],
  );

  const aspekt = PRUEF_ASPEKTE.find(a => a.id === aspektId)!;

  if (mapping === null) {
    return (
      <p className="text-[13px] text-[var(--tf-text-secondary)]">
        Die Zuordnung der Abschnitte zu den Prüfaspekten steht noch aus. Sie entsteht
        in einem internen Analyse-Lauf über die Vorhabensbeschreibung — starten Sie
        ihn im Reiter „Vorhabensbeschreibung". Die Gliederung selbst ist auch ohne
        diesen Lauf vollständig lesbar.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
      <nav className="flex flex-col gap-0.5">
        {PRUEF_ASPEKTE.map(a => {
          const anzahl = proAspekt.get(a.id) ?? 0;
          const aktiv = a.id === aspektId;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAspektId(a.id)}
              className="text-left rounded px-2 py-1.5 cursor-pointer transition flex items-baseline justify-between gap-2"
              style={{
                background: aktiv ? 'color-mix(in srgb, var(--tf-primary) 10%, var(--tf-bg))' : 'transparent',
                color: aktiv ? 'var(--tf-primary)' : 'var(--tf-text-secondary)',
              }}
            >
              <span className="text-[12.5px] leading-snug">
                <span className="font-mono text-[11px] mr-1">{a.id}</span>
                {a.name}
              </span>
              <span
                className="text-[11px] tabular-nums shrink-0"
                style={{ color: anzahl === 0 ? 'var(--tf-text-tertiary)' : 'inherit' }}
              >
                {anzahl}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">{aspekt.name}</h3>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5 mb-3">{aspekt.fokus}</p>

        {fundstellen.length === 0 ? (
          <div
            className="rounded px-3 py-2.5 text-[12.5px]"
            style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
          >
            <p className="text-[var(--tf-text)] font-medium">0 Fundstellen</p>
            <p className="text-[var(--tf-text-secondary)] mt-0.5">
              Zu diesem Prüfaspekt ist in der Vorhabensbeschreibung kein Abschnitt
              zugeordnet. Das ist selbst ein Befund — nicht nur eine leere Ansicht.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {fundstellen.map(f => (
              <article
                key={f.sektionId}
                className="rounded px-3 py-2.5"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <p className="text-[12.5px] font-medium text-[var(--tf-text)]">
                  {f.nummer != null && <span className="font-mono mr-1.5">{f.nummer}</span>}
                  {f.titel}
                </p>
                <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5">
                  {f.auszug.length > 0 ? f.auszug : <em>Abschnitt ohne Fliesstext.</em>}
                </p>
                {f.ueberAspekte.length > 1 && (
                  <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5">
                    Auch zugeordnet zu: {f.ueberAspekte.filter(a => a !== aspektId).join(', ')}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
