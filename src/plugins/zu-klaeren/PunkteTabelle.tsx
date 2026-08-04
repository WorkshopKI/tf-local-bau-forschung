/**
 * Die Zuordnungstabelle: je Phase eine Gruppe, darunter ihre Codes.
 *
 * **Die Phase steht in der Überschrift, nicht in jeder Zeile.** Bei 30 Zeilen wäre
 * eine Phasen-Spalte 30-mal fast dasselbe Wort und nähme der Bezeichnung den Platz,
 * den sie braucht. Die Überschrift trägt dafür Anzahl Codes und Summe der
 * Vorkommen — eine Zuordnung mit 222 Vorgängen wiegt anders als eine mit dreien.
 *
 * Uneinigkeit wird **ruhig** markiert: ein Punkt und ein Wort, kein Warnrot. Sie
 * ist das erwartete Ergebnis des Termins, kein Fehler.
 */
import { Fragment, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { thKlasse, tdKlasse, rahmenStil, zielLabel, kurzDatum } from './labels';
import { AntwortZelle } from './AntwortZelle';
import { PunktKommentare } from './PunktKommentare';
import { beitraegeSortiert, type EintragEingabe } from './fold';
import type { GruppeAnsicht, ZeileAnsicht } from './gruppen';
import type { KlaerungStand } from './typen';

const SPALTEN = 5;

/** Was jede Ebene der Tabelle zum Antworten braucht. */
interface AntwortKontext {
  stand: KlaerungStand;
  meinKuerzel: string | undefined;
  gesperrt: boolean;
  sperrGrund: string;
  aeussern: (eingabe: Omit<EintragEingabe, 'autor'>) => Promise<void>;
}

/** Der ruhige Uneinigkeits-/Rückfrage-Marker einer Zeile. */
function Marke({ zeile }: { zeile: ZeileAnsicht }): React.ReactElement | null {
  const { zustand, unklarVon, ziel } = zeile.befund;
  if (zustand === 'strittig') {
    return (
      <span
        className="text-[11.5px] text-[var(--tf-text)]"
        title="Zwei oder mehr verschiedene Zielphasen genannt"
      >• strittig</span>
    );
  }
  if (unklarVon.length > 0) {
    return (
      <span
        className="text-[11.5px] text-[var(--tf-text-secondary)]"
        title={`Rückfrage von ${unklarVon.join(', ')}`}
      >• Rückfrage</span>
    );
  }
  if (zustand === 'einig' && ziel !== null && ziel !== zeile.punkt.seedZiel) {
    return (
      <span
        className="text-[11.5px] text-[var(--tf-text-secondary)]"
        title="Einig — aber anders als ausgeliefert"
      >• → {zielLabel(ziel)}</span>
    );
  }
  return null;
}

function GruppenKopf({ gruppe }: { gruppe: GruppeAnsicht }): React.ReactElement {
  return (
    <tr>
      <td
        colSpan={SPALTEN}
        className="px-2 py-2"
        style={{
          background: 'var(--tf-bg-secondary)',
          borderTop: '0.5px solid var(--tf-border)',
          // Die Marker stehen NEBEN dem Verfahren — die Gruppe wird darum
          // abgesetzt, statt als siebte Verfahrensphase gelesen zu werden.
          ...(gruppe.istMarker ? { borderLeft: '2px solid var(--tf-border-hover)' } : {}),
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]">
            {gruppe.label}
          </span>
          <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)] tabular-nums">
            {gruppe.codeAnzahl} {gruppe.codeAnzahl === 1 ? 'Code' : 'Codes'}
            {gruppe.vorkommenSumme !== null
              && ` · ${gruppe.vorkommenSumme.toLocaleString('de-DE')} Vorgänge`}
          </span>
          <span className="flex-1 h-px bg-[var(--tf-border)]" />
        </div>
      </td>
    </tr>
  );
}

function Zeile({
  zeile, istOffen, umschalten, kontext,
}: {
  zeile: ZeileAnsicht;
  istOffen: boolean;
  umschalten: () => void;
  kontext: AntwortKontext;
}): React.ReactElement {
  const id = zeile.punkt.id;
  return (
    <>
      <tr className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
        <td className={`${tdKlasse} font-mono tabular-nums text-[var(--tf-text-secondary)]`}>
          {zeile.punkt.code}
        </td>
        <td className={tdKlasse}>{zeile.punkt.bezeichnung ?? zeile.punkt.titel}</td>
        <td className={tdKlasse}><Marke zeile={zeile} /></td>
        <td className={`${tdKlasse} text-right tabular-nums text-[var(--tf-text-secondary)]`}>
          {zeile.vorkommen === null ? '—' : zeile.vorkommen.toLocaleString('de-DE')}
        </td>
        <td className={`${tdKlasse} text-right`}>
          <div className="flex items-start justify-end gap-2">
            <AntwortZelle
              punktId={id}
              {...(zeile.meinUrteil !== undefined ? { meinUrteil: zeile.meinUrteil } : {})}
              gesperrt={kontext.gesperrt}
              sperrGrund={kontext.sperrGrund}
              aeussern={kontext.aeussern}
            />
            <button
              type="button"
              aria-expanded={istOffen}
              title={istOffen ? 'Beiträge zuklappen' : 'Beiträge zeigen'}
              onClick={umschalten}
              className="inline-flex items-center gap-1 shrink-0 px-1.5 py-1 rounded text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
            >
              <MessageSquare size={12} />
              <span className="tabular-nums">{zeile.kommentarAnzahl}</span>
            </button>
          </div>
        </td>
      </tr>

      {istOffen && (
        <tr className="border-b border-[var(--tf-border)]">
          <td colSpan={SPALTEN} className="px-4 py-3 bg-[var(--tf-bg-secondary)]">
            <PunktKommentare
              punktId={id}
              beitraege={beitraegeSortiert(kontext.stand, id)}
              meinKuerzel={kontext.meinKuerzel}
              gesperrt={kontext.gesperrt}
              sperrGrund={kontext.sperrGrund}
              aeussern={kontext.aeussern}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export function PunkteTabelle({
  gruppen, kontext, bestandVom,
}: {
  gruppen: readonly GruppeAnsicht[];
  kontext: AntwortKontext;
  /** Woher die Vorkommen-Zahlen stammen — gehört an die Spalte, nicht in eine Fußnote. */
  bestandVom: string | null;
}): React.ReactElement {
  const [offen, setOffen] = useState<string | null>(null);

  if (gruppen.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-4">
        Keine Zeile passt zum gewählten Filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded" style={rahmenStil}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
            <th className={`${thKlasse} w-[64px]`}>Code</th>
            <th className={thKlasse}>Bezeichnung</th>
            <th className={`${thKlasse} w-[132px]`}>Stand</th>
            <th
              className={`${thKlasse} text-right w-[110px]`}
              title={bestandVom === null
                ? 'Anzahl Vorgänge im lokal geladenen Bestand'
                : `Anzahl Vorgänge im Bestand vom ${kurzDatum(bestandVom)} — gezählt über den ganzen Bestand, ohne Betrachtungsbereich`}
            >
              Vorgänge
              {bestandVom !== null && (
                <span className="block font-normal text-[10px] text-[var(--tf-text-tertiary)]">
                  Stand {kurzDatum(bestandVom)}
                </span>
              )}
            </th>
            <th className={`${thKlasse} text-right w-[312px]`}>Gehört die Phase so?</th>
          </tr>
        </thead>
        <tbody>
          {gruppen.map(gruppe => (
            <Fragment key={gruppe.id}>
              <GruppenKopf gruppe={gruppe} />
              {gruppe.zeilen.map(zeile => (
                <Fragment key={zeile.punkt.id}>
                  <Zeile
                    zeile={zeile}
                    istOffen={offen === zeile.punkt.id}
                    umschalten={() => setOffen(offen === zeile.punkt.id ? null : zeile.punkt.id)}
                    kontext={kontext}
                  />
                </Fragment>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { AntwortKontext };
