/**
 * Die rechte Spalte. Lesend — hier steht kein Eingabefeld.
 *
 * Ohne Auswahl steht hier, was das Glossar ist und was es NICHT ist: ein
 * Nachschlagewerk, kein Ort zum Ändern. Wer den Unterschied nicht kennt, sucht
 * sonst genau hier den Stift und findet ihn nicht.
 */
import { useNavigation } from '@/core/hooks/useNavigation';
import { isStatusCockpitEnabled } from '@/config/feature-flags';
import { GLOSSAR_BEGRIFFE, type GlossarBegriff } from '@/core/glossar';
import type { MappingVersion, TriggerStand } from '@/core/status';
import { verwandteIds, type GlossarEintrag } from './glossarSuche';
import { DetailKopf } from './GlossarFelder';
import { StatuswertDetail } from './StatuswertDetail';
import { KuerzelDetail } from './KuerzelDetail';

/** Der Verweis auf den Ort, an dem wirklich kuriert wird. */
function KurationsHinweis(): React.ReactElement {
  const { navigate } = useNavigation();
  if (!isStatusCockpitEnabled()) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Geändert wird hier nichts: Statuswerte, Kürzel und Regeln werden unter
        „Vorgangs-Regeln" gepflegt — in dieser Ausgabe der App ist die Seite nicht
        enthalten.
      </p>
    );
  }
  return (
    <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
      Geändert wird hier nichts. Statuswerte, Kürzel und Regeln werden unter{' '}
      <button
        type="button"
        onClick={() => navigate('status-cockpit')}
        className="cursor-pointer text-[var(--tf-primary)] underline underline-offset-2"
      >
        Vorgangs-Regeln
      </button>{' '}
      gepflegt und als Fassung für das Team veröffentlicht.
    </p>
  );
}

export function GlossarLeer(): React.ReactElement {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-5">
      <h2 className="text-[15px] font-semibold text-[var(--tf-text)]">Nachschlagen</h2>
      <p className="text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">
        Was heißt NF, RNE oder ZuwB? Welcher Verfahrensschritt gehört zu Status 34, und
        welche Kürzel sind für meine Rolle wichtig? Oben suchen oder links einen Eintrag
        wählen.
      </p>
      <KurationsHinweis />
      <p className="text-[12.5px] leading-relaxed text-[var(--tf-text-tertiary)]">
        Bis auf die Abkürzungen steht hier nichts Eigenes: Statuswerte, Kürzel und Regeln
        kommen aus der geltenden Fassung, ihre Wirkung aus der importierten
        Trigger-Tabelle. Fehlt eine davon, sagt die Seite das an der Stelle, an der sie
        fehlt.
      </p>
    </div>
  );
}

function Verwandte({ b, onWaehlen }: {
  b: GlossarBegriff;
  onWaehlen: (id: string) => void;
}): React.ReactElement | null {
  const ids = verwandteIds(b, GLOSSAR_BEGRIFFE);
  if (ids.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5 border-t border-[var(--tf-border)] pt-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
        Siehe auch
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {ids.map(id => {
          const ziel = GLOSSAR_BEGRIFFE.find(x => x.id === id);
          if (!ziel) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onWaehlen(`begriff:${id}`)}
              title={ziel.lang ?? ziel.begriff}
              className="cursor-pointer rounded-[var(--tf-radius-sm)] border border-[var(--tf-border)] px-2 py-0.5 text-[11.5px] text-[var(--tf-text-secondary)] transition hover:border-[var(--tf-border-hover)] hover:text-[var(--tf-text)]"
            >
              {ziel.begriff}
              {ziel.lang !== undefined && (
                <span className="ml-1 text-[var(--tf-text-tertiary)]">{ziel.lang}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BegriffDetail({ b, onWaehlen }: {
  b: GlossarBegriff;
  onWaehlen: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-5">
      <DetailKopf titel={b.begriff} unter={b.lang} />
      <p className="text-[13px] leading-relaxed text-[var(--tf-text)]">{b.erklaerung}</p>
      <Verwandte b={b} onWaehlen={onWaehlen} />
    </div>
  );
}

export function GlossarDetail({ eintrag, version, trigger, onWaehlen }: {
  eintrag: GlossarEintrag;
  /** `null` = kein Katalog geladen; dann gibt es die datengetriebenen Arten gar nicht. */
  version: MappingVersion | null;
  trigger: TriggerStand | null;
  onWaehlen: (id: string) => void;
}): React.ReactElement | null {
  switch (eintrag.art) {
    case 'begriff':
      return <BegriffDetail b={eintrag.begriff} onWaehlen={onWaehlen} />;
    case 'statuswert':
      return version === null ? null : (
        <StatuswertDetail zeile={eintrag.zeile} version={version} trigger={trigger} />
      );
    case 'kuerzel':
      return version === null ? null : (
        <KuerzelDetail
          zeile={eintrag.zeile} version={version} trigger={trigger}
          onStatus={code => onWaehlen(`statuswert:${code}`)}
        />
      );
  }
}
