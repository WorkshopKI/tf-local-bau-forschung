/**
 * Reiter „Suchsprache" — was man in das Feld schreiben kann.
 *
 * Die neun Beispiele sind dieselben wie vor v4.72, nur nach Zweck gruppiert
 * ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts)). Die Feldnamen
 * darunter kommen aus der EINEN Quelle (`FELD_PRAEFIX`), damit die Hilfe nicht
 * von der Syntax abdriften kann.
 */
import { Search } from 'lucide-react';
import { FELD_PRAEFIX } from '@/core/services/search/feldpraefix';
import { FussSatz, GruppenTitel, MehrZeile } from './StartBausteine';
import { SUCHARTEN, SUCHSPRACHE_GRUPPEN, suchartenDerGruppe, type Sucheart } from './suchsprache';

const FELDNAMEN = Object.values(FELD_PRAEFIX).join(' · ');

export function StartSuchsprache({ onSuche, max, onMehr }: {
  onSuche: (query: string) => void;
  /** Im Kurzformat des Reiters „Alle" gesetzt. */
  max?: number;
  onMehr?: () => void;
}): React.ReactElement {
  if (max !== undefined) {
    // Kurzformat: EINE Überschrift statt der vier Zweckgruppen — vier Gruppen à
    // ein bis zwei Zeilen wären mehr Überschrift als Inhalt. Ganz ohne stünden
    // die Beispiele im Reiter „Alle" beziehungslos unter den letzten Suchen.
    const sicht = SUCHARTEN.slice(0, max);
    return (
      <div className="flex flex-col">
        <GruppenTitel>So kannst du suchen</GruppenTitel>
        <div className="grid gap-x-10 md:grid-cols-2">
          {sicht.map(s => <MusterZeile key={s.query} s={s} onSuche={onSuche} />)}
        </div>
        {onMehr && SUCHARTEN.length > sicht.length && (
          <MehrZeile text={`alle ${SUCHARTEN.length} ansehen`} onClick={onMehr} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
        {SUCHSPRACHE_GRUPPEN.map(g => (
          <section key={g.id}>
            <GruppenTitel>{g.titel}</GruppenTitel>
            {suchartenDerGruppe(g.id).map(s => (
              <MusterZeile key={s.query} s={s} onSuche={onSuche} />
            ))}
          </section>
        ))}
      </div>
      <FussSatz>
        Vor dem Doppelpunkt steht das Feld: {FELDNAMEN}. Die Spaltennamen der
        Fördertabelle gehen auch (<code>ORG_AST:</code>, <code>VB_TITEL:</code>,
        <code> ORT_AST:</code>). Ohne Feldangabe gilt die Auswahl „Suche in"
        über dem Ergebnis. Merken muss man sich nichts: das Suchfeld schlägt
        Feldnamen und die Werte des Bestands vor, sobald du tippst.
      </FussSatz>
    </div>
  );
}

function MusterZeile({ s, onSuche }: { s: Sucheart; onSuche: (q: string) => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSuche(s.query)}
      title={`„${s.query}" suchen`}
      className="flex min-w-0 items-center gap-2 rounded-[6px] px-2 py-1.5 text-left hover:bg-[var(--tf-hover)] cursor-pointer"
    >
      <Search size={11} className="shrink-0 text-[var(--tf-text-tertiary)]" aria-hidden />
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[12px] text-[var(--tf-text)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {s.query}
      </span>
      <span className="truncate text-[12px] text-[var(--tf-text-secondary)]">{s.erklaerung}</span>
    </button>
  );
}
