/**
 * Reiter „Ebenen" — **die Karte des Status-Systems mit Live-Zahlen.**
 *
 * Rein darstellend: nichts wird hier gepflegt. Das ist Absicht — ein weiterer
 * Pflegeort war das Problem, nicht die Lösung. Die Seite beantwortet eine Frage,
 * die keine der anderen beantwortet: *was hängt woran, und wer pflegt es?*
 *
 * Modell und Begründung in [ebenenModell.ts](./ebenenModell.ts).
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { isMeilensteinMonitoringEnabled } from '@/config/feature-flags';
import { freigegebeneFassung, ladePlan } from '@/core/meilensteine';
import { getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import { zaehlwort } from '@/core/utils/zaehlwort';
import { baueEbenenUebersicht, type EbenenZeile } from './ebenenModell';
import type { StatusCockpitApi } from './useStatusCockpit';

function Block({ titel, satz, zeilen }: {
  titel: string; satz: string; zeilen: EbenenZeile[];
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[13.5px] font-medium text-[var(--tf-text)]">{titel}</h3>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">{satz}</p>
      </div>
      <div className="flex flex-col gap-1">
        {zeilen.map(z => (
          <div
            key={z.name}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-[10px] bg-[var(--tf-bg)] px-3 py-2"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{z.name}</span>
            <span className="text-[12.5px] tabular-nums text-[var(--tf-text)]">{z.wert}</span>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{z.pflege}</span>
            {z.hinweis !== undefined && (
              <span className="w-full text-[11.5px] text-[var(--tf-text-tertiary)]">{z.hinweis}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function EbenenUebersichtTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const idb = useStorage().idb;
  // `undefined` = noch nicht geladen, `null` = keine freigegebene Fassung.
  const [msFassung, setMsFassung] = useState<number | null | undefined>(
    isMeilensteinMonitoringEnabled() ? undefined : null,
  );

  useEffect(() => {
    if (!isMeilensteinMonitoringEnabled()) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const geladen = await ladePlan(idb);
        const plan = freigegebeneFassung(geladen.plan);
        if (!abgebrochen) setMsFassung(plan?.version ?? null);
      } catch {
        if (!abgebrochen) setMsFassung(null);
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb]);

  const entwurf = api.entwurf;
  if (!entwurf) return null;
  const u = baueEbenenUebersicht(entwurf, api.csvSpalten, msFassung);

  return (
    <div className="flex flex-col gap-5 pt-3">
      <Block
        titel="Was aus dem Fachsystem kommt"
        satz={'Fremddaten. Sie kommen per Import und gelten, wie sie sind — wir erfinden davon '
          + 'nichts und leiten daraus keinen Status ab.'}
        zeilen={u.fremd}
      />

      <Block
        titel="Was wir darüber legen"
        satz={'Zwei eigene Achsen. Die eine ist beweglich, weil ihr Zuschnitt fachlich strittig '
          + 'ist; die andere steht still, weil die ABs täglich auf sie schauen.'}
        zeilen={u.eigen}
      />

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[13.5px] font-medium text-[var(--tf-text)]">
            Verfahrensschritt × Arbeitsliste
          </h3>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            Welche Arbeitslisten die Codes eines Schritts tragen. Mehrere je Schritt sind
            richtig und der sichtbare Beleg dafür, dass die beiden Achsen getrennt sind:
            ein anderer Zuschnitt ändert diese Spalte rechts nicht.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {u.schritte.map(s => (
            <div
              key={s.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-[10px] bg-[var(--tf-bg)] px-3 py-2"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <span className="min-w-[9rem] text-[12.5px] font-medium text-[var(--tf-text)]">
                {s.label}
              </span>
              <span className="text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)]">
                {zaehlwort(s.codeAnzahl, 'Status', 'Status')}
              </span>
              <span className="flex-1 text-[12px] text-[var(--tf-text-secondary)]">
                {s.arbeitslisten.length === 0
                  ? '—'
                  : s.arbeitslisten
                    .map(a => `${getStatusCategoryLabel(a.kategorie)} (${a.anzahl})`)
                    .join(' · ')}
              </span>
            </div>
          ))}
          {u.ohneSchritt > 0 && (
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              {zaehlwort(u.ohneSchritt, 'Status läuft', 'Status laufen')} ohne Verfahrensschritt
              neben dem Verfahren (Marker) — sie sind „Ohne Zuordnung".
            </p>
          )}
        </div>
      </section>

      <Block
        titel="Wann etwas zu spät ist"
        satz={'Zwei Systeme, zwei Fragen, zwei Freigabe-Begriffe. Auf der Startseite stehen sie '
          + 'in EINER Liste („Fristen") — jede Zeile nennt dort, aus welchem der beiden sie kommt.'}
        zeilen={u.fristen}
      />
    </div>
  );
}
