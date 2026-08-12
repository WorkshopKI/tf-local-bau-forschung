/**
 * Hauptmenü des Rechtsklicks auf die freie Fläche — „Startseite anpassen".
 *
 * „Alles einklappen" heißt „Alles aufklappen", sobald schon alles zu ist: ein
 * Zustand, in den ein Menüpunkt führt, braucht denselben Punkt als Rückweg.
 * „Startseite zurücksetzen" fragt nicht nach, sondern legt den Vorstand in die
 * Rückgängig-Leiste (rueckgaengigStore) — eine Nachfrage weniger, ein Weg zurück mehr.
 */
import { ChevronsDownUp, ChevronsUpDown, Columns3, RotateCcw, Settings, SunMoon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { MenueTrenner, MenueZeile } from './menueZeilen';
import { useRueckgaengigStore } from './rueckgaengigStore';
import { useStartseiteMenueStore, type UntermenueId } from './useStartseiteMenue';

export function FlaechenMenue({ oeffneUnter }: {
  oeffneUnter: (id: UntermenueId, el: HTMLElement) => void;
}): React.ReactElement {
  const api = useHomeWidgets();
  const navigate = useNavigate();
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const untermenue = useStartseiteMenueStore(s => s.untermenue);
  const merke = useRueckgaengigStore(s => s.merke);

  const sichtbare = [...api.haupt, ...api.seite];
  const allesZu = sichtbare.length > 0 && sichtbare.every(w => w.eingeklappt);

  return (
    <>
      <div className="px-2.5 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
        Startseite anpassen
      </div>
      <MenueZeile
        label="Widgets"
        icon={Columns3}
        untermenue
        aktiv={untermenue === 'widgets'}
        onHover={el => oeffneUnter('widgets', el)}
      />
      <MenueZeile
        label="Darstellung"
        icon={SunMoon}
        untermenue
        aktiv={untermenue === 'darstellung'}
        onHover={el => oeffneUnter('darstellung', el)}
      />
      <MenueTrenner />
      <MenueZeile
        label={allesZu ? 'Alles aufklappen' : 'Alles einklappen'}
        icon={allesZu ? ChevronsUpDown : ChevronsDownUp}
        deaktiviert={sichtbare.length === 0}
        onClick={() => { void api.alleEinklappen(!allesZu); schliesse(); }}
      />
      <MenueZeile
        label="Startseite zurücksetzen"
        icon={RotateCcw}
        onClick={() => {
          merke('Startseite auf Standard zurückgesetzt', api.config);
          void api.zuruecksetzen();
          schliesse();
        }}
      />
      <MenueTrenner />
      <MenueZeile
        label="Alle Einstellungen öffnen"
        icon={Settings}
        onClick={() => { schliesse(); navigate('/einstellungen?sektion=sec-widgets'); }}
      />
    </>
  );
}
