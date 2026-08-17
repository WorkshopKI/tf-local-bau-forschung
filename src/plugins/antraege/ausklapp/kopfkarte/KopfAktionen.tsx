/**
 * Die Aktionen der Kopfkarte — **nur echte Züge**.
 *
 * Der Entwurf zeigt „QS anstoßen", „Zuständigkeit ändern" und „Verzug
 * begründen". Keine dieser Aktionen existiert in der App; sie sind laut Handoff
 * selbst Annahmen. Drei Knöpfe, die nichts tun, wären schlimmer als keine —
 * hier stehen deshalb die drei Züge, die es wirklich gibt:
 *
 * 1. **Risiko melden** — schreibt in den persönlichen Ordner, die PL sammelt
 *    ein. Der Blocker ist vorausgewählt.
 * 2. **Auf der Detailseite öffnen** — springt zu `#meilensteine`.
 * 3. **Verlauf kopieren** — der Klartext mit Codes für die Rückfrage ans C16.
 *
 * Das Risiko-Formular klappt **inline** auf statt in einem Dialog: die Karte
 * steht ohnehin in einem aufgeklappten Bereich, und ein Modal darüber nähme
 * genau den Kontext weg, wegen dem jemand meldet.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';
import { sortiereKnoten } from '@/core/meilensteine';
import type { VerlaufsSpur } from '@/core/status/verlauf';
import { baueVerlaufsText } from '../../verlauf-band/bandText';
import { antragDetailPfad } from '../../detailPfad';
import { RisikoFormular } from '../../meilensteine/RisikoFormular';
import type { MeilensteinLage } from '../meilensteinLage';

export interface KopfAktionenProps {
  zeilenKey: string;
  verbundId: string | null;
  lage: MeilensteinLage;
  /** Vorauswahl des Risiko-Formulars — der Blocker. */
  blockerKnotenId?: string;
  melden: (knotenId: string, text: string, tage?: number) => Promise<void>;
  /** Konnte die letzte Meldung in den persönlichen Ordner geschrieben werden? */
  nurLokal: boolean;
  spuren: readonly VerlaufsSpur[];
  fassung: string | null;
  journalAb: string | null;
  bezugsZeitpunkt: string;
  /**
   * Ist der Zeitverlauf überhaupt gebaut?
   *
   * Ohne das Vorgangssystem sind die Spuren zwar gerechnet, aber die Oberfläche
   * zeigt sie nirgends — ein Knopf, der etwas kopiert, das man nicht sehen
   * kann, ist keine Aktion, sondern eine Falle.
   */
  zeitverlaufAn: boolean;
}

export function KopfAktionen({
  zeilenKey, verbundId, lage, blockerKnotenId, melden, nurLokal,
  spuren, fassung, journalAb, bezugsZeitpunkt, zeitverlaufAn,
}: KopfAktionenProps): React.ReactElement {
  const navigate = useNavigate();
  const [formularOffen, setFormularOffen] = useState(false);
  const kopieren = useKopierAktion(
    () => baueVerlaufsText(spuren, {
      bezug: zeilenKey || spuren.find(s => s.art === 'verbund')?.id || '—',
      fassung, journalAb, bezugsZeitpunkt,
    }),
    'Verlauf mit Statuscodes in die Zwischenablage',
  );

  const auswahl = lage.art === 'da'
    ? sortiereKnoten(lage.knoten).filter(k => k.aktiv)
      .map(k => ({ id: k.id, nummer: k.nummer, label: k.label }))
    : [];

  // Die Detailseite scrollt über `?ziel=` auf ihren Anker; welche der beiden
  // Detail-Routen gilt, entscheidet `antragDetailPfad`.
  const detailZiel = antragDetailPfad({ verbundId, aktenzeichen: zeilenKey, ziel: 'meilensteine' });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {auswahl.length > 0 && (
          <Button
            variant={formularOffen ? 'secondary' : 'primary'}
            size="sm"
            aria-expanded={formularOffen}
            onClick={() => setFormularOffen(o => !o)}
          >
            {formularOffen ? 'Meldung schließen' : 'Risiko melden'}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => navigate(detailZiel)}>
          Auf der Detailseite öffnen
        </Button>
        {zeitverlaufAn && spuren.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            disabled={kopieren.busy}
            title={kopieren.titel}
            onClick={kopieren.run}
          >
            {kopieren.kopiert ? 'Kopiert' : 'Verlauf kopieren'}
          </Button>
        )}
      </div>
      {kopieren.fehler !== null && (
        <p className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {kopieren.fehler}</p>
      )}
      {formularOffen && auswahl.length > 0 && (
        <div className="w-full flex flex-col gap-1 pt-1">
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Die Meldung geht in Ihren persönlichen Ordner; die Projektleitung sammelt sie von dort ein.
          </p>
          <RisikoFormular
            knotenAuswahl={auswahl}
            {...(blockerKnotenId !== undefined ? { vorauswahlId: blockerKnotenId } : {})}
            onMelden={melden}
            onFertig={() => setFormularOffen(false)}
          />
          {nurLokal && (
            <p className="text-[11.5px] text-[var(--tf-warning-text)]">
              Kein persönlicher Ordner verbunden — die Meldung liegt nur auf diesem Gerät und
              erreicht die Projektleitung nicht.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
