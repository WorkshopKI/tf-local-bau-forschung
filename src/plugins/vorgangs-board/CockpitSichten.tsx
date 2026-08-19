/**
 * Die beiden Cockpit-Sichten des Vorgangs-Boards — **Fristen** (Bearbeiter) und
 * **Auswertung** (PL). Sie ersetzen die von Hand gepflegten XLSX-Listen.
 *
 * Sie sitzen hier und nicht im Meilenstein-Plugin, weil sie auf **derselben**
 * bereits gerechneten Menge arbeiten wie das Board: Status, ZAH-Phase, To-do,
 * Wächter-Urteil und Restfrist entstehen in EINEM Durchlauf über die Anträge.
 * Ein zweiter Ort hieße ein zweiter Durchlauf über 14 000 Datensätze — und, was
 * schwerer wiegt, eine zweite Ableitung derselben Zahlen, die auseinanderlaufen
 * kann.
 *
 * **Kein Wochentrend.** Dafür bräuchte es eine Historisierung der Bestände; der
 * Export liefert immer nur den Stand von heute Nacht. Eine „Entwicklung", die in
 * Wahrheit ein Momentwert ist, wäre eine Erfindung.
 */
import { ROLLE_LABEL, type Rolle, type ZahPhaseId } from '@/core/status';
import { Button } from '@/components/ui/button';
import { WennSichtbar } from '@/components/sichtbarkeit';
import { abschnittId } from '@/core/sichtbarkeit';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { ampelVon, sichtVon, type BoardZeile, type VorgangsBoardApi } from './useVorgangsBoard';
import { exportiereCockpitXlsx } from './cockpit-export';

const AMPEL_FARBE: Record<'rot' | 'gelb' | 'gruen', string> = {
  rot: 'var(--tf-danger-text)',
  gelb: 'var(--tf-warning-text)',
  gruen: 'var(--tf-text-tertiary)',
};

/**
 * Eine Karte der Auswertung — einzeln kennzeichenbar (Beta/Experte).
 *
 * Die Id kommt als fertige Zeichenkette vom Aufrufer und wird NICHT hier aus
 * einem Prop zusammengesetzt: nur so steht jede Katalog-Id als Literal im Baum,
 * und der Guard `sichtbarkeit-ids-existieren` kann sie finden.
 */
function Karte({ id, children }: { id: string; children: React.ReactNode }): React.ReactElement | null {
  return (
    <WennSichtbar id={id}>
      <section className="flex flex-col gap-2">{children}</section>
    </WennSichtbar>
  );
}

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle text-[12px]';

function tagDe(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Ein Export-Knopf, der den Fehlerfall zeigt statt ihn zu schlucken (#15). */
function ExportKnopf({ zeilen, sicht, rolle }: {
  zeilen: BoardZeile[];
  sicht: 'fristen' | 'auswertung';
  rolle: Rolle | 'alle';
}): React.ReactElement {
  // Die Rolle geht mit: der Export zeigt GENAU die Sicht, die auf dem Schirm
  // steht — sonst enthielte die weitergegebene Datei ein anderes To-do als das,
  // was der Absender gesehen hat.
  const aktion = useAsyncAction(async () => { await exportiereCockpitXlsx(zeilen, sicht, rolle); });
  return (
    <span className="flex items-center gap-2">
      <Button variant="secondary" size="sm" disabled={aktion.busy} onClick={() => aktion.run()}>
        {aktion.busy ? 'Exportiert …' : 'Als XLSX'}
      </Button>
      {aktion.error != null && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {aktion.error}</span>
      )}
    </span>
  );
}

/**
 * Bearbeiter-Sicht: meine Anträge nach Restfrist.
 *
 * Gerechnet ab **wirksamem Eingang** (spätestes von Antragseingang und „alle
 * Anträge da") — so startet die AB-Mappe ihre Uhr. Das Datum steht in einer
 * eigenen Spalte, damit man sieht, worauf sich die Restfrist bezieht.
 */
export function FristenSicht({ api }: { api: VorgangsBoardApi }): React.ReactElement {
  const zeilen = [...api.zeilen]
    .filter(z => z.fristLaeuft && z.restTage !== null)
    .sort((a, b) => (a.restTage ?? 0) - (b.restTage ?? 0));
  const abgeschlossen = api.zeilen.filter(z => !z.fristLaeuft).length;
  const ohneFrist = api.zeilen.length - zeilen.length - abgeschlossen;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Restfrist ab wirksamem Eingang (spätestes von Antragseingang und „alle Anträge da"),
          90 Tage in der Antragsphase. Rot ab {14} Tagen, gelb ab {30}.
        </p>
        <span className="ml-auto" />
        <ExportKnopf zeilen={zeilen} sicht="fristen" rolle={api.rolle} />
      </div>

      {(ohneFrist > 0 || abgeschlossen > 0) && (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Nicht in der Liste (und nicht im Export):
          {abgeschlossen > 0 && ` ${abgeschlossen} abgeschlossene Vorgänge — für sie läuft keine Frist mehr`}
          {abgeschlossen > 0 && ohneFrist > 0 && ','}
          {ohneFrist > 0 && ` ${ohneFrist} ohne Eingangsdatum`}.
        </p>
      )}

      <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--tf-border)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
              <th className={thKlasse}>Aktenzeichen</th>
              <th className={thKlasse}>Kurzname</th>
              <th className={thKlasse}>Status</th>
              <th className={thKlasse}>wirksamer Eingang</th>
              <th className={`${thKlasse} text-right`}>Restfrist</th>
              <th className={thKlasse}>To-do</th>
              <th className={thKlasse}>Wächter</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map(z => {
              const ampel = ampelVon(z.restTage);
              return (
                <tr key={z.aktenzeichen} className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
                  <td className={`${tdKlasse} font-mono whitespace-nowrap`}>{z.aktenzeichen}</td>
                  <td className={`${tdKlasse} max-w-[320px] truncate`} title={z.titel}>{z.titel}</td>
                  <td className={`${tdKlasse} text-[var(--tf-text-secondary)] whitespace-nowrap`}>{z.statusRoh}</td>
                  <td className={`${tdKlasse} text-[var(--tf-text-tertiary)] whitespace-nowrap`}>
                    {tagDe(z.wirksamerEingang)}
                  </td>
                  <td
                    className={`${tdKlasse} text-right tabular-nums whitespace-nowrap`}
                    style={ampel ? { color: AMPEL_FARBE[ampel] } : undefined}
                  >
                    {z.restTage !== null && z.restTage < 0 ? `${-z.restTage} T über` : `${z.restTage} T`}
                  </td>
                  <td className={`${tdKlasse} text-[var(--tf-text-secondary)]`}>{sichtVon(z, api.rolle).todo ?? '—'}</td>
                  <td className={`${tdKlasse} whitespace-nowrap`} title={z.waechter.grund}>
                    {z.waechter.urteil === 'haengt'
                      ? <span style={{ color: 'var(--tf-warning-text)' }}>hängt {z.waechter.tage} T</span>
                      : z.waechter.urteil === 'unbewertet'
                        ? <span className="text-[var(--tf-text-tertiary)]">nicht bewertbar</span>
                        : <span className="text-[var(--tf-text-tertiary)]">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {zeilen.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
          Kein Vorgang mit berechenbarer Frist in dieser Auswahl.
        </p>
      )}
    </div>
  );
}

/** Ein Balken der Phasen-Verteilung. */
function Balken({ label, anzahl, max }: { label: string; anzahl: number; max: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[130px] shrink-0 truncate text-[12px] text-[var(--tf-text-secondary)]">{label}</span>
      <span className="flex-1 h-[10px] rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{ width: `${max > 0 ? (anzahl / max) * 100 : 0}%`, background: 'var(--tf-primary)' }}
        />
      </span>
      <span className="w-[56px] shrink-0 text-right text-[12px] tabular-nums text-[var(--tf-text-secondary)]">
        {anzahl.toLocaleString('de-DE')}
      </span>
    </div>
  );
}

/**
 * PL-Sicht: wo steht der Bestand, wo klemmt es, was läuft ab.
 *
 * Die Verweildauer ist eine **Näherung** — gemessen wird die Zeit seit der
 * jüngsten Vorgangs-Aktivität, nicht die echte Verweildauer im Status. Deshalb
 * steht n an jeder Zeile: eine Zahl aus zwei Proben sieht sonst aus wie eine aus
 * dreihundert.
 */
export function AuswertungSicht({ api }: { api: VorgangsBoardApi }): React.ReactElement {
  const proPhase = new Map<string, number>();
  for (const z of api.zeilen) {
    const k = z.zahPhase ?? '(ohne Phase)';
    proPhase.set(k, (proPhase.get(k) ?? 0) + 1);
  }
  const phasenReihe = [...(api.version?.zahPhasen ?? [])]
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .map(p => ({ id: p.id as string, label: p.label }));
  const balken = [
    ...phasenReihe.filter(p => proPhase.has(p.id)),
    ...(proPhase.has('(ohne Phase)') ? [{ id: '(ohne Phase)', label: 'Marker / ohne Phase' }] : []),
  ];
  const max = Math.max(1, ...balken.map(b => proPhase.get(b.id) ?? 0));

  /** Verweildauer je Status-Text — aus dem Wächter, damit die Zahlen zusammenpassen. */
  const proStatus = new Map<string, number[]>();
  for (const z of api.zeilen) {
    if (z.waechter.tage === null || z.statusRoh === '') continue;
    const list = proStatus.get(z.statusRoh);
    if (list) list.push(z.waechter.tage); else proStatus.set(z.statusRoh, [z.waechter.tage]);
  }
  const verweil = [...proStatus].map(([status, werte]) => {
    const s = [...werte].sort((a, b) => a - b);
    const median = s.length % 2 === 1
      ? s[(s.length - 1) / 2]!
      : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
    return {
      status,
      median,
      p90: s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)]!,
      n: s.length,
    };
  }).sort((a, b) => b.median - a.median);

  const risiko = api.zeilen
    .filter(z => z.fristLaeuft && z.restTage !== null && z.restTage <= 30)
    .sort((a, b) => (a.restTage ?? 0) - (b.restTage ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <Karte id={abschnittId('vorgangs-board', 'karte-phasenverteilung')}>
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Verteilung über die ZAH-Phasen</h3>
          <span className="ml-auto" />
          <ExportKnopf zeilen={api.zeilen} sicht="auswertung" rolle={api.rolle} />
        </div>
        {balken.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Keine Phasen zugeordnet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {balken.map(b => (
              <Balken key={b.id} label={b.label} anzahl={proPhase.get(b.id) ?? 0} max={max} />
            ))}
          </div>
        )}
      </Karte>

      <Karte id={abschnittId('vorgangs-board', 'karte-stau')}>
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Stau je Rolle</h3>
        {api.stau.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Kein Vorgang über seinen Zieltagen.</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {api.stau.map(s => (
              <span key={String(s.rolle)} className="text-[12.5px] text-[var(--tf-text-secondary)]">
                <strong className="text-[var(--tf-text)]">{s.anzahl}</strong>{' '}
                {s.rolle === 'offen' ? 'ohne Rollen-Zuordnung'
                  : s.rolle === 'ast' ? 'beim Antragsteller' : `bei ${ROLLE_LABEL[s.rolle]}`}
              </span>
            ))}
          </div>
        )}
        {api.unbewertet > 0 && (
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {api.unbewertet} Vorgänge sind nicht bewertbar — für ihren Status sind keine Zieltage
            gepflegt. Sie sind in keiner der Zahlen oben enthalten.
          </p>
        )}
      </Karte>

      <Karte id={abschnittId('vorgangs-board', 'karte-liegezeit')}>
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">
          Liegezeit je Status <span className="font-normal text-[11.5px] text-[var(--tf-text-tertiary)]">
            — Näherung: Tage seit der jüngsten Vorgangs-Aktivität
          </span>
        </h3>
        <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--tf-border)' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
                <th className={thKlasse}>Status</th>
                <th className={`${thKlasse} text-right`}>Median</th>
                <th className={`${thKlasse} text-right`}>p90</th>
                <th className={`${thKlasse} text-right`}>n</th>
              </tr>
            </thead>
            <tbody>
              {verweil.map(v => (
                <tr key={v.status} className="border-b border-[var(--tf-border)]">
                  <td className={tdKlasse}>{v.status}</td>
                  <td className={`${tdKlasse} text-right tabular-nums`}>{v.median}</td>
                  <td className={`${tdKlasse} text-right tabular-nums text-[var(--tf-text-secondary)]`}>{v.p90}</td>
                  <td className={`${tdKlasse} text-right tabular-nums text-[var(--tf-text-tertiary)]`}>{v.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Karte>

      <Karte id={abschnittId('vorgangs-board', 'karte-fristrisiko')}>
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">
          Fristrisiko <span className="font-normal text-[11.5px] text-[var(--tf-text-tertiary)]">
            — 30 Tage oder weniger
          </span>
        </h3>
        {risiko.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Kein Vorgang unter 30 Tagen Restfrist.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {risiko.slice(0, 20).map(z => (
              <li key={z.aktenzeichen} className="flex items-baseline gap-2 text-[12px]">
                <span className="font-mono text-[var(--tf-text-secondary)] shrink-0">{z.aktenzeichen}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--tf-text)]" title={z.titel}>{z.titel}</span>
                <span
                  className="shrink-0 tabular-nums"
                  style={{ color: AMPEL_FARBE[ampelVon(z.restTage) ?? 'gruen'] }}
                >
                  {z.restTage !== null && z.restTage < 0 ? `${-z.restTage} T über` : `${z.restTage} T`}
                </span>
              </li>
            ))}
            {risiko.length > 20 && (
              <li className="text-[11px] text-[var(--tf-text-tertiary)]">
                +{risiko.length - 20} weitere — vollständig im XLSX-Export.
              </li>
            )}
          </ul>
        )}
      </Karte>

      {/* Was hier bewusst FEHLT, gehört genannt — sonst sucht man es. */}
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">
        Kein Wochentrend: der Export liefert nur den Stand von heute Nacht, eine Entwicklung ließe
        sich daraus nicht ablesen, sondern nur behaupten.
      </p>
    </div>
  );
}

/** Nur für den Export-Header gebraucht — die Phasen-Ids sind sonst intern. */
export type { ZahPhaseId };
