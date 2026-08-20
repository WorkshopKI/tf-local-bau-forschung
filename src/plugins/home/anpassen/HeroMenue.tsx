/**
 * Menü einer der beiden festen Karten über den Spalten — Auslöser ist allein das
 * `⋯` in ihrem Kopf (v4.41).
 *
 * **Nur karten-eigene Punkte**, dieselbe Regel wie beim Widget-Menü (v4.40.2):
 * „Widgets ▸"/„Darstellung ▸" betreffen die ganze Seite und stehen deshalb nur
 * im Menü der freien Fläche. Was hier steht, gilt genau dieser Karte.
 *
 * Die beiden Karten sind KEINE Widgets — sie haben keine Position und kein
 * Einklappen, also fehlen „Nach oben/unten" und „Ein-/Aufklappen". Übrig bleibt,
 * was sie wirklich können:
 *  - **Resume:** ausblenden, und den Verlauf löschen, aus dem sie sich speist.
 *  - **Alert:** ausblenden, Kacheln abwählen, und der Weg zu den Fristen-Schwellen.
 *
 * Die Schwellen wohnen im Antragseingang-Widget (`ampelSchwellenAusConfig` liest
 * genau dort) — der Eintrag öffnet deshalb DESSEN Formular statt ein zweites zu
 * bauen, das denselben Wert noch einmal führte.
 */
import { AlertTriangle, Clock, Eraser, EyeOff, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  ARBEITSVERLAUF_LOESCHEN_FRAGE,
  clearArbeitskontextLog,
} from '@/core/services/personal-storage/arbeitskontext-log';
import { useArbeitskontextSignal } from '../arbeitskontextSignal';
import { labelKritisch, labelWarnung } from '../homeSubtitle';
import { ampelSchwellenAusConfig } from '../widgets/homeWidgetsStore';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { HERO_CONFIG_DEFAULT, type HeroChipId, type HeroKarte } from '../widgets/types';
import { MenueHakenZeile, MenueLabel, MenueTrenner, MenueZeile } from './menueZeilen';
import { useRueckgaengigStore } from './rueckgaengigStore';
import { useStartseiteMenueStore } from './useStartseiteMenue';

const TITEL: Record<HeroKarte, string> = {
  resume: 'Weiter, wo du aufgehört hast',
  alert: 'Braucht heute Aufmerksamkeit',
};

export function HeroMenue({ karte }: { karte: HeroKarte }): React.ReactElement {
  const api = useHomeWidgets();
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const merke = useRueckgaengigStore(s => s.merke);

  const ausblenden = (): void => {
    // Nur DIESE Karte zurückholen, nicht den ganzen Vorstand zurückschreiben —
    // sonst nähme „Rückgängig" mit, was seither an Widgets geschah (v4.131).
    merke(`„${TITEL[karte]}" ausgeblendet`, aktuell => ({
      ...aktuell,
      hero: {
        ...(aktuell.hero ?? HERO_CONFIG_DEFAULT),
        sichtbar: { ...(aktuell.hero ?? HERO_CONFIG_DEFAULT).sichtbar, [karte]: true },
      },
    }));
    void api.setHeroKarte(karte, false);
    schliesse();
  };

  return (
    <>
      <div className="px-2.5 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] truncate">
        {TITEL[karte]}
      </div>
      <MenueZeile label="Ausblenden" icon={EyeOff} onClick={ausblenden} />
      {karte === 'resume' ? <ResumePunkte /> : <AlertPunkte />}
    </>
  );
}

/** Der Verlauf, aus dem sich die Karte speist — löschen leert beides. */
function ResumePunkte(): React.ReactElement {
  const storage = useStorage();
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const bump = useArbeitskontextSignal(s => s.bump);

  return (
    <>
      <MenueTrenner />
      <MenueZeile
        label="Arbeitsverlauf löschen"
        icon={Eraser}
        onClick={() => {
          if (!window.confirm(ARBEITSVERLAUF_LOESCHEN_FRAGE)) return;
          // Erst schließen, dann löschen: der Klick ist entschieden, und die
          // Karte verschwindet unter dem offenen Panel.
          schliesse();
          void clearArbeitskontextLog(storage.idb).then(bump).catch(() => {});
        }}
      />
    </>
  );
}

/** Kacheln abwählen + der Weg zu den Schwellen, die ihre Beschriftung tragen. */
function AlertPunkte(): React.ReactElement {
  const api = useHomeWidgets();
  const offen = useStartseiteMenueStore(s => s.offen);
  const oeffne = useStartseiteMenueStore(s => s.oeffne);
  const schwellen = ampelSchwellenAusConfig(api.config);
  const ampel = api.alleInstanzen.find(w => w.typ === 'antragseingang');

  const kacheln: { id: HeroChipId; label: string; icon: typeof AlertTriangle }[] = [
    { id: 'kritisch', label: labelKritisch(schwellen), icon: AlertTriangle },
    { id: 'warnung', label: labelWarnung(schwellen), icon: Clock },
    { id: 'qs', label: 'eigene Entwürfe offen', icon: ShieldCheck },
  ];

  return (
    <>
      <MenueTrenner />
      <MenueLabel>Kacheln</MenueLabel>
      {kacheln.map(k => (
        <MenueHakenZeile
          key={k.id}
          label={k.label}
          icon={k.icon}
          an={api.hero.chips[k.id]}
          // Wie die Widget-Checkliste: mehrere Schalter nebeneinander halten das
          // Menü offen, der Weg zurück ist derselbe Klick.
          onToggle={() => { void api.setHeroChip(k.id, !api.hero.chips[k.id]); }}
        />
      ))}
      {ampel && offen ? (
        <>
          <MenueTrenner />
          <MenueZeile
            label="Fristen-Schwellen ändern …"
            icon={SlidersHorizontal}
            // Dasselbe Panel, andere Ansicht — der Zurück-Pfeil führt sichtbar
            // zum Antragseingang, weil die Schwellen dort wohnen.
            onClick={() => oeffne(
              { art: 'widget', instanzId: ampel.id },
              offen.punkt,
              { ansicht: 'einstellungen' },
            )}
          />
        </>
      ) : null}
    </>
  );
}
