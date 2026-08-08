/**
 * **Was unter der Bahn steht** — Legende, Herkunft, Mitnehmen.
 *
 * Eigene Datei, weil es eine eigene Frage beantwortet: die Bahn zeichnet den
 * Verlauf, der Fuß sagt, wie er zu lesen ist und woher er kommt. Beides in
 * einer Datei hieße, jeden Textbaustein zwischen Geometrie-Rechnungen zu suchen.
 *
 * **Die Legende steht direkt unter der Bahn** (v3.36). Vorher lag die
 * Herkunftszeile dazwischen, und wer eine Nummer nachschlagen wollte, sprang
 * über einen Satz hinweg, der nichts mit ihr zu tun hat. Sie trägt jetzt die
 * Farbmarke ihres Abschnitts — dieselbe Ableitung wie die Bahn
 * ({@link segmentFarbe}) — und, wo nummeriert wird, die Nummer IN der Marke:
 * genau das Bild, das im Balken steht.
 */
import { Info } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { kopiereText } from '@/core/utils/kopieren';
import type { VerlaufsSpur } from '@/core/status/verlauf';
import { leise } from '../ausklapp/SpurListe';
import { segmentFarbe } from './bandFarbe';
import { baueVerlaufsText } from './bandText';
import { herkunftsTexte, type HerkunftsAngabe } from './herkunftsText';

/** Ein Legendeneintrag — der volle Bezeichner und die Farbe seines Abschnitts. */
export interface LegendenEintrag {
  kurz: string;
  lang: string;
  roh: string;
}

export function BandLegende({ eintraege, nummeriert }: {
  eintraege: readonly LegendenEintrag[];
  /** Trägt mindestens ein Abschnitt eine Nummer? Nur dann zählt die Legende. */
  nummeriert: boolean;
}): React.ReactElement | null {
  if (eintraege.length === 0) return null;
  return (
    // Trennlinie statt eigenem Rahmen (v3.38): das Band trägt seit dieser
    // Fassung einen gemeinsamen Rahmen, und zwei geschachtelte wären ein Kasten
    // zu viel. Die Linie tut dasselbe — sie setzt die Legende vom Bild ab.
    <div
      className="flex items-center gap-x-3 gap-y-1 flex-wrap border-t pt-2"
      style={{ borderColor: 'var(--tf-border)' }}
    >
      <span className={`uppercase tracking-wider ${leise}`}>Legende</span>
      {eintraege.map((l, i) => (
        <span
          key={l.kurz}
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-[var(--tf-text-secondary)]"
        >
          {/* Die Marke IST der Balken im Kleinen: gleiche Farbe, gleiche Nummer.
              Ohne Nummerierung bleibt sie ein Quadrat — eine Nummer ohne
              Gegenstück in der Bahn wäre eine Brücke ins Leere. */}
          <span
            className={`inline-flex items-center justify-center rounded-[2px] text-white text-[9px] leading-none shrink-0${
              nummeriert ? ' px-[3px]' : ''}`}
            // `minWidth`, nicht `width`: ab der zehnten Marke ist die Nummer
            // zweistellig und liefe sonst aus ihrem Kasten.
            style={{ minWidth: nummeriert ? 13 : 9, height: nummeriert ? 13 : 9, background: segmentFarbe(l.roh) }}
          >
            {nummeriert ? i + 1 : ''}
          </span>
          {l.lang}
        </span>
      ))}
    </div>
  );
}

/**
 * Die Herkunftszeile: **ein** Satz sichtbar, die Begründung hinter dem
 * Info-Zeichen. Der Wortlaut kommt aus {@link herkunftsTexte} (rein, getestet) —
 * hier steht nur, wie er aussieht.
 */
export function BandFuss({ spuren, eigenes, angabe }: {
  spuren: readonly VerlaufsSpur[];
  eigenes: string;
  angabe: HerkunftsAngabe;
}): React.ReactElement {
  const texte = herkunftsTexte(angabe);
  const kopieren = useAsyncAction(async () => {
    await kopiereText(baueVerlaufsText(spuren, {
      bezug: eigenes || spuren.find(s => s.art === 'verbund')?.id || '—',
      fassung: angabe.fassung,
      journalAb: angabe.journalAb,
      bezugsZeitpunkt: angabe.bezugsZeitpunkt,
    }));
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={leise}>{texte.kurz}</span>
      <Tooltip
        maxWidth={420}
        content={(
          <span className="flex flex-col gap-1.5">
            {texte.lang.map(p => <span key={p}>{p}</span>)}
          </span>
        )}
      >
        <button
          type="button"
          // Ein Knopf, kein `<span>`: nur so erreicht die Tastatur den Text —
          // der Tooltip zeigt auf `focus`, und ein `<span>` bekommt keinen.
          className="flex text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-help"
          aria-label="Woher der Verlauf kommt"
        >
          <Info size={13} aria-hidden />
        </button>
      </Tooltip>
      <button
        type="button"
        onClick={kopieren.run}
        disabled={kopieren.busy}
        className={`${leise} underline underline-offset-2 cursor-pointer`}
      >
        {kopieren.busy ? 'kopiert …' : 'Verlauf kopieren'}
      </button>
      {kopieren.error != null && (
        <span className="text-[11px] text-[var(--tf-danger-text)]">{String(kopieren.error)}</span>
      )}
    </div>
  );
}
