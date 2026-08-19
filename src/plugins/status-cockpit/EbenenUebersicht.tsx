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
import {
  baueEbenenUebersicht, type ArbeitslistenAnteile, type EbenenZeile,
} from './ebenenModell';
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

/** Eine Zeile der Tabelle „Verfahrensschritt × Arbeitsliste". */
function SchrittRow({ label, anzahl, anteile }: {
  label: string; anzahl: number; anteile: ArbeitslistenAnteile;
}): React.ReactElement {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-[10px] bg-[var(--tf-bg)] px-3 py-2"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="min-w-[9rem] text-[12.5px] font-medium text-[var(--tf-text)]">{label}</span>
      <span className="text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)]">
        {zaehlwort(anzahl, 'Status', 'Status')}
      </span>
      <span className="flex-1 text-[12px] text-[var(--tf-text-secondary)]">
        {anteile.length === 0
          ? '—'
          : anteile.map(a => `${getStatusCategoryLabel(a.kategorie)} (${a.anzahl})`).join(' · ')}
      </span>
    </div>
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
  const u = baueEbenenUebersicht(
    entwurf, api.csvSpalten, msFassung, api.trigger.datei?.trigger.length ?? 0,
  );

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
        satz={'Unsere eigenen Achsen. Die erste ist beweglich, weil ihr Zuschnitt fachlich '
          + 'strittig ist; die zweite steht still, weil die ABs täglich auf sie schauen; die '
          + 'dritte sagt, wer als Nächstes dran ist — ohne den amtlichen Status anzufassen.'}
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
            <SchrittRow key={s.id} label={s.label} anzahl={s.codeAnzahl} anteile={s.arbeitslisten} />
          ))}
          {/* „Neben dem Verfahren" ist ein Schritt-Zustand wie jeder andere und
              bekommt deshalb dieselbe Zeile — bis v4.119 stand hier ein Satz,
              der die Gruppe pauschal zu Markern erklärte und ihr die
              Arbeitsliste „Ohne Zuordnung" andichtete. Beides folgt nicht: das
              Marker-Kennzeichen ist ein eigenes Feld, und die Arbeitsliste
              hängt am Code. */}
          {u.ohneSchritt.codeAnzahl > 0 && (
            <SchrittRow
              label="Ohne Verfahrensschritt"
              anzahl={u.ohneSchritt.codeAnzahl}
              anteile={u.ohneSchritt.arbeitslisten}
            />
          )}
          {u.ohneSchritt.codeAnzahl > 0 && (
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              Sie laufen neben dem Verfahren; ihre Arbeitsliste hängt trotzdem am Code.
              {/* Nur nennen, wenn beide Sichten AUSEINANDERFALLEN. Wer im Baum
                  umhängt, setzt `marker` und `zahPhaseId` gemeinsam
                  (`setzeCodePhasen`) — „5 von 5 sind Marker" sagt dann nichts.
                  Eine importierte Fassung kann beides getrennt führen, und
                  genau das ist die Auskunft, die hier fehlte. */}
              {u.ohneSchritt.markerAnzahl < u.ohneSchritt.codeAnzahl && (
                ` ${u.ohneSchritt.codeAnzahl - u.ohneSchritt.markerAnzahl} davon führt die Fassung`
                + ' NICHT als Marker — sie haben bloß keinen Schritt.'
              )}
            </p>
          )}
          {u.verwaist > 0 && (
            <p className="text-[11.5px] text-[var(--tf-warning-text)]">
              {zaehlwort(u.verwaist, 'Status zeigt', 'Status zeigen')} auf einen
              Verfahrensschritt, den diese Fassung nicht mehr führt — oben mitgezählt unter
              „Ohne Verfahrensschritt".
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
