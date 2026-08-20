/**
 * Untermenü „Widgets": die Checkliste beider Spalten, Reihenfolge-Pfeile beim
 * Überfahren, je Spalte ein „alle"-Schalter.
 *
 * Ganz oben die Gruppe **„Oben"** mit den zwei festen Karten des Hero-Bandes
 * (v4.41). Sie sind keine Widgets — keine Position, kein Einklappen, deshalb
 * keine Pfeile —, aber die Liste beantwortet die Frage „was steht auf meiner
 * Startseite", und ohne sie hätte eine über ihr `⋯` ausgeblendete Karte keinen
 * Rückweg außer „Startseite zurücksetzen".
 *
 * **Das Menü bleibt nach einem Klick offen** (Handoff §2.1) — es ist kein
 * Einzel-Schalter, sondern mehrere nebeneinander; nach jedem Häkchen zu schließen
 * zwänge zum Wiederöffnen. Dieselbe Begründung wie beim `DarstellungDropdown`.
 *
 * Ein einzelnes Häkchen bekommt bewusst KEINE Rückgängig-Leiste: der Weg zurück
 * ist derselbe Klick, eine Zeile weiter oben. Der „alle"-Schalter dagegen räumt
 * eine ganze Spalte und ist damit die Aktion, die man bereuen kann.
 */
import { AlertTriangle, Clock, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { widgetAnzeigbar } from '../widgets/homeWidgetsStore';
import { WIDGET_KATALOG } from '../widgets/widgetCatalog';
import type { HeroKarte, WidgetInstanz } from '../widgets/types';
import { MenueHakenZeile, MenueLabel, MenueTrenner, MenueZeile } from './menueZeilen';
import { stelleSichtbarkeitHer, useRueckgaengigStore } from './rueckgaengigStore';
import { useStartseiteMenueStore } from './useStartseiteMenue';

const GRUPPEN: { bereich: WidgetInstanz['bereich']; label: string }[] = [
  { bereich: 'haupt', label: 'Hauptspalte' },
  { bereich: 'seite', label: 'Seitenspalte' },
];

/** Die zwei festen Karten über den Spalten — Beschriftung wie in ihrem Kopf. */
const HERO_KARTEN: { karte: HeroKarte; label: string; icon: typeof Clock }[] = [
  { karte: 'resume', label: 'Weiter, wo du aufgehört hast', icon: Clock },
  { karte: 'alert', label: 'Braucht heute Aufmerksamkeit', icon: AlertTriangle },
];

export function WidgetsUntermenue(): React.ReactElement {
  const api = useHomeWidgets();
  const navigate = useNavigate();
  const angezeigt = useSichtbar();
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const merke = useRueckgaengigStore(s => s.merke);

  // Nur Typen, die diese Variante überhaupt zeigt — sonst stünden hier Häkchen
  // ohne Wirkung (`sichtbarWenn` bzw. die Beta/Experte-Marken blenden sie auf
  // der Startseite wieder aus).
  const anzeigbar = api.alleInstanzen.filter(w => widgetAnzeigbar(w.typ, undefined, angezeigt));

  return (
    <>
      <div>
        <MenueLabel>Oben</MenueLabel>
        {HERO_KARTEN.map(k => (
          <MenueHakenZeile
            key={k.karte}
            label={k.label}
            icon={k.icon}
            an={api.hero.sichtbar[k.karte]}
            onToggle={() => { void api.setHeroKarte(k.karte, !api.hero.sichtbar[k.karte]); }}
          />
        ))}
      </div>
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
                  // Nur die Häkchen DIESER Spalte zurückdrehen — was seither
                  // sonst passiert ist (Einklappen, andere Spalte), bleibt stehen.
                  merke(
                    alleAn ? `${g.label} ausgeblendet` : `${g.label} eingeblendet`,
                    stelleSichtbarkeitHer(new Map(items.map(w => [w.id, w.sichtbar]))),
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
