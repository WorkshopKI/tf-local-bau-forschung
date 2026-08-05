/**
 * Die **Sammel-Übernahme der Zieltage** — mit Vorschau, weil sie viele Zeilen
 * auf einmal ändert.
 *
 * Der Wächter braucht je Status eine Zielvorgabe; ohne sie lautet sein Urteil
 * `unbewertet`. Gepflegt waren 7 von 74 Werten, weil jeder einzeln zu setzen
 * war. Was die App vorschlagen kann, ist der **Median der Ist-Liegezeiten** —
 * eine Näherung aus dem Bestand, kein Sollwert. Genau deshalb steht vor der
 * Übernahme eine Tabelle: Status, Median, Stichprobe, alter und neuer Wert.
 *
 * Zwei Ehrlichkeiten sind fest eingebaut:
 * - Werte mit zu kleiner Stichprobe werden **nicht gesetzt**, sondern gelistet.
 *   Ein Median aus zwei Beobachtungen ist eine Zufallszahl.
 * - Ein bereits gepflegter Wert steht mit alt → neu da, damit die Übernahme
 *   nichts stillschweigend überschreibt.
 */
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { zahPhaseLabel, MIN_STICHPROBE, type ZahPhase, type ZieltageAuswahl } from '@/core/status';
import { zaehlwort } from '@/core/utils/zaehlwort';

export function ZieltageUebernahmeDialog({
  auswahl, offen, darfSchreiben, phasen, onSchliessen, onUebernehmen,
}: {
  auswahl: ZieltageAuswahl;
  offen: boolean;
  darfSchreiben: boolean;
  /** Die Phasen des ENTWURFS — eine dort umbenannte Phase soll hier so heißen. */
  phasen: readonly ZahPhase[] | undefined;
  onSchliessen: () => void;
  onUebernehmen: () => void;
}): React.ReactElement {
  const { uebernehmen, zuWenigDaten } = auswahl;

  return (
    <Dialog
      open={offen}
      onClose={onSchliessen}
      title="Zieltage aus dem Ist übernehmen"
      size="xl"
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="primary" size="sm"
            disabled={!darfSchreiben || uebernehmen.length === 0}
            title={darfSchreiben ? undefined : 'Nur mit Schreibrecht auf den Daten-Share'}
            onClick={() => { onUebernehmen(); onSchliessen(); }}
          >
            {zaehlwort(uebernehmen.length, 'Wert', 'Werte')} übernehmen
          </Button>
          <Button variant="ghost" size="sm" onClick={onSchliessen}>Abbrechen</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Vorgeschlagen wird der <strong>Median der Ist-Liegezeiten</strong> je Status — eine
          Näherung aus dem Bestand, kein Sollwert. Übernommen werden nur die Phasen
          Eingang bis Entscheidung: bei „Begleitung" und „Abgeschlossen" ist „liegt zu lange"
          keine sinnvolle Frage. Jeder Wert bleibt danach einzeln korrigierbar.
        </p>

        {uebernehmen.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text)]">
            Nichts zu übernehmen — alle Statuswerte mit ausreichender Stichprobe tragen bereits
            den vorgeschlagenen Wert.
          </p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto rounded" style={{ background: 'var(--tf-bg)' }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0" style={{ background: 'var(--tf-bg)' }}>
                <tr className="text-[11px] text-[var(--tf-text-tertiary)] text-left">
                  <th className="px-2 py-1 font-normal">Code</th>
                  <th className="px-2 py-1 font-normal">Status</th>
                  <th className="px-2 py-1 font-normal">Ebene</th>
                  <th className="px-2 py-1 font-normal">ZAH-Phase</th>
                  <th className="px-2 py-1 font-normal text-right">Stichprobe</th>
                  <th className="px-2 py-1 font-normal text-right">bisher</th>
                  <th className="px-2 py-1 font-normal text-right">neu</th>
                </tr>
              </thead>
              <tbody>
                {uebernehmen.map(u => (
                  <tr key={u.id} className="text-[12px] text-[var(--tf-text-secondary)]">
                    <td className="px-2 py-1 font-mono text-[var(--tf-text-tertiary)]">{u.code}</td>
                    <td className="px-2 py-1 text-[var(--tf-text)]">{u.wert}</td>
                    <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">
                      {u.feldId === 'verbund_status' ? 'Verbund' : u.feldId === 'status' ? 'Teilvorhaben' : u.feldId}
                    </td>
                    <td className="px-2 py-1">{zahPhaseLabel(u.phase, phasen)}</td>
                    <td className="px-2 py-1 text-right font-mono">n = {u.n}</td>
                    <td className="px-2 py-1 text-right font-mono">{u.alt ?? '—'}</td>
                    <td className="px-2 py-1 text-right font-mono text-[var(--tf-text)]">{u.neu} T</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {zuWenigDaten.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              <strong>Nicht gesetzt — zu wenig Daten</strong> (unter {MIN_STICHPROBE} Beobachtungen).
              Diese Statuswerte bleiben „nicht bewertbar", bis die PL einen Wert setzt oder mehr
              Vorgänge durchgelaufen sind:
            </p>
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              {zuWenigDaten.map(z => `${z.code} ${z.wert} (n = ${z.n})`).join(' · ')}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
