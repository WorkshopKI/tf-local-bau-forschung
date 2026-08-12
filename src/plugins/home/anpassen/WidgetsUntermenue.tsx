/**
 * Untermenü „Widgets": die Checkliste beider Spalten, Reihenfolge-Pfeile beim
 * Überfahren, je Spalte ein „alle"-Schalter.
 *
 * **Das Menü bleibt nach einem Klick offen** (Handoff §2.1) — es ist kein
 * Einzel-Schalter, sondern mehrere nebeneinander; nach jedem Häkchen zu schließen
 * zwänge zum Wiederöffnen. Dieselbe Begründung wie beim `DarstellungDropdown`.
 *
 * Ein einzelnes Häkchen bekommt bewusst KEINE Rückgängig-Leiste: der Weg zurück
 * ist derselbe Klick, eine Zeile weiter oben. Der „alle"-Schalter dagegen räumt
 * eine ganze Spalte und ist damit die Aktion, die man bereuen kann.
 */
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { WIDGET_KATALOG } from '../widgets/widgetCatalog';
import type { WidgetInstanz } from '../widgets/types';
import { MenueHakenZeile, MenueLabel, MenueTrenner, MenueZeile } from './menueZeilen';
import { useRueckgaengigStore } from './rueckgaengigStore';
import { useStartseiteMenueStore } from './useStartseiteMenue';

const GRUPPEN: { bereich: WidgetInstanz['bereich']; label: string }[] = [
  { bereich: 'haupt', label: 'Hauptspalte' },
  { bereich: 'seite', label: 'Seitenspalte' },
];

export function WidgetsUntermenue(): React.ReactElement {
  const api = useHomeWidgets();
  const navigate = useNavigate();
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const merke = useRueckgaengigStore(s => s.merke);

  // Nur Typen, die diese Variante überhaupt zeigt — sonst stünden hier Häkchen
  // ohne Wirkung (`sichtbarWenn` blendet sie auf der Startseite wieder aus).
  const anzeigbar = api.alleInstanzen.filter(w => {
    const eintrag = WIDGET_KATALOG[w.typ];
    return !!eintrag && eintrag.verfuegbar && eintrag.sichtbarWenn();
  });

  return (
    <>
      {GRUPPEN.map(g => {
        const items = anzeigbar.filter(w => w.bereich === g.bereich);
        if (items.length === 0) return null;
        const alleAn = items.every(w => w.sichtbar);
        return (
          <div key={g.bereich}>
            <MenueLabel
              aktion={{
                label: 'alle',
                onClick: () => {
                  merke(
                    alleAn ? `${g.label} ausgeblendet` : `${g.label} eingeblendet`,
                    api.config,
                  );
                  void api.setSichtbarBereich(g.bereich, !alleAn);
                },
              }}
            >
              {g.label}
            </MenueLabel>
            {items.map((w, i) => (
              <MenueHakenZeile
                key={w.id}
                label={WIDGET_KATALOG[w.typ].label}
                icon={WIDGET_KATALOG[w.typ].icon}
                an={w.sichtbar}
                onToggle={() => { void api.setSichtbar(w.id, !w.sichtbar); }}
                hoch={{ moeglich: i > 0, onClick: () => { void api.move(w.id, 'hoch'); } }}
                runter={{ moeglich: i < items.length - 1, onClick: () => { void api.move(w.id, 'runter'); } }}
              />
            ))}
          </div>
        );
      })}
      <MenueTrenner />
      <MenueZeile
        label="In den Einstellungen verwalten"
        icon={Settings}
        onClick={() => { schliesse(); navigate('/einstellungen?sektion=sec-widgets'); }}
      />
    </>
  );
}
