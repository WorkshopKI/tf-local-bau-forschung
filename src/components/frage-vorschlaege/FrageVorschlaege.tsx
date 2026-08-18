/**
 * Die Vorschlagsliste unter dem Suchfeld im Frage-Modus — drei Abschnitte in
 * EINER Liste ([abschnitte.ts](./abschnitte.ts)).
 *
 * Eine Liste und nicht drei nebeneinander: zwei übereinanderliegende Listen
 * hätten zwei Auswahlmarken und eine Pfeiltaste, die mal die eine und mal die
 * andere bewegt (dieselbe Entscheidung wie in
 * [SearchSuggestions](src/plugins/suche/SearchSuggestions.tsx)). Die Abschnitte
 * sind deshalb Überschriften, keine eigenen Listen — die laufende Nummer läuft
 * über alle hinweg.
 *
 * Rein präsentational; offen/zu, Marke und Tastatur liegen in
 * [useFrageVorschlaege.ts](./useFrageVorschlaege.ts).
 *
 * **Jedes anklickbare Element hält den Fokus im Feld** (`mousedown` →
 * `preventDefault`). Ohne das schlösse der Blur-Handler die Liste, bevor der
 * Klick ankommt — und beim ✕ verlöre das Feld zusätzlich den Schreibcursor,
 * obwohl der Nutzer nur eine Zeile weggeräumt hat.
 *
 * Stil nach DESIGN_GUIDE (Panel-Konvention): `--tf-*`-Tokens, 0.5px-Rahmen,
 * z-[100].
 */
import { Clock, Lightbulb, SquarePen, X } from 'lucide-react';
import type { FrageVorschlag, FrageVorschlagArt } from './abschnitte';
import type { FrageVorschlaegeSteuerung } from './useFrageVorschlaege';

const ICON: Record<FrageVorschlagArt, typeof Clock> = {
  verlauf: Clock,
  beispiel: Lightbulb,
  vorlage: SquarePen,
};

interface ZeileProps {
  vorschlag: FrageVorschlag;
  markiert: boolean;
  onWaehlen: () => void;
  onZeigen: () => void;
  onEntfernen: (() => void) | null;
}

function Zeile({ vorschlag, markiert, onWaehlen, onZeigen, onEntfernen }: ZeileProps): React.ReactElement {
  const Icon = ICON[vorschlag.art];
  return (
    <div
      role="option"
      aria-selected={markiert}
      onMouseEnter={onZeigen}
      onMouseDown={e => e.preventDefault()}
      onClick={onWaehlen}
      className={`group flex items-start gap-2 px-3 py-1.5 text-[12px] cursor-pointer ${
        markiert ? 'bg-[var(--tf-hover)]' : ''
      }`}
    >
      <Icon size={13} className="mt-[2px] shrink-0 text-[var(--tf-text-tertiary)]" />
      <span className="min-w-0 flex-1">
        <span className="text-[var(--tf-text)]">{vorschlag.text}</span>
        {vorschlag.erklaerung !== undefined && (
          // Unter dem Text und nicht daneben: die Fragen sind lang, und in einer
          // Zeile hätte die Erklärung den Platz genommen, den die Frage braucht.
          <span className="block text-[11px] text-[var(--tf-text-tertiary)]">
            {vorschlag.erklaerung}
          </span>
        )}
      </span>
      {onEntfernen && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); onEntfernen(); }}
          aria-label={`„${vorschlag.text}" aus dem Verlauf entfernen`}
          className="mt-[1px] shrink-0 p-0.5 bg-transparent border-0 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function FrageVorschlaege({ steuerung }: { steuerung: FrageVorschlaegeSteuerung }): React.ReactElement | null {
  const { offen, abschnitte, aktiv, setAktiv, waehle, entferne, leere } = steuerung;
  if (!offen) return null;

  // Die laufende Nummer über alle Abschnitte — dieselbe Zählung wie in
  // `flacheListe`, damit ↑↓ und die Marke dasselbe meinen.
  let lfd = -1;
  const hatVerlauf = abschnitte.some(a => a.eintraege.some(e => e.art === 'verlauf'));

  return (
    <div
      role="listbox"
      aria-label="Vorschläge für die Frage"
      // 480 px: der volle Vorrat misst 474 px (neun Zeilen, drei Überschriften,
      // in dev:local gemessen) — bei 420 blieben die letzten Vorlagen unter der
      // Kante, also genau der Abschnitt, den niemand sucht, der ihn noch nie
      // gesehen hat. Ein Deckel bleibt es trotzdem: was darüber hinausgeht,
      // scrollt.
      className="absolute left-0 right-0 top-full mt-1 z-[100] max-h-[480px] overflow-y-auto overscroll-contain py-1 rounded-[var(--tf-radius)] bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)' }}
    >
      {abschnitte.map(abschnitt => (
        <div key={abschnitt.titel}>
          <div className="px-3 pt-1.5 pb-0.5 text-[10.5px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">
            {abschnitt.titel}
          </div>
          {abschnitt.eintraege.map(v => {
            lfd += 1;
            const i = lfd;
            return (
              <Zeile
                key={v.key}
                vorschlag={v}
                markiert={i === aktiv}
                onWaehlen={() => waehle(v)}
                onZeigen={() => setAktiv(i)}
                onEntfernen={v.art === 'verlauf' ? () => entferne(v.text) : null}
              />
            );
          })}
        </div>
      ))}
      {hatVerlauf && (
        <div
          className="mt-1 flex items-center gap-3 px-3 pt-1"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={leere}
            className="ml-auto text-[11px] bg-transparent border-0 p-0 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
          >
            Verlauf leeren
          </button>
        </div>
      )}
    </div>
  );
}
