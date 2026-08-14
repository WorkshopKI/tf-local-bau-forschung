/**
 * Die geteilte Filterleiste über Chronik und Zeitstrahl: **wer** und **wo**.
 *
 * **Die Leiste ist die Legende.** Die Rollenfarbe, mit der ein aktiver Chip
 * getönt ist, ist dieselbe, die die Marken in den Zeilen tragen — deshalb
 * braucht es darunter keinen zweiten Farbschlüssel. Das gilt nur, solange die
 * Chips im Grundzustand alle an sind; wären sie es nicht, stünde die Legende
 * grau da.
 *
 * **Welche Chips es gibt, entscheidet der Vorgang, nicht der Filter.** Die
 * Anwesenheit eines Chips wird gegen den **ungefilterten** Bestand gerechnet,
 * seine Zahl gegen die aktuelle Bereichswahl. Sonst verschwänden Chips unter der
 * eigenen Auswahl, und die Leiste ruckelte bei jedem Klick.
 *
 * **Neutrale Einträge bekommen keinen Chip** — „jeder darf setzen" ist keine
 * Rolle, sondern deren Abwesenheit. Sie verschwinden aber auch nicht: bei
 * aktiver Rollenwahl bleiben sie abgeblendet stehen, und genau das sagt die
 * Zeile unter den Chips. Ohne sie wäre das Abblenden ein Rätsel.
 */
import {
  BEREICH_VERBUND, ROLLEN, ROLLE_LABEL, ROLLE_LANG,
  bereichZaehler, neutralZaehler, rollenFarbe, rollenZaehler,
  type ChronikEintrag, type MatrixSpalte, type Rolle,
} from '@/core/status';
import { ToggleChip } from '@/components/ui/ToggleChip';
import type { VerlaufFilter } from './useVerlaufFilter';

const LEISE = 'text-[var(--tf-text-tertiary)]';
const RUBRIK = `text-[10.5px] uppercase tracking-wider ${LEISE} shrink-0`;

/**
 * Die Endung des Aktenzeichens am Träger-Chip („TV 1 …049").
 *
 * Die laufende Nummer ordnet, aber sie lässt sich nicht zitieren: im Fachsystem
 * heißt das Teilvorhaben `16KN122049`. Die letzten drei Stellen unterscheiden
 * die Teilvorhaben eines Verbunds zuverlässig — sie laufen fortlaufend.
 */
function endung(spalte: { id: string; lang: string }): string | undefined {
  if (spalte.id === BEREICH_VERBUND) return undefined;
  return spalte.lang.length > 3 ? `…${spalte.lang.slice(-3)}` : spalte.lang;
}

export function VerlaufFilterLeiste({ chronik, spalten, filter, nichtGesetzt, nebensaechlich }: {
  /** Die **ungefilterte** Chronik — Grundlage für Anwesenheit und Zahlen. */
  chronik: readonly ChronikEintrag[];
  spalten: readonly MatrixSpalte[];
  filter: VerlaufFilter;
  /** Wie viele Kürzel irgendwo fehlen; 0 = der Schalter entfällt. */
  nichtGesetzt: number;
  /**
   * Der Schalter „Nebensächliches" — er gehört hierher und nicht in die Liste
   * darunter, weil er beide Ordnungen betrifft. `null` = es gibt nichts
   * Nebensächliches, dann entfällt er (ein Schalter, der nie etwas tut, ist
   * eine Zusage, die nie eingelöst wird).
   */
  nebensaechlich: { an: boolean; anzahl: number; umschalten: () => void } | null;
}): React.ReactElement {
  const LEER = new Set<string>();
  // Anwesenheit gegen den ganzen Bestand, Zahlen gegen die Bereichswahl.
  const vorhanden = rollenZaehler(chronik, LEER);
  const zahlen = rollenZaehler(chronik, filter.bereiche);
  const proBereich = bereichZaehler(chronik, filter.rollen);
  const neutral = neutralZaehler(chronik, filter.bereiche);
  const rollenEng = filter.rollen.size > 0 && filter.rollen.size < ROLLEN.length;

  const rollen: Rolle[] = ROLLEN.filter(r => vorhanden[r] > 0);
  const alleBereicheAn = filter.bereiche.size === 0 || filter.bereiche.size >= spalten.length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {rollen.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={RUBRIK}>Wer</span>
            {rollen.map(r => {
              const farbe = rollenFarbe(r);
              return (
                <ToggleChip
                  key={r}
                  form="marke"
                  label={ROLLE_LABEL[r]}
                  zahl={zahlen[r]}
                  tonung={{ text: farbe.text, flaeche: farbe.flaeche }}
                  selected={!rollenEng || filter.rollen.has(r)}
                  onToggle={() => filter.schalteRolle(r)}
                  title={ROLLE_LANG[r]}
                />
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={RUBRIK}>Wo</span>
          <ToggleChip
            form="marke"
            label="Alle"
            variant="dark"
            selected={alleBereicheAn}
            onToggle={filter.alleBereiche}
            title="Verbund und alle Teilvorhaben"
          />
          {spalten.map(s => {
            const kurz = endung(s);
            return (
              <ToggleChip
                key={s.id}
                form="marke"
                label={s.kurz}
                {...(kurz === undefined ? {} : { zusatz: kurz })}
                zahl={proBereich.get(s.id) ?? 0}
                selected={!alleBereicheAn && filter.bereiche.has(s.id)}
                onToggle={() => filter.schalteBereich(s.id)}
                title={s.id === BEREICH_VERBUND ? s.lang : `${s.kurz} — ${s.lang}`}
              />
            );
          })}
        </div>

        {nebensaechlich !== null && (
          <ToggleChip
            form="marke"
            label="Nebensächliches"
            zahl={nebensaechlich.anzahl}
            selected={nebensaechlich.an}
            onToggle={nebensaechlich.umschalten}
            title="Briefe, Bestätigungen und andere reine Nachrichtenkanäle"
          />
        )}

        {nichtGesetzt > 0 && (
          <ToggleChip
            form="marke"
            label={`${nichtGesetzt} Kürzel nicht gesetzt`}
            selected={filter.nurLuecken}
            onToggle={() => filter.setzeNurLuecken(!filter.nurLuecken)}
            tonung={{ text: 'var(--tf-danger-text)', flaeche: 'var(--tf-danger-bg)' }}
            title="Nur die Schritte zeigen, bei denen irgendwo ein Kürzel fehlt"
          />
        )}

        {filter.aktiv && (
          <button
            type="button"
            onClick={filter.zuruecksetzen}
            className="ml-auto shrink-0 cursor-pointer text-[11.5px] text-[var(--tf-text-secondary)] underline-offset-2 hover:underline"
          >
            Auswahl zurücksetzen
          </button>
        )}
      </div>

      {/* Warum ein Teil der Liste blass ist — sonst liest sich das Abblenden als
          Fehler. Steht nur da, solange es etwas zu erklären gibt.

          „Datumsangaben", nicht „Einträge": der Zähler misst Zellen, genau wie
          die Kennzahlen darüber. Am gemessenen Bestand liegen die beiden Zahlen
          weit auseinander (67 Angaben auf 19 Schritten) — ein unscharfes Wort
          hätte hier die falsche Größenordnung nahegelegt. */}
      {rollenEng && neutral > 0 && (
        <span className={`text-[11px] ${LEISE}`}>
          {neutral} {neutral === 1 ? 'Datumsangabe' : 'Datumsangaben'} ohne feste
          Zuständigkeit — das Fachsystem lässt sie von jedem setzen; sie bleiben
          abgeblendet stehen.
        </span>
      )}
    </div>
  );
}
