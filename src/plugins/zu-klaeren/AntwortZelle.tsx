/**
 * Die Antwort am rechten Zeilenende: drei Knöpfe, bei „andere" ein Zielfeld.
 *
 * Die Zelle hat eine **feste Breite**; das Zielfeld erscheint innerhalb dieser
 * Breite, statt die Tabelle beim Klicken umzubauen. Ein dauerhaft sichtbares
 * zweites Auswahlfeld an 30 Zeilen wäre Lärm; ein Feld, das die Spalten
 * verschiebt, wäre schlimmer (Pitfall #14).
 *
 * **Ein Streifen statt drei Knöpfe**: die drei Optionen schließen einander aus, also
 * sitzen sie auf gemeinsamer Kante — das spart die Zwischenräume und liest sich als
 * eine Frage mit drei Antworten. Gebaut bleibt es aus dem Haus-`ToggleChip`
 * (Häkchen-Slot immer gerendert → konstante Breite, Pitfall #14); verdichtet wird
 * nur über `className`, nie am geteilten Bauteil — das hat 16 weitere Nutzer.
 *
 * Erneut denselben Knopf drücken = Urteil zurückziehen. Das ist die einzige Geste,
 * die dafür nötig ist, und sie ist dieselbe wie überall im Haus (`aria-pressed`).
 */
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { zahPhasenVon } from '@/core/status';
import { URTEIL_WAHL, URTEIL_LABEL, URTEIL_TITEL, rahmenStil } from './labels';
import { OHNE_PHASE, type Urteil, type UrteilStand, type ZielWert } from './typen';
import type { EintragEingabe } from './fold';

interface Props {
  punktId: string;
  meinUrteil?: UrteilStand;
  /** Gesperrt: kein Name im Profil oder kein Schreibrecht. */
  gesperrt: boolean;
  sperrGrund: string;
  aeussern: (eingabe: Omit<EintragEingabe, 'autor'>) => Promise<void>;
}

export function AntwortZelle({
  punktId, meinUrteil, gesperrt, sperrGrund, aeussern,
}: Props): React.ReactElement {
  const aktiv = meinUrteil?.urteil === 'zurueckgezogen' ? undefined : meinUrteil?.urteil;

  const setzen = useAsyncAction(async (urteil: Urteil, zielWert?: ZielWert) => {
    await aeussern({ punktId, urteil, ...(zielWert !== undefined ? { zielWert } : {}) });
  });

  const waehle = (u: Urteil): void => {
    // Nochmals derselbe Knopf = zurückziehen. Die Zeile in der Datei bleibt.
    if (aktiv === u) { void setzen.run('zurueckgezogen'); return; }
    // „andere" ohne gewählte Zielphase sagt bewusst noch NICHTS: würde hier
    // eine Phase vorbelegt, stünde in der Auswertung eine Aussage, die niemand
    // getroffen hat (die Zeile trüge sofort einen Abweichungs-Marker).
    void setzen.run(u, u === 'andere' ? meinUrteil?.zielWert : undefined);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center">
        {URTEIL_WAHL.map((u, i) => (
          <ToggleChip
            key={u}
            label={URTEIL_LABEL[u]}
            selected={aktiv === u}
            disabled={gesperrt || setzen.busy}
            title={gesperrt
              ? sperrGrund
              : `${URTEIL_TITEL[u] ?? URTEIL_LABEL[u]} — nochmals klicken zieht zurück`}
            onToggle={() => waehle(u)}
            className={[
              // `leading-4` statt der geerbten 18px: die Schrift bleibt bei 12px
              // (Lesbarkeit bei Bildschirmfreigabe), nur der Durchschuss geht zurück.
              'px-2 py-0.5 leading-4 rounded-none',
              // Gemeinsame Kante: die 0,5-px-Ränder liegen aufeinander statt doppelt.
              i === 0 ? 'rounded-l-full' : '-ml-[0.5px]',
              i === URTEIL_WAHL.length - 1 ? 'rounded-r-full' : '',
            ].join(' ')}
          />
        ))}
      </div>

      {aktiv === 'andere' && (
        <select
          aria-label="Zielphase"
          className="text-[12px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={rahmenStil}
          disabled={gesperrt || setzen.busy}
          value={meinUrteil?.zielWert ?? ''}
          onChange={e => {
            if (e.target.value === '') return;
            void setzen.run('andere', e.target.value as ZielWert);
          }}
        >
          <option value="">wohin? …</option>
          {zahPhasenVon().map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          <option value={OHNE_PHASE}>ohne Phase</option>
        </select>
      )}

      {setzen.error != null && (
        <span className="text-[11px] text-[var(--tf-danger-text)] text-right">
          ⚠ {setzen.error}
        </span>
      )}
    </div>
  );
}
