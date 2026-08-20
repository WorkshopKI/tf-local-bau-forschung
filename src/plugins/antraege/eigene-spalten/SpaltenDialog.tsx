/**
 * Anlegen und Bearbeiten einer eigenen Spalte.
 *
 * **Die Vorschau ist Pflicht, nicht Zierde.** Eine Spalte auf einem Feld, das
 * dieses Programm nicht mappt, bliebe in jeder Zeile leer — und das merkt man
 * sonst erst nach dem Neuaufbau der Projektion. Deshalb zeigt der Dialog an
 * echten geladenen Zeilen, was in der Zelle stünde, BEVOR gespeichert wird.
 *
 * Der Regel-Editor ist der vorhandene `BedingungEditor`, nicht ein zweiter.
 *
 * **Angelegt wird immer persönlich.** Das ist keine Einschränkung, sondern der
 * Weg, auf dem eine Spalte in jeder Variante entsteht — auch dort, wo niemand
 * auf den Share schreiben darf. Wer das Recht hat, hebt eine erprobte Spalte
 * danach mit einem Griff ins Team; das ist eine bewusste zweite Handlung und
 * keine Checkbox, die man beim Anlegen übersieht.
 */
import { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Plus, X } from 'lucide-react';
// Derselbe Bedingungs-Editor wie in Meilensteinen und Vorgangs-Regeln — er ist
// ausdrücklich domänenfrei gebaut und kennt nur `Bedingung`. Der Querimport
// folgt dem bestehenden Weg von `status-cockpit/TodoRegelDetail`; ein eigener
// Editor wäre die dritte Fassung derselben Sache.
import { BedingungEditor } from '@/plugins/meilensteine/BedingungEditor';
import type { SpaltenEintrag } from '@/core/services/csv/spalten-inventar';
import {
  berechneZelle, herkunftVon, slugVon, spaltenId, type EigeneSpalte, type SpaltenRegel,
} from '@/core/spalten';
import type { AntragTableRow } from '../tableGrouping';

/** So viele Zeilen zeigt die Vorschau. Genug, um „überall leer" zu erkennen,
 *  wenig genug, um den Dialog nicht zur Tabelle zu machen. */
const VORSCHAU_ZEILEN = 12;

/**
 * Freie persoenliche Spalten-Id zum Label — haengt `-2`, `-3`, … an, statt eine
 * vorhandene Spalte zu ueberschreiben. Wortgleich zu `freieTeamId`
 * (`useEigeneSpalten.ts`): eine Regel, zwei Ebenen.
 */
function freieId(label: string, vergeben: readonly string[]): string {
  const genommen = new Set(vergeben);
  const basis = slugVon(label);
  let kandidat = spaltenId('ich', basis);
  for (let n = 2; genommen.has(kandidat); n++) kandidat = spaltenId('ich', `${basis}-${n}`);
  return kandidat;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Vorhandene Spalte bearbeiten; ohne sie wird eine neue angelegt. */
  bestehend?: EigeneSpalte;
  /** Bereits vergebene Spalten-Ids — eine NEUE Spalte weicht ihnen aus. */
  vergebeneIds?: readonly string[];
  /** Feld-Vorrat aus allen Programm-Schemas. */
  vorrat: readonly SpaltenEintrag[];
  /** Geladene Zeilen für die Vorschau (die Tabelle reicht ihre eigenen durch). */
  zeilen: readonly AntragTableRow[];
  heute: string;
  brauchtNeuaufbau: (spalte: EigeneSpalte) => boolean;
  onSpeichern: (spalte: EigeneSpalte) => Promise<void>;
  /** Nur beim Bearbeiten — ohne diesen Weg wäre eine angelegte Spalte für
   *  immer da (der Picker kann sie ausblenden, nicht entfernen). */
  onLoeschen?: (id: string) => Promise<void>;
  /** Darf dieser Mensch Team-Spalten pflegen? Blendet die Übernahme ein. */
  darfTeam?: boolean;
  /** Hebt die bearbeitete persönliche Spalte ins Team. */
  onInsTeam?: (spalte: EigeneSpalte) => Promise<void>;
}

type Art = 'feld' | 'sammel' | 'regel';

/** Eine frische, noch leere Regel. `gefuellt` ist der harmloseste Operator —
 *  er trifft eine Aussage, ohne einen Wert zu erfinden. */
function neueRegel(feldId: string): SpaltenRegel {
  return { wenn: { feldId, op: 'gefuellt' }, text: '' };
}

/**
 * Die Quell-Codes eines kanonischen Feldes, gekürzt auf das, was in eine Zeile
 * passt. Der volle Satz steht im `title` — abschneiden ohne Rest wäre eine
 * unvollständige Auskunft, die aussieht wie eine vollständige.
 */
function herkunftKurz(codes: readonly string[]): string {
  if (codes.length <= MAX_QUELL_CODES) return codes.join(', ');
  return `${codes.slice(0, MAX_QUELL_CODES).join(', ')} +${codes.length - MAX_QUELL_CODES}`;
}

const MAX_QUELL_CODES = 2;

export function SpaltenDialog({
  open, onClose, bestehend, vergebeneIds = [], vorrat, zeilen, heute, brauchtNeuaufbau, onSpeichern, onLoeschen,
  darfTeam = false, onInsTeam,
}: Props): React.ReactElement {
  const istTeamSpalte = bestehend !== undefined && herkunftVon(bestehend.id) === 'team';
  // Die Art einer bestehenden Spalte wird ÜBERNOMMEN, nicht geraten: ein
  // Rückfall auf 'feld' hätte beim Speichern eine Regel-Spalte stillschweigend
  // in eine Feld-Spalte verwandelt.
  const [art, setArt] = useState<Art>(bestehend?.art ?? 'feld');
  const [label, setLabel] = useState(bestehend?.label ?? '');
  const [feldId, setFeldId] = useState(
    bestehend?.art === 'feld' ? bestehend.feldId : (vorrat[0]?.feldId ?? ''),
  );
  const [felder, setFelder] = useState<string[]>(
    bestehend?.art === 'sammel' ? bestehend.felder : [],
  );
  const [wahl, setWahl] = useState<'juengstes' | 'aeltestes'>(
    bestehend?.art === 'sammel' ? bestehend.wahl : 'juengstes',
  );
  const [regeln, setRegeln] = useState<SpaltenRegel[]>(
    bestehend?.art === 'regel' ? bestehend.regeln : [],
  );
  const [sonst, setSonst] = useState(bestehend?.art === 'regel' ? (bestehend.sonst?.text ?? '') : '');
  const [suche, setSuche] = useState('');

  const nurDatum = art === 'sammel';
  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return vorrat
      .filter(e => (nurDatum ? e.typ === 'datum' : true))
      // Auch nach dem rohen Code suchbar: wer „D_AAE" im Kopf hat, findet damit
      // `antragsdatum` — sonst zeigte die Liste die Herkunft an, ließe sich aber
      // nicht danach durchsuchen.
      .filter(e => q === ''
        || e.feldId.toLowerCase().includes(q)
        || e.label.toLowerCase().includes(q)
        || e.quellCodes.some(c => c.toLowerCase().includes(q)))
      .slice(0, 200);
  }, [vorrat, suche, nurDatum]);

  /** Die Definition, wie sie gespeichert würde — auch Grundlage der Vorschau. */
  const entwurf = useMemo((): EigeneSpalte | null => {
    const beschriftung = label.trim();
    if (beschriftung === '') return null;
    // Die Id bleibt bei einer bestehenden Spalte GLEICH, auch wenn die
    // Beschriftung sich ändert: an ihr hängen gespeicherte Sichtbarkeit und
    // Breite. Ein Nachführen des Slugs würde beides verlieren.
    // Eine NEUE Spalte bekommt eine freie Id: zwei Kolleginnen duerfen
    // „Restlaufzeit“ heissen wollen, und ein gleicher Slug ueberschrieb bis
    // v4.123 die vorhandene Spalte samt ihrer Definition. Dieselbe Regel, die
    // `freieTeamId` fuer die Team-Ebene laengst zieht (v4.124).
    const id = bestehend?.id ?? freieId(beschriftung, vergebeneIds);
    if (art === 'feld') {
      if (feldId === '') return null;
      // Der gespeicherte Typ gewinnt, solange das FELD dasselbe ist: mappt das
      // gerade offene Programm die Spalte nicht, faende `vorrat` sie nicht und
      // eine Datums-Spalte kippte still auf `wert` (v4.124).
      const gespeichert = bestehend?.art === 'feld' && bestehend.feldId === feldId
        ? bestehend.typ
        : undefined;
      const typ = gespeichert ?? vorrat.find(e => e.feldId === feldId)?.typ ?? 'wert';
      return { id, art: 'feld', label: beschriftung, feldId, typ };
    }
    if (art === 'sammel') {
      if (felder.length === 0) return null;
      return { id, art: 'sammel', label: beschriftung, felder, wahl };
    }
    // Eine Regel ohne Text wäre eine leere Zelle mit Aufwand — sie zählt nicht.
    const brauchbar = regeln.filter(r => r.text.trim() !== '');
    if (brauchbar.length === 0) return null;
    return {
      id, art: 'regel', label: beschriftung, regeln: brauchbar,
      ...(sonst.trim() !== '' ? { sonst: { text: sonst.trim() } } : null),
    };
  }, [art, label, feldId, felder, wahl, regeln, sonst, vorrat, bestehend]);

  const vorschau = useMemo(() => {
    if (!entwurf) return [];
    return zeilen.slice(0, VORSCHAU_ZEILEN).map(r => ({
      fkz: r.aktenzeichen,
      wert: berechneZelle(
        entwurf, r.frei_roh ?? {}, r._verbund?.tvs.map(t => t.frei_roh ?? {}), heute,
      ).text,
    }));
  }, [entwurf, zeilen, heute]);

  // Der ehrliche Befund: die Vorschau kann nur zeigen, was schon projiziert IST.
  // Ein noch nie gelesenes Feld steht in keiner Zeile — dann sagt der Dialog das,
  // statt „überall leer" zu behaupten.
  const nochNichtProjiziert = entwurf !== null && brauchtNeuaufbau(entwurf);
  const alleLeer = vorschau.length > 0 && vorschau.every(v => v.wert === '');

  // Der Neuaufbau der Projektion läuft in diesem Aufruf mit und dauert bei
  // ~29.000 Anträgen einige Sekunden — genau der Fall, für den `useAsyncAction`
  // da ist: Doppelklick-Schutz und ein sichtbarer Fehler statt einer
  // verschluckten Rejection (Pitfall #15).
  const speichern = useAsyncAction(async () => {
    if (!entwurf) return;
    await onSpeichern(entwurf);
    onClose();
  });

  const loeschen = useAsyncAction(async () => {
    if (!bestehend || !onLoeschen) return;
    await onLoeschen(bestehend.id);
    onClose();
  });

  // Übernahme heißt: ERST den aktuellen Stand des Formulars festhalten, dann
  // heben. Sonst landete im Team die zuletzt gespeicherte Fassung, während der
  // Mensch die geänderte vor sich sieht.
  const insTeam = useAsyncAction(async () => {
    if (!entwurf || !onInsTeam) return;
    await onInsTeam(entwurf);
    onClose();
  });

  function schalteFeld(id: string): void {
    setFelder(f => (f.includes(id) ? f.filter(x => x !== id) : [...f, id]));
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        bestehend
          ? (istTeamSpalte ? 'Team-Spalte bearbeiten' : 'Spalte bearbeiten')
          : 'Eigene Spalte anlegen'
      }
      footer={
        <div className="flex items-center gap-2">
          {bestehend && onLoeschen && (
            <Button
              variant="ghost"
              onClick={() => loeschen.run()}
              disabled={speichern.busy || loeschen.busy || insTeam.busy}
              className="mr-auto text-[var(--tf-danger-text)]"
            >
              {loeschen.busy
                ? 'Entfernt …'
                : istTeamSpalte ? 'Aus dem Team entfernen' : 'Spalte entfernen'}
            </Button>
          )}
          {/* Nur beim Bearbeiten einer PERSÖNLICHEN Spalte: eine erprobte Spalte
              wandert ins Team. Beim Anlegen bewusst nicht — erst benutzen, dann
              teilen. */}
          {bestehend && !istTeamSpalte && darfTeam && onInsTeam && (
            <Button
              variant="secondary"
              onClick={() => insTeam.run()}
              disabled={!entwurf || speichern.busy || loeschen.busy || insTeam.busy}
              title="Kopiert diese Spalte in die Team-Ablage; die persönliche entfällt."
            >
              {insTeam.busy ? 'Übernimmt …' : 'Ins Team übernehmen'}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={speichern.busy || insTeam.busy}>
            Abbrechen
          </Button>
          <Button
            onClick={() => speichern.run()}
            disabled={!entwurf || speichern.busy || insTeam.busy}
          >
            {speichern.busy ? 'Baut die Tabelle neu …' : 'Speichern'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-[12.5px]">
        {speichern.error && <Alert variant="danger">{speichern.error}</Alert>}
        {insTeam.error && <Alert variant="danger">{insTeam.error}</Alert>}
        {loeschen.error && <Alert variant="danger">{loeschen.error}</Alert>}

        {/* Die Reichweite gehört an den Anfang, nicht ans Ende: sie entscheidet,
            wessen Tabelle sich ändert. */}
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {istTeamSpalte
            ? 'Team-Spalte — was du hier änderst, sehen alle. Sie liegt im Daten-Ordner, nicht auf diesem Gerät.'
            : 'Nur für dich, nur auf diesem Gerät. Niemand sonst sieht diese Spalte.'}
        </div>

        <label className="block">
          <span className="block mb-1 text-[var(--tf-text-secondary)]">Spaltenkopf</span>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="z. B. Letzte Prüfung"
            className="w-full px-2 py-1 rounded bg-transparent text-[var(--tf-text)] outline-none"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
        </label>

        <div>
          <span className="block mb-1 text-[var(--tf-text-secondary)]">Was zeigt die Spalte?</span>
          <div className="flex gap-2">
            <ArtKnopf an={art === 'feld'} onClick={() => setArt('feld')}
              titel="Ein Feld" unter="unverändert anzeigen" />
            <ArtKnopf an={art === 'sammel'} onClick={() => setArt('sammel')}
              titel="Mehrere Datumsfelder" unter="den passenden Termin daraus" />
            <ArtKnopf an={art === 'regel'} onClick={() => setArt('regel')}
              titel="Regeln" unter="Text je nach Zustand" />
          </div>
        </div>

        {art === 'sammel' && (
          <div className="flex gap-2">
            <ArtKnopf an={wahl === 'juengstes'} onClick={() => setWahl('juengstes')}
              titel="Jüngstes Datum" unter="was zuletzt passiert ist" />
            <ArtKnopf an={wahl === 'aeltestes'} onClick={() => setWahl('aeltestes')}
              titel="Ältestes Datum" unter="was zuerst passiert ist" />
          </div>
        )}

        {art === 'regel' && (
          <div>
            <div className="mb-1 text-[var(--tf-text-secondary)]">
              Regeln — die <strong>erste zutreffende</strong> gewinnt. Reihenfolge ist die Aussage:
              was oben steht, schlägt alles darunter.
            </div>
            <div className="space-y-2">
              {regeln.map((r, i) => (
                <div
                  key={i}
                  className="rounded p-2"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)]">
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      value={r.text}
                      onChange={e => setRegeln(rs => rs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                      placeholder="Text in der Zelle, z. B. wartet auf QS"
                      className="min-w-0 flex-1 px-2 py-0.5 rounded bg-transparent text-[var(--tf-text)] outline-none"
                      style={{ border: '0.5px solid var(--tf-border)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setRegeln(rs => rs.filter((_, j) => j !== i))}
                      className="shrink-0 px-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                      title="Regel entfernen"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <BedingungEditor
                    bedingung={r.wenn}
                    spalten={[...vorrat]}
                    onChange={b => setRegeln(rs => rs.map((x, j) => (j === i ? { ...x, wenn: b } : x)))}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRegeln(rs => [...rs, neueRegel(vorrat[0]?.feldId ?? 'status')])}
                className="flex items-center gap-1.5 px-1 py-0.5 rounded text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer"
              >
                <Plus size={12} /> Regel hinzufügen
              </button>
            </div>
            <label className="block mt-2">
              <span className="block mb-1 text-[var(--tf-text-secondary)]">
                Wenn keine Regel zutrifft
              </span>
              <input
                type="text"
                value={sonst}
                onChange={e => setSonst(e.target.value)}
                placeholder="leer lassen = Zelle bleibt leer"
                className="w-full px-2 py-1 rounded bg-transparent text-[var(--tf-text)] outline-none"
                style={{ border: '0.5px solid var(--tf-border)' }}
              />
            </label>
          </div>
        )}

        {art !== 'regel' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[var(--tf-text-secondary)]">
              {art === 'feld' ? 'Feld' : `Felder (${felder.length} gewählt)`}
            </span>
            <input
              type="text"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="Feld suchen"
              className="px-2 py-0.5 rounded bg-transparent text-[11.5px] text-[var(--tf-text)] outline-none"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
          </div>
          <div
            className="max-h-[180px] overflow-y-auto rounded"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {gefiltert.length === 0 && (
              <div className="px-2 py-3 text-[var(--tf-text-tertiary)]">Kein Feld passt.</div>
            )}
            {gefiltert.map(e => (
              <label
                key={e.feldId}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[var(--tf-hover)]"
              >
                <input
                  type={art === 'feld' ? 'radio' : 'checkbox'}
                  checked={art === 'feld' ? feldId === e.feldId : felder.includes(e.feldId)}
                  onChange={() => (art === 'feld' ? setFeldId(e.feldId) : schalteFeld(e.feldId))}
                />
                <code className="shrink-0 font-mono text-[11px] text-[var(--tf-text)]">{e.feldId}</code>
                {/* Woraus das kanonische Feld entsteht. Ein Key wie `antragsdatum`
                    sagt es nicht — und wer eine Spalte wählt, fragt genau danach. */}
                {e.quellCodes.length > 0 && (
                  <span
                    className="shrink-0 font-mono text-[10px] text-[var(--tf-text-tertiary)]"
                    title={`Gebildet aus: ${e.quellCodes.join(', ')}`}
                  >
                    ← {herkunftKurz(e.quellCodes)}
                  </span>
                )}
                <span className="min-w-0 truncate text-[var(--tf-text-secondary)]">{e.label}</span>
                {/* Deckungshinweis: ein Feld, das nur ein Programm mappt, traegt
                    anderswo nichts — das soll man vorher sehen. Gezaehlt werden
                    PROGRAMME, nicht CSV-Quellen: ein Programm kann mehrere fuehren,
                    und `schemaAnzahl` las sich als Deckung, ohne eine zu sein (v4.124). */}
                <span
                  className="ml-auto shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)]"
                  title={`In ${e.programmAnzahl ?? e.schemaAnzahl} Programm(en) gemappt, ueber ${e.schemaAnzahl} CSV-Quelle(n)`}
                >
                  {e.programmAnzahl ?? e.schemaAnzahl}×
                </span>
              </label>
            ))}
          </div>
        </div>
        )}

        <div>
          <span className="block mb-1 text-[var(--tf-text-secondary)]">Vorschau</span>
          {/* Ein Feld, das DIESES Programm nicht mappt, traegt hier nichts — und
              in der Liste oben ist dann nichts angekreuzt. Ohne diesen Satz sah
              die Spalte einfach leer aus (v4.124). */}
          {art === 'feld' && feldId !== '' && !vorrat.some(e => e.feldId === feldId) && (
            <div className="mb-2 text-[var(--tf-warning-text)]">
              Das Feld <code className="font-mono">{feldId}</code> ist in diesem Programm nicht
              gemappt — die Spalte bleibt hier leer. In einem anderen Programm kann sie tragen.
            </div>
          )}
          {!entwurf && (
            <div className="text-[var(--tf-text-tertiary)]">
              Beschriftung und Feld wählen — dann steht hier, was in der Spalte stünde.
            </div>
          )}
          {entwurf && nochNichtProjiziert && (
            <Alert variant="info">
              Dieses Feld wird bisher von keiner Spalte gelesen. Beim Speichern wird die
              Tabelle einmalig neu aufgebaut; erst danach stehen Werte darin.
            </Alert>
          )}
          {entwurf && !nochNichtProjiziert && (
            <>
              {alleLeer && (
                <Alert variant="warning">
                  In allen {vorschau.length} geprüften Zeilen bliebe die Spalte leer.
                  Trägt dieses Programm das Feld überhaupt?
                </Alert>
              )}
              <div
                className="mt-1 max-h-[150px] overflow-y-auto rounded"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                {vorschau.map(v => (
                  <div key={v.fkz} className="flex gap-3 px-2 py-0.5 text-[11.5px]">
                    <code className="shrink-0 font-mono text-[var(--tf-text-tertiary)]">{v.fkz}</code>
                    <span className="min-w-0 truncate text-[var(--tf-text)]">
                      {v.wert === '' ? '—' : v.wert}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function ArtKnopf(
  { an, onClick, titel, unter }: { an: boolean; onClick: () => void; titel: string; unter: string },
): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 px-2 py-1.5 rounded text-left cursor-pointer hover:bg-[var(--tf-hover)]"
      style={{
        border: an ? '1px solid var(--tf-primary)' : '0.5px solid var(--tf-border)',
        color: an ? 'var(--tf-text)' : 'var(--tf-text-secondary)',
      }}
    >
      <span className="block text-[12px]">{titel}</span>
      <span className="block text-[10.5px] text-[var(--tf-text-tertiary)]">{unter}</span>
    </button>
  );
}
