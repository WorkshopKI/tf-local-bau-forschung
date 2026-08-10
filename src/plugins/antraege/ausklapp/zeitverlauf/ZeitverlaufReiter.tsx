/**
 * Der Reiter **Zeitverlauf** — Ebenen-Pillen, Bahn, Meilenstein-Ebene und die
 * Gliederung darunter.
 *
 * **Eine Achse, mehrere Schichten.** Die Meilenstein-Ebene bekommt die x-Skala
 * vom Band gereicht ({@link ZeitAchse}) und rechnet nichts nach — derselbe Tag
 * sitzt in der Bahn und in der Ebene an derselben Stelle, sonst zeigte das Bild
 * Gleichzeitigkeit, wo keine ist.
 *
 * **Nie eine leere Fläche.** Wer alle Bahn-Ebenen abschaltet, bekommt einen
 * Satz statt eines leeren Kastens.
 */
import { useEffect, useMemo, useState } from 'react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import {
  aktuelleSchriftGeneration, messeBreite, warteAufSchriften,
} from '@/components/data-table/messung/textMessung';
import type { VerlaufsSpur } from '@/core/status/verlauf';
import { VerlaufsBand } from '../../verlauf-band/VerlaufsBand';
import { leise } from '../SpurListe';
import { GliederungSektion } from '../gliederung/GliederungSektion';
import { baueGliederung } from '../gliederung/gliederungBaum';
import { trifftPraefix, type MeilensteinLage, type Stufe } from '../meilensteinLage';
import type { BlockerBefund } from '../kopfkarte/blocker';
import { MeilensteinEbene, MeilensteinEbeneFuss } from './MeilensteinEbene';
import { MS_LABEL_ABSTAND, baueMsEbene, verzugsTexte } from './msEbene';
import {
  EBENE_LABEL, EBENE_TITEL, filtereSpuren, initialeEbenen, schalte, verfuegbareEbenen,
  type Ebene,
} from './ebenen';

export interface ZeitverlaufReiterProps {
  spuren: readonly VerlaufsSpur[];
  /** Aktenzeichen der geklickten Zeile — ihre Spur wird benannt. */
  eigenes: string;
  istVerbundZeile: boolean;
  journalAb: string | null;
  journalGenutzt: boolean;
  laden: boolean;
  /** Rechtes Ende der Achse. */
  bezugsZeitpunkt: string;
  /** ISO-Tag, gegen den die Verzugstage zählen. */
  stichtag: string;
  fassung: string | null;
  haengtFest: { art: 'verbund' | 'tv'; id: string } | null;
  lage: MeilensteinLage;
  stufen: readonly Stufe[];
  befund: BlockerBefund;
}

export function ZeitverlaufReiter({
  spuren, eigenes, istVerbundZeile, journalAb, journalGenutzt, laden,
  bezugsZeitpunkt, stichtag, fassung, haengtFest, lage, stufen, befund,
}: ZeitverlaufReiterProps): React.ReactElement {
  const hatMeilensteine = lage.art === 'da' && stufen.length > 0;
  const verfuegbar = useMemo(() => verfuegbareEbenen({
    hatVerbundSpur: spuren.some(s => s.art === 'verbund'),
    istVerbundZeile,
    hatMeilensteine,
  }), [spuren, istVerbundZeile, hatMeilensteine]);

  // Der Ebenen-Zustand gehört DIESEM Pane — die Kopfkarte darüber kennt ihn
  // nicht. Bewusst ohne Persistenz: der aufgeklappte Bereich hält nichts über
  // seine Lebensdauer hinaus (`ausklappZustand.ts`).
  const [an, setAn] = useState<Set<Ebene>>(() => initialeEbenen(verfuegbar));
  const [gehovert, setGehovert] = useState<string | null>(null);

  // Die Webschriften laden asynchron; wer vorher misst, bekommt die Metrik der
  // Ersatzschrift. Genau eine Neumessung, sobald sie stehen — dasselbe Muster
  // wie im Band selbst.
  const [schriftGen, setSchriftGen] = useState(() => aktuelleSchriftGeneration());
  useEffect(() => {
    let lebt = true;
    void warteAufSchriften().then(() => {
      if (lebt) setSchriftGen(aktuelleSchriftGeneration());
    });
    return () => { lebt = false; };
  }, []);

  // Die rechte Reserve MUSS vor der Geometrie feststehen: sie geht in die
  // Bahnbreite ein, die Bahnbreite in die Achse. Deshalb aus den Texten
  // gemessen, die keine Achse brauchen — nicht aus den fertigen Marken.
  const messeLabel = useMemo(() => (t: string) => messeBreite(t, 'bandVerzug'), [schriftGen]);
  const labelReserve = useMemo(() => {
    const texte = verzugsTexte(stufen, stichtag);
    if (texte.length === 0) return 0;
    return Math.ceil(Math.max(...texte.map(messeLabel))) + MS_LABEL_ABSTAND;
  }, [stufen, stichtag, messeLabel]);

  const sichtbareSpuren = useMemo(
    () => filtereSpuren(spuren, an, verfuegbar),
    [spuren, an, verfuegbar],
  );
  const gliederung = useMemo(
    () => baueGliederung(lage, stufen, stichtag),
    [lage, stufen, stichtag],
  );
  const msAn = an.has('meilensteine') && hatMeilensteine;

  if (laden) return <p className={leise}>Lädt …</p>;
  if (spuren.length === 0) {
    return <p className={leise}>Kein Statuskatalog geladen — ohne ihn gibt es keine Bahn.</p>;
  }

  const trifft = (nummer: string): boolean =>
    gehovert !== null && (trifftPraefix(nummer, gehovert) || trifftPraefix(gehovert, nummer));

  return (
    <div className="flex flex-col gap-2">
      {verfuegbar.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`uppercase tracking-wider ${leise}`}>Ebenen</span>
          {verfuegbar.map(e => (
            <ToggleChip
              key={e}
              label={EBENE_LABEL[e]}
              title={EBENE_TITEL[e]}
              selected={an.has(e)}
              onToggle={() => setAn(a => schalte(a, e))}
            />
          ))}
        </div>
      )}

      {sichtbareSpuren.length === 0 ? (
        // Erreichbar nur dort, wo der Vorgang gar keine Teilvorhaben-Bahn führt
        // und die Verbundbahn abgeschaltet ist. Ein leerer Kasten wäre auch dann
        // die schlechtere Antwort.
        <p className={leise}>
          Verbundbahn ausgeblendet — es gibt hier keine weitere Bahn.
        </p>
      ) : (
        <VerlaufsBand
          spuren={sichtbareSpuren} eigenes={eigenes} bezugsZeitpunkt={bezugsZeitpunkt}
          fassung={fassung} journalAb={journalAb} journalGenutzt={journalGenutzt}
          haengtFest={haengtFest}
          kuerzelEbene={an.has('kuerzel')}
          randRechts={msAn && labelReserve > 0 ? labelReserve + 8 : undefined}
          zusatzBahn={msAn ? {
            label: 'Meilensteine',
            // Das Modell entsteht IM Slot: seine Bahnzahl — und damit die Höhe —
            // steht erst fest, wenn die Achse gerechnet ist. Deshalb auch der
            // Fuß hier: er redet über genau dieses Modell.
            render: ({ achse }) => {
              const modell = baueMsEbene({
                stufen, achse, bis: bezugsZeitpunkt, stichtag, messeText: messeLabel,
              });
              return (
                <>
                  <div className="relative" style={{ height: modell.hoehe }}>
                    <MeilensteinEbene
                      modell={modell}
                      hervorgehoben={trifft}
                      onHover={setGehovert}
                    />
                  </div>
                  <MeilensteinEbeneFuss modell={modell} />
                </>
              );
            },
          } : null}
        />
      )}

      {hatMeilensteine && (
        <GliederungSektion
          gliederung={gliederung}
          stufen={befund.stufenOben}
          gerissen={befund.gerissen}
          hervorgehoben={trifft}
          onHover={setGehovert}
        />
      )}
    </div>
  );
}
