/**
 * „Wohin mit den n Statuswerten?" — die Frage, die vor dem Löschen einer Phase
 * beantwortet werden muss.
 *
 * Eine Phase zu entfernen und ihre Codes einfach stehen zu lassen wäre stilles
 * Verwaisen: die Werte zeigten auf etwas, das es nicht mehr gibt, verschwänden
 * aus Leiste und Zieltagen und tauchten erst beim nächsten Zählen wieder auf.
 * Deshalb gibt es keinen Weg zum Löschen, der das Ziel überspringt — auch nicht
 * bei einer leeren Phase, wo die Frage dann bloß entfällt.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MIN_PHASEN, type GeltendeZahPhase } from '@/core/status';
import { zaehlwort } from '@/core/utils/zaehlwort';
import { feldKlasse, feldStil } from './labels';

/** Sentinel für „ohne Phase" — `null` lässt sich nicht als `<option>`-Wert führen. */
const OHNE = '__ohne__';

export function PhaseLoeschenDialog({
  phase, codeAnzahl, phasen, offen, darfSchreiben, onSchliessen, onLoeschen,
}: {
  phase: GeltendeZahPhase | null;
  codeAnzahl: number;
  phasen: readonly GeltendeZahPhase[];
  offen: boolean;
  darfSchreiben: boolean;
  onSchliessen: () => void;
  onLoeschen: (zielId: string | null) => void;
}): React.ReactElement {
  const andere = phasen.filter(p => p.id !== phase?.id);
  const [ziel, setZiel] = useState<string>(() => andere[0]?.id ?? OHNE);
  const zuWenige = phasen.length <= MIN_PHASEN;

  return (
    <Dialog
      open={offen}
      onClose={onSchliessen}
      title={phase ? `Verfahrensschritt „${phase.label}" entfernen` : 'Verfahrensschritt entfernen'}
      size="md"
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="primary" size="sm"
            disabled={!darfSchreiben || zuWenige || phase === null}
            title={darfSchreiben ? undefined : 'Nur mit Schreibrecht auf den Daten-Share'}
            onClick={() => {
              onLoeschen(ziel === OHNE ? null : ziel);
              onSchliessen();
            }}
          >
            Entfernen und umhängen
          </Button>
          <Button variant="secondary" size="sm" onClick={onSchliessen}>Abbrechen</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {zuWenige ? (
          <p className="text-[12.5px] text-[var(--tf-warning-text)]">
            Der Verfahrensschnitt braucht mindestens {MIN_PHASEN} Schritte — es sind
            {' '}{phasen.length}. Erst einen weiteren anlegen, dann entfernen.
          </p>
        ) : (
          <>
            <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
              {codeAnzahl === 0
                ? 'Dieser Schritt ist leer — es hängt kein Statuswert daran.'
                : `An diesem Schritt hängen: ${zaehlwort(codeAnzahl, 'Statuswert', 'Statuswerte')}. `
                  + 'Verschwinden wird davon nichts — die Zuordnung zieht um, und wohin, '
                  + 'entscheiden Sie hier.'}
            </p>
            {codeAnzahl > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">
                  Neuer Verfahrensschritt
                </span>
                <select
                  value={ziel} className={feldKlasse} style={feldStil}
                  onChange={e => setZiel(e.target.value)}
                >
                  {andere.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  <option value={OHNE}>Ohne Phase (läuft neben dem Verfahren)</option>
                </select>
              </label>
            )}
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              Datumsfelder, die an diesem Schritt hängen, ziehen mit um.
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}
