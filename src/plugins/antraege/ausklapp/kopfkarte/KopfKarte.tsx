/**
 * Die Kopfkarte **„Woran es hängt"** — reine Anzeige.
 *
 * Sie beantwortet die Fragen des Entwurfs in ihrer Reihenfolge: *Wie weit über
 * der Frist?* (Urteilszeile + Herleitung), *woran hängt es?* (drei Fakten und
 * **ein** Blocker), *was ist zu tun?* (die Aktionen daneben).
 *
 * **Nur ein Blocker, nie eine Liste.** Wer eine überfällige Zeile aufklappt,
 * sucht den Ansatzpunkt. Die übrigen gerissenen Stufen stehen darunter als
 * Marken — sie erklären die Tragweite, ohne die Frage zu verdoppeln.
 *
 * **Die Karte schweigt nie.** Ohne Blocker steht der Grund dort, wo sonst der
 * Blocker steht (Pitfall #44).
 */
import { formatDatum } from '@/plugins/meilensteine/labels';
import { BLOCKIERT_MAX, type BlockerBefund } from './blocker';
import type { Fakt, KopfModell } from './kopfkarteModell';

/** Zahlwörter bis zwölf — der Entwurf schreibt „vier weitere Meilensteine". */
const ZAHLWORT = [
  'null', 'einen', 'zwei', 'drei', 'vier', 'fünf', 'sechs',
  'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf',
];

function blockiertSatz(n: number): string {
  const wort = ZAHLWORT[n] ?? String(n);
  return n === 1 ? 'Blockiert einen weiteren Meilenstein:' : `Blockiert ${wort} weitere Meilensteine:`;
}

const LEISE = 'text-[11px] text-[var(--tf-text-tertiary)]';

function FaktKachel({ fakt }: { fakt: Fakt }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 px-3 first:pl-0 last:pr-0 border-l first:border-l-0"
      style={{ borderColor: 'var(--tf-border)' }}
      title={fakt.titel}
    >
      <span className={`uppercase tracking-wider whitespace-nowrap ${LEISE}`}>{fakt.label}</span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        {fakt.farbe !== null && (
          <span
            className="shrink-0 w-[7px] h-[7px] rounded-full self-center"
            style={{ background: fakt.farbe }}
            aria-hidden="true"
          />
        )}
        <span className="text-[13px] text-[var(--tf-text)]">{fakt.wert}</span>
        {fakt.zusatz !== undefined && (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{fakt.zusatz}</span>
        )}
      </span>
    </div>
  );
}

export function KopfKarte({ modell, befund, aktionen }: {
  modell: KopfModell;
  befund: BlockerBefund;
  /** Die Aktionsknöpfe — als Slot, damit die Karte selbst nichts navigiert. */
  aktionen: React.ReactNode;
}): React.ReactElement {
  const b = befund.blocker;
  return (
    <div
      className="px-[18px] pt-[15px] pb-4 bg-[var(--tf-bg)]"
      // Radius als Zahl, nicht als `rounded-xl`: die Tailwind-Stufe hängt am
      // Theme-Radius und lag hier bei 14 px — der Entwurf sagt 12.
      style={{ border: `0.5px solid ${modell.rahmen}`, borderRadius: 12 }}
    >
      {/* Urteil links, Fakten rechts — auf schmalen Breiten stapeln sie. */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`uppercase tracking-wider ${LEISE}`}>{modell.eyebrow}</span>
          <span className="flex items-baseline gap-2 flex-wrap">
            {modell.punkt !== null && (
              <span
                className="shrink-0 w-[9px] h-[9px] rounded-full self-center"
                style={{ background: modell.punkt }}
                aria-hidden="true"
              />
            )}
            <span
              className="text-[19px] tracking-[-0.01em] font-medium"
              style={{ color: modell.urteilFarbe }}
            >
              {modell.urteil}
            </span>
            <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{modell.zusatz}</span>
          </span>
        </div>
        <div className="flex items-start shrink-0">
          {modell.fakten.map(f => <FaktKachel key={f.id} fakt={f} />)}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--tf-border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {b !== null ? (
            <div className="flex items-start gap-3 min-w-0">
              <span className="shrink-0 font-mono text-[10.5px] text-[var(--tf-text-tertiary)] pt-[3px]">
                {b.nummer}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[14px] font-medium text-[var(--tf-danger-text)]">{b.label}</span>
                <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
                  Soll {formatDatum(b.sollDatum)}
                  {b.offenTage !== null && (
                    <> · <span className="text-[var(--tf-danger-text)]">{b.offenTage} T offen</span></>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-[var(--tf-text-secondary)] min-w-0">{befund.satz}</p>
          )}
          <div className="shrink-0">{aktionen}</div>
        </div>

        {befund.blockiert.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
              {blockiertSatz(befund.blockiert.length + befund.weitere)}
            </span>
            {befund.blockiert.map(s => (
              <span
                key={s.knotenId}
                className="inline-flex items-center gap-1.5 rounded-md px-[9px] py-[3px] text-[12px] text-[var(--tf-text-secondary)] max-w-[280px]"
                style={{ border: '0.5px solid var(--tf-border)' }}
                title={`${s.nummer} ${s.label}`}
              >
                <span className="shrink-0 font-mono text-[10px] text-[var(--tf-text-tertiary)]">{s.nummer}</span>
                <span className="truncate">{s.label}</span>
              </span>
            ))}
            {befund.weitere > 0 && (
              <span className={LEISE} title={`Über ${BLOCKIERT_MAX} hinaus nicht aufgezählt`}>
                und {befund.weitere} weitere
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
