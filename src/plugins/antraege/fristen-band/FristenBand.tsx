/**
 * Das **FristenBand** — die Bearbeitungsfrist als Achse plus Herleitung.
 *
 * **Reine Anzeige.** Alles kommt fertig herein (`FristenBandModell`); hier wird
 * nichts nachgerechnet und keine zweite Schwelle gesetzt — der Stillstand kommt
 * aus `pruefeStillstand`, die Zieltage aus dem Katalog, die Ampel aus derselben
 * Stufentabelle wie der Punkt in der Tabellenspalte.
 *
 * **Band UND beschriftete Liste in einem Bauteil.** Der Verlaufs-Reiter hält
 * fest: „Eine Grafik kann Zahlen unterschlagen; ein Listeneintrag nicht." Die
 * Achse zeigt die Lage, der Text darunter nennt jede Zahl — deshalb ersetzt das
 * Band die schlichte Liste aus Phase 2, statt sich danebenzustellen.
 */
import { MeilensteinLeiste } from '@/plugins/meilensteine/MeilensteinLeiste';
import { PROGNOSE_FARBE, PROGNOSE_LABEL, formatDatum } from '@/plugins/meilensteine/labels';
import { ZUSTAND_FARBE, ZUSTAND_LABEL } from '@/plugins/meilensteine/labels';
import type { MeilensteinKnoten, VerbundMeilensteine } from '@/core/meilensteine/typen';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import { AMPEL_COLOR } from '../eingangAmpel';
// Der Wortlaut liegt seit v3.38 daneben: die Verlaufs-Bahn markiert dasselbe
// Urteil am Achsenende und muss dieselbe Vokabel nennen.
import { URTEIL_FARBE, URTEIL_LABEL } from '../waechterLabels';
import type { BandMarke, FristenBandModell } from './fristenBandModell';

const leise = 'text-[11px] text-[var(--tf-text-tertiary)]';

/** Die Achse. Ohne Spanne (kein Basis- oder Zieldatum) gibt es nichts zu zeichnen. */
function Achse({ marken }: { marken: readonly BandMarke[] }): React.ReactElement | null {
  if (marken.length === 0) return null;
  const bezug = marken.find(m => m.art === 'bezug');
  return (
    <div className="flex flex-col gap-1 pt-1 pb-0.5">
      <div className="relative h-[6px] rounded-full bg-[var(--tf-bg-secondary)]">
        {bezug && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--tf-primary)] opacity-40"
            style={{ width: `${bezug.anteil * 100}%` }}
          />
        )}
        {marken.map(m => (
          <div
            key={m.art}
            className="absolute top-[-3px] w-[2px] h-[12px] rounded-full bg-[var(--tf-text-secondary)]"
            style={{ left: `calc(${m.anteil * 100}% - 1px)` }}
            title={`${m.label}: ${formatDatumsWert(m.tag)}`}
          />
        ))}
      </div>
      <div className="relative h-[13px]">
        {marken.map(m => (
          <span
            key={m.art}
            className={`absolute whitespace-nowrap ${leise}`}
            style={{
              left: `${m.anteil * 100}%`,
              transform: m.anteil === 0 ? 'none' : m.anteil === 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {formatDatumsWert(m.tag)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Zeile({ label, wert, hinweis, weich }: {
  label: string; wert: string; hinweis?: string; weich?: true;
}): React.ReactElement {
  return (
    <li className="flex items-baseline gap-2 flex-wrap text-[12px]">
      <span className="text-[var(--tf-text-secondary)] w-[150px] shrink-0">{label}</span>
      <span className={weich ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'}>
        {/^\d{4}-\d{2}-\d{2}/.test(wert) ? formatDatumsWert(wert) : wert}
      </span>
      {hinweis !== undefined && <span className={leise}>{hinweis}</span>}
    </li>
  );
}

export function FristenBand({ modell, meilensteine, knoten }: {
  modell: FristenBandModell;
  /** Die volle Bewertung — nur für Prognose und Leiste; die Auswahl steckt im Modell. */
  meilensteine: VerbundMeilensteine | null;
  knoten: MeilensteinKnoten[];
}): React.ReactElement {
  const w = modell.waechter;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className={`uppercase tracking-wider ${leise}`}>Bearbeitungsfrist</p>

        <div className="flex items-baseline gap-2 flex-wrap">
          {modell.ampel !== null && (
            <span
              className="shrink-0 w-2 h-2 rounded-full self-center"
              style={{ background: AMPEL_COLOR[modell.ampel] }}
              aria-hidden="true"
            />
          )}
          <span className="text-[15px] text-[var(--tf-text)] tabular-nums">{modell.kopf}</span>
          {modell.grund !== null && (
            <span className="text-[12px] text-[var(--tf-text-secondary)]">{modell.grund}</span>
          )}
        </div>

        <Achse marken={modell.marken} />

        <ul className="flex flex-col gap-0.5 pt-0.5">
          {modell.zeilen.map(z => <Zeile key={z.label} {...z} />)}
        </ul>

        <p className={`${leise} pt-1`}>{modell.ampelErklaerung}</p>
      </div>

      {w !== null && (
        <div className="flex flex-col gap-0.5">
          <p className={`uppercase tracking-wider ${leise}`}>Stillstand</p>
          <div className="flex items-baseline gap-2 flex-wrap text-[12px]">
            <span style={{ color: URTEIL_FARBE[w.urteil] }}>{URTEIL_LABEL[w.urteil]}</span>
            <span className="text-[var(--tf-text-secondary)]">{w.grund}</span>
            {w.letzteAktivitaet !== null && (
              <span className={leise}>
                letzte Aktivität {formatDatumsWert(w.letzteAktivitaet)}
                {w.belegt ? ' (belegt)' : ' (genähert aus dem Export)'}
              </span>
            )}
          </div>
        </div>
      )}

      {meilensteine !== null && (
        <div className="flex flex-col gap-1.5">
          <p className={`uppercase tracking-wider ${leise}`}>Meilensteine</p>
          <div className="flex items-baseline gap-3 flex-wrap text-[12px]">
            <span style={{ color: PROGNOSE_FARBE[meilensteine.prognose] }}>
              {PROGNOSE_LABEL[meilensteine.prognose]}
            </span>
            <span className="text-[var(--tf-text-secondary)]">
              Frist {formatDatum(meilensteine.fristDatum)}
            </span>
            {meilensteine.wocheAktuell !== null && (
              <span className={leise}>Bearbeitungswoche {meilensteine.wocheAktuell}</span>
            )}
          </div>
          <MeilensteinLeiste bewertung={meilensteine} knoten={knoten} />
          {(modell.verstrichen.length > 0 || modell.kommend.length > 0) && (
            <ul className="flex flex-col gap-0.5">
              {[...modell.verstrichen, ...modell.kommend].map(m => {
                const k = knoten.find(x => x.id === m.knotenId);
                return (
                  <li key={m.knotenId} className="flex items-baseline gap-2 flex-wrap text-[12px]">
                    <span
                      className="w-[92px] shrink-0 text-right"
                      style={{ color: ZUSTAND_FARBE[m.zustand] }}
                    >
                      {ZUSTAND_LABEL[m.zustand]}
                    </span>
                    <span className="text-[var(--tf-text)]">{k?.nummer} {k?.label}</span>
                    <span className={leise}>Soll {formatDatum(m.sollDatum)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
