/**
 * Der **Veröffentlichungs-Konflikt**: jemand anderes hat den Katalog
 * veröffentlicht, während dieser Entwurf entstand.
 *
 * Drei Dinge muss dieser Dialog leisten, sonst wirkt er bedrohlicher, als die
 * Lage ist:
 * - Er benennt die fremde Fassung mit Nummer, Autor und Zeitpunkt — ein stilles
 *   Blockieren wäre so schlecht wie das stille Überschreiben davor.
 * - Er sagt, dass die eigene Arbeit **bereits lokal festgeschrieben** ist. Offen
 *   ist nur die Veröffentlichung.
 * - Er lässt den Menschen entscheiden. Zusammengeführt wird nur die LISTE der
 *   Fassungen, nie ihr Inhalt: eine feldweise Mischung ergäbe einen Katalog, den
 *   niemand beschlossen hat.
 *
 * Der zerstörerische der beiden Wege („fremde Fassung laden") bekommt einen
 * eigenen Schritt mit der Zahl der betroffenen Einträge — der andere trägt seine
 * Folge im Satz.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { KatalogKonfliktStand } from './useStatusCockpit';
import { feldStil, formatZeitpunkt } from './labels';

function Weg({ titel, folge, children }: {
  titel: string; folge: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded px-3 py-2.5 flex flex-col gap-1.5" style={feldStil}>
      <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{titel}</span>
      <span className="text-[12px] text-[var(--tf-text-secondary)]">{folge}</span>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

export function KatalogKonfliktDialog({ stand, offen, onSchliessen, onTrotzdem, onFremdeLaden }: {
  stand: KatalogKonfliktStand;
  offen: boolean;
  onSchliessen: () => void;
  onTrotzdem: () => Promise<void>;
  onFremdeLaden: () => Promise<void>;
}): React.ReactElement {
  const [schritt, setSchritt] = useState<'wahl' | 'fremde-bestaetigen'>('wahl');
  const trotzdem = useAsyncAction(async () => { await onTrotzdem(); });
  const laden = useAsyncAction(async () => { await onFremdeLaden(); });
  const busy = trotzdem.busy || laden.busy;
  const fehler = trotzdem.error ?? laden.error;

  const { fremde, basis, grund } = stand.konflikt;
  const eigene = stand.eigene;
  const fremdName = `v${fremde.version}`;
  const eigenName = eigene == null ? 'deine Fassung' : `v${eigene}`;

  const schliessen = (): void => { setSchritt('wahl'); onSchliessen(); };

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title="Jemand anderes hat inzwischen veröffentlicht"
      size="lg"
      footer={
        schritt === 'wahl'
          ? <Button variant="ghost" size="sm" disabled={busy} onClick={schliessen}>Später entscheiden</Button>
          : (
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" disabled={busy} onClick={() => laden.run()}>
                {laden.busy ? 'Lädt …' : `${fremdName} laden`}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setSchritt('wahl')}>
                Zurück
              </Button>
            </div>
          )
      }
    >
      <div className="flex flex-col gap-3">
        {grund === 'nummern-kollision' ? (
          <p className="text-[12.5px] text-[var(--tf-text)]">
            Fassung {fremdName} gibt es hier <strong>und</strong> auf dem Share — mit
            verschiedenem Inhalt. {fremde.autor ?? 'Jemand'} hat sie
            am {formatZeitpunkt(fremde.zeitstempel)} veröffentlicht, im selben Moment, in dem
            hier dieselbe Nummer entstand.
          </p>
        ) : (
          <p className="text-[12.5px] text-[var(--tf-text)]">
            Auf dem Share liegt inzwischen Fassung {fremdName}
            {fremde.autor ? ` von ${fremde.autor}` : ''} ({formatZeitpunkt(fremde.zeitstempel)}).
            {basis == null ? '' : ` Deine Änderungen beruhen auf v${basis}.`}
          </p>
        )}

        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          <strong className="text-[var(--tf-text)]">Deine Arbeit ist als {eigenName} lokal
          gespeichert</strong> — offen ist nur die Veröffentlichung. {fremdName} steht seit
          diesem Versuch auch in deiner Fassungsliste und bleibt in beiden Fällen erhalten.
        </p>

        {schritt === 'wahl' ? (
          <div className="flex flex-col gap-2">
            <Weg
              titel={`${fremdName} laden`}
              folge={`${fremdName} gilt danach team-weit. ${eigenName} bleibt in der Fassungsliste und lässt sich dort wieder als Entwurf laden — aktiv ist sie dann nicht.`}
            >
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setSchritt('fremde-bestaetigen')}>
                Fremde Fassung laden …
              </Button>
            </Weg>

            <Weg
              titel="Trotzdem veröffentlichen"
              folge={`${eigenName} gilt danach team-weit. Die Änderungen aus ${fremdName} sind darin NICHT enthalten; ${fremdName} bleibt in der Datei und lässt sich jederzeit wieder laden.`}
            >
              <Button variant="primary" size="sm" disabled={busy} onClick={() => trotzdem.run()}>
                {trotzdem.busy ? 'Veröffentlicht …' : 'Trotzdem veröffentlichen'}
              </Button>
            </Weg>
          </div>
        ) : (
          <div className="rounded px-3 py-2.5 flex flex-col gap-1.5" style={feldStil}>
            <span className="text-[12.5px] text-[var(--tf-text)]">
              {/* „Nicht ermittelbar" statt einer 0: der Abstand steht nur fest,
                  wenn die fremde Fassung wirklich gelesen wurde. Eine 0 hier
                  hieße „identisch" und lüde zum sorglosen Laden ein. */}
              {stand.abweichungen === null ? (
                <>Wie weit {fremdName} von {eigenName} abweicht, ließ sich nicht ermitteln —
                  die fremde Fassung war in der Datei nicht auffindbar.</>
              ) : (
                <>
                  {fremdName} unterscheidet sich in <strong>{stand.abweichungen}</strong>{' '}
                  {stand.abweichungen === 1 ? 'Eintrag' : 'Einträgen'} von {eigenName}.
                </>
              )}
            </span>
            <span className="text-[12px] text-[var(--tf-text-secondary)]">
              Nach dem Laden gilt {fremdName}; dein Entwurf entspricht dann dieser Fassung.
              Was du zuletzt geändert hast, ist damit nicht mehr aktiv — es bleibt
              als {eigenName} in der Fassungsliste erhalten.
            </span>
          </div>
        )}

        {fehler != null && (
          <p className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {fehler}</p>
        )}
      </div>
    </Dialog>
  );
}
