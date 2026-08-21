/**
 * Reiter „Suchsprache" — was man in das Feld schreiben kann.
 *
 * Zwei Teile mit zwei Aufgaben. Oben die Beispiele, seit v4.72 nach Zweck
 * gruppiert ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts)): sie
 * machen vor, WIE man fragt. Unten seit v4.135 der Block „Alle Felder"
 * ([feldliste.ts](src/plugins/suche/start/feldliste.ts)): er sagt, WORIN man
 * fragen kann — vollständig, mit Bedeutung und Spaltencode, und jede Zeile
 * ausführbar. Vorher stand dort eine nackte Aufzählung im Fußsatz.
 *
 * Die Zeilenzahl steht an EINER Stelle (`SUCHSPRACHE_ZEILEN`) und wird hier
 * nicht nachgerechnet — sie ist zugleich die Zahl am Reiter.
 */
import { Search } from 'lucide-react';
import { FussSatz, GruppenTitel, MehrZeile } from './StartBausteine';
import { FELD_ZEILEN, type FeldZeile } from './feldliste';
import {
  SUCHARTEN, SUCHSPRACHE_GRUPPEN, SUCHSPRACHE_ZEILEN, suchartenDerGruppe, type Sucheart,
} from './suchsprache';

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
        {onMehr && SUCHSPRACHE_ZEILEN > sicht.length && (
          <MehrZeile text={`alle ${SUCHSPRACHE_ZEILEN} ansehen`} onClick={onMehr} />
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
      <section className="mt-5">
        <GruppenTitel>Alle Felder — vor dem Doppelpunkt</GruppenTitel>
        <div className="grid gap-x-10 md:grid-cols-2">
          {FELD_ZEILEN.map(f => <FeldZeileAnsicht key={f.feld} f={f} onSuche={onSuche} />)}
        </div>
      </section>
      <FussSatz>
        Rechts steht der Spaltenname der Fördertabelle — er tut dasselbe
        (<code>ORG_AST:Fraunhofer</code> findet, was auch <code>ast:Fraunhofer</code>
        {' '}findet). Ohne Feldangabe gilt die Auswahl „Suche in" über dem
        Ergebnis. Merken muss man sich nichts: das Suchfeld schlägt Feldnamen und
        die Werte des Bestands vor, sobald du tippst.
      </FussSatz>
    </div>
  );
}

/**
 * Eine Zeile des Feld-Blocks: Beispiel, Bedeutung, Spaltencode.
 *
 * Eigene Komponente statt eines dritten Parameters an `MusterZeile` — die Zeile
 * trägt drei Angaben statt zwei, und der Code steht rechts abgesetzt, damit die
 * Spalte beim Überfliegen eine Spalte bleibt.
 */
function FeldZeileAnsicht({ f, onSuche }: { f: FeldZeile; onSuche: (q: string) => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSuche(f.beispiel)}
      title={`„${f.beispiel}" suchen`}
      className="flex min-w-0 items-center gap-2 rounded-[6px] px-2 py-1.5 text-left hover:bg-[var(--tf-hover)] cursor-pointer"
    >
      <Search size={11} className="shrink-0 text-[var(--tf-text-tertiary)]" aria-hidden />
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[12px] text-[var(--tf-text)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {f.beispiel}
      </span>
      <span className="truncate text-[12px] text-[var(--tf-text-secondary)]">{f.label}</span>
      {f.spalte !== undefined && (
        <span className="ml-auto shrink-0 pl-2 text-[11px] text-[var(--tf-text-tertiary)]">
          {f.spalte}
        </span>
      )}
    </button>
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
