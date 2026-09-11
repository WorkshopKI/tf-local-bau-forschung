/**
 * Ein Blatt des Bedingungs-Baums: Feld · Operator · Wert.
 *
 * Herausgelöst aus [BedingungEditor.tsx](./BedingungEditor.tsx), als dieser die
 * Pfad-Operationen und das Ziehen dazubekam — Operator-Tabellen, Wert-Eingaben
 * und Monita sind eine eigene Verantwortung und haben mit dem Umbau des Baums
 * nichts zu tun.
 *
 * **Kein Freitext für das Feld**: es kommt aus dem Spalten-Vorrat (jetzt über
 * den geteilten `FeldWaehler`), der Statuswert aus dem kanonischen Wertevorrat.
 * Ein Tippfehler kann so keinen Meilenstein still unerfüllbar machen.
 */
import { FeldWaehler, type FeldWaehlerVorschlag } from '@/components/ui/FeldWaehler';
import type { Bedingung, BedingungsGruppe } from '@/core/status';
import { VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import { STATUS_FELDER, bekannteStatusWerte, type SpaltenEintrag } from '@/core/meilensteine';
import { OPERATOR_LABEL, feldStil } from './labels';

/**
 * Operatoren je Feld-Typ. Datumsspalten bekommen die Zeit-Operatoren.
 *
 * `tageSeit` und `datumNachFeld` kommen aus dem Vorgangssystem (To-do-Regeln),
 * stehen aber jedem Bedingungs-Baum offen — der Editor ist domänenfrei.
 * `foerdervarianteIn` steht nur an `vb_phase`, weil es nirgends sonst etwas
 * bedeutet.
 */
const OPERATOREN_WERT = ['ist', 'istNicht', 'gefuellt', 'leer'] as const;
const OPERATOREN_DATUM = ['gefuellt', 'leer', 'datumVor', 'datumNach', 'tageSeit', 'datumNachFeld'] as const;
const OPERATOREN_VARIANTE = ['foerdervarianteIn', 'ist', 'istNicht', 'gefuellt', 'leer'] as const;

/** Das Feld, an dem die Fördervariante steht (`VB_PHASE`, kanonisch gemappt). */
const VARIANTEN_FELD = 'vb_phase';

/** Auswahl der Fördervarianten — Beschriftungen aus der EINEN Decode-Tabelle. */
const VARIANTEN_WAHL: readonly [number, string][] = Object.entries(VB_PHASE_LABELS)
  .map(([nr, label]) => [Number(nr), label] as [number, string])
  .sort((a, b) => a[0] - b[0]);

/**
 * Dicht gesetzt (v4.4): eine Regel mit vier Bedingungen soll ohne Scrollen
 * neben einer zweiten lesbar sein. Die Zeilenhöhe kommt aus der Schriftgröße,
 * nicht aus Polsterung — deshalb `py-0.5` statt `py-1`.
 */
const selectKlasse =
  'text-[12px] rounded px-1.5 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text)] cursor-pointer';

/**
 * Der Vergleich als leises Auswahlfeld (v6.60): „ist gefüllt" steht in fast
 * jeder Bedingung — gerahmt übertönte er das Feld, um das es geht.
 */
const vergleichKlasse =
  'max-w-full text-[11.5px] rounded px-0.5 py-0 bg-transparent text-[var(--tf-text-secondary)] cursor-pointer hover:bg-[var(--tf-hover)]';

/**
 * Optionale Zusatzprüfung des Aufrufers: kennt die Zielwelt das Feld?
 *
 * Die Spaltenliste eines Editors und der Vorrat, gegen den später ausgewertet
 * wird, sind nicht zwingend dieselbe Menge — die To-do-Kaskade z.B. liest den
 * Status-Katalog, der Editor bot bis v2.386 die CSV-Schema-Spalten an. Ohne
 * Prüfung baut man dort eine Regel, die nie zutrifft und nichts sagt.
 * `null` = in Ordnung, ein String = die Meldung, die am Blatt erscheint.
 */
export type FeldPruefung = (feldId: string) => string | null;

export type Blatt = Exclude<Bedingung, BedingungsGruppe>;

/**
 * Eine Bedingung als **Zelle** einer Karte (v6.60): oben das Feld, darunter
 * Vergleich, Wert und — bei den Meilensteinen — was sie am Bestand trifft.
 * Griff und ⋯ erscheinen an der Zelle unter der Maus oder im Fokus; ein
 * Dutzend Bündel nebeneinander war das Rauschen, das die PL „nicht übersichtlich"
 * fand. Per Tab bleiben sie erreichbar (`focus-within`).
 */
export function BlattZeile({
  blatt, spalten, pruefeFeld, vorschlaege, kennzahlFeld, treffer, onChange, aktionen,
}: {
  blatt: Blatt;
  spalten: SpaltenEintrag[];
  pruefeFeld?: FeldPruefung;
  vorschlaege?: readonly FeldWaehlerVorschlag[];
  /** Kennzahl je Feld in der Feld-Suche (Meilensteine: Treffer am Bestand). */
  kennzahlFeld?: (feldId: string) => string | undefined;
  /** Was diese Bedingung am Bestand trifft — rechts in der zweiten Zeile. */
  treffer?: React.ReactNode;
  onChange: (b: Bedingung) => void;
  /** Griff und ⋯ — vom Editor gestellt. */
  aktionen: React.ReactNode;
}): React.ReactElement {
  const eintrag = spalten.find(s => s.feldId === blatt.feldId);
  const operatorenFuer = (feldId: string, typ?: string): readonly string[] => {
    if (feldId === VARIANTEN_FELD) return OPERATOREN_VARIANTE;
    return typ === 'datum' ? OPERATOREN_DATUM : OPERATOREN_WERT;
  };
  const passende = operatorenFuer(blatt.feldId, eintrag?.typ);
  // Ein Operator, den die Liste nicht führt (fremde Fassung, von Hand
  // editierter Plan), wird MITGEZEIGT statt verschluckt: sonst stünde das
  // Auswahlfeld leer und der erste Klick überschriebe eine Bedingung, die der
  // Nutzer nie gesehen hat.
  const operatoren = passende.includes(blatt.op) ? passende : [blatt.op, ...passende];
  const zeigeStatusAuswahl =
    (blatt.op === 'ist' || blatt.op === 'istNicht') && STATUS_FELDER.includes(blatt.feldId);
  const zeigeFreiWert = (blatt.op === 'ist' || blatt.op === 'istNicht') && !zeigeStatusAuswahl;
  const zeigeTage = blatt.op === 'datumVor' || blatt.op === 'datumNach';
  const zeigeTageSeit = blatt.op === 'tageSeit';
  const zeigeVergleichsfeld = blatt.op === 'datumNachFeld';
  const zeigeVarianten = blatt.op === 'foerdervarianteIn';

  const setFeld = (feldId: string): void => {
    const neu = spalten.find(s => s.feldId === feldId);
    // Operator mitziehen, wenn er zum neuen Feld-Typ nicht mehr passt.
    if (operatorenFuer(feldId, neu?.typ).includes(blatt.op)) {
      onChange({ ...blatt, feldId });
    } else {
      onChange({ feldId, op: 'gefuellt' });
    }
  };

  const setOperator = (op: string): void => {
    if (op === 'gefuellt' || op === 'leer') onChange({ feldId: blatt.feldId, op });
    else if (op === 'datumVor' || op === 'datumNach') {
      onChange({ feldId: blatt.feldId, op, tageRelativHeute: 0 });
    } else if (op === 'ist' || op === 'istNicht') {
      onChange({ feldId: blatt.feldId, op, wert: '' });
    } else if (op === 'tageSeit') {
      onChange({ feldId: blatt.feldId, op, tage: 31 });
    } else if (op === 'datumNachFeld') {
      const anderes = spalten.find(s => s.feldId !== blatt.feldId)?.feldId ?? blatt.feldId;
      onChange({ feldId: blatt.feldId, op, vergleichFeldId: anderes });
    } else if (op === 'foerdervarianteIn') {
      onChange({ feldId: blatt.feldId, op, varianten: [] });
    }
  };

  // Ein `ist`/`istNicht` ohne Wert behauptet nichts — und `istNicht` ohne Wert
  // wäre für JEDEN Vorgang wahr. Die Speicherung verwirft ein solches Blatt
  // (`normalisiereBedingung`); der Editor muss das sagen, solange es dasteht.
  const wertFehlt = (blatt.op === 'ist' || blatt.op === 'istNicht')
    && !('wert' in blatt && (blatt.wert ?? '').trim() !== '');

  // Beide Feld-Referenzen prüfen — `datumNachFeld` nennt ein zweites.
  const monita = [
    pruefeFeld?.(blatt.feldId),
    zeigeVergleichsfeld && 'vergleichFeldId' in blatt ? pruefeFeld?.(blatt.vergleichFeldId) : null,
    wertFehlt ? 'Ohne Wert zählt diese Bedingung nicht — sie wird beim Laden verworfen.' : null,
  ].filter((m): m is string => typeof m === 'string' && m.length > 0);

  return (
    <div className="group/zelle flex flex-col gap-0.5 rounded-[6px] px-2 py-1.5 hover:bg-[var(--tf-hover)] focus-within:bg-[var(--tf-hover)]">
      <div className="flex min-w-0 items-center gap-1">
        <FeldWaehler
          variante="leise"
          spalten={spalten}
          wert={blatt.feldId}
          onWaehle={setFeld}
          vorschlaege={vorschlaege}
          kennzahl={kennzahlFeld}
          kennzahlTitel="offen · abg."
          ariaLabel="Feld"
          className="min-w-0 flex-1"
        />
        <span className="shrink-0 opacity-0 group-hover/zelle:opacity-100 focus-within:opacity-100">{aktionen}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <select
          value={blatt.op}
          onChange={e => setOperator(e.target.value)}
          className={vergleichKlasse}
          aria-label="Operator"
        >
          {operatoren.map(op => (
            <option key={op} value={op}>{OPERATOR_LABEL[op] ?? `${op} (unbekannt)`}</option>
          ))}
        </select>

        {zeigeStatusAuswahl && (
          <select
            value={'wert' in blatt ? blatt.wert ?? '' : ''}
            onChange={e => onChange({ ...blatt, wert: e.target.value } as Bedingung)}
            className={`${selectKlasse} max-w-[200px]`}
            style={feldStil}
            aria-label="Statuswert"
          >
            <option value="">— Wert wählen —</option>
            {bekannteStatusWerte().map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        )}

        {zeigeFreiWert && (
          <input
            value={'wert' in blatt ? blatt.wert ?? '' : ''}
            onChange={e => onChange({ ...blatt, wert: e.target.value } as Bedingung)}
            placeholder="Wert"
            className="text-[12px] rounded px-2 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text)] w-[140px]"
            style={feldStil}
            aria-label="Wert"
          />
        )}

        {zeigeTage && (
          <span className="flex items-center gap-1 text-[12px] text-[var(--tf-text-secondary)]">
            heute
            <input
              type="number"
              value={'tageRelativHeute' in blatt ? blatt.tageRelativHeute : 0}
              onChange={e => onChange({ ...blatt, tageRelativHeute: Number(e.target.value) || 0 } as Bedingung)}
              className="text-[12px] rounded px-1.5 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text)] w-[72px] text-right"
              style={feldStil}
              aria-label="Tage relativ zu heute"
            />
            Tage
          </span>
        )}

        {zeigeTageSeit && (
          <span className="flex items-center gap-1 text-[12px] text-[var(--tf-text-secondary)]">
            <input
              type="number" min={0}
              value={'tage' in blatt ? blatt.tage : 0}
              onChange={e => onChange({ ...blatt, tage: Number(e.target.value) || 0 } as Bedingung)}
              className="text-[12px] rounded px-1.5 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text)] w-[72px] text-right"
              style={feldStil}
              aria-label="Tage"
            />
            Tage
          </span>
        )}

        {zeigeVergleichsfeld && (
          <FeldWaehler
            variante="leise"
            spalten={spalten}
            wert={'vergleichFeldId' in blatt ? blatt.vergleichFeldId : ''}
            onWaehle={feldId => onChange({ ...blatt, vergleichFeldId: feldId } as Bedingung)}
            kennzahl={kennzahlFeld}
            kennzahlTitel="offen · abg."
            ariaLabel="Vergleichsfeld"
            className="min-w-0 max-w-[200px]"
          />
        )}

        {zeigeVarianten && (
          <span className="flex items-center gap-1">
            {VARIANTEN_WAHL.map(([nr, label]) => {
              const gewaehlt = 'varianten' in blatt && blatt.varianten.includes(nr);
              return (
                <button
                  key={nr} type="button" aria-pressed={gewaehlt} title={`Fördervariante ${nr}`}
                  onClick={() => {
                    const bisher = 'varianten' in blatt ? blatt.varianten : [];
                    const next = gewaehlt ? bisher.filter(v => v !== nr) : [...bisher, nr].sort((a, b) => a - b);
                    onChange({ ...blatt, varianten: next } as Bedingung);
                  }}
                  className={`text-[11px] leading-none rounded px-1.5 py-0.5 cursor-pointer ${
                    gewaehlt ? 'text-white' : 'text-[var(--tf-text-tertiary)]'}`}
                  style={gewaehlt ? { background: 'var(--tf-primary)' } : feldStil}
                >
                  {label}
                </button>
              );
            })}
          </span>
        )}

        {treffer && <span className="ml-auto pl-1">{treffer}</span>}
      </div>
      {monita.map(m => (
        <p key={m} className="text-[11.5px] text-[var(--tf-danger-text)] pl-0.5">{m}</p>
      ))}
    </div>
  );
}
