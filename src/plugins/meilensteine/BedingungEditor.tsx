/**
 * Struktureller Bedingungs-Editor — verschachtelte UND/ODER-Gruppen, je Blatt
 * Feld · Operator · Wert. **Kein Freitext**: das Feld kommt aus dem Spalten-Vorrat
 * der Programm-Schemas, der Statuswert aus dem kanonischen Wertevorrat. Ein
 * Tippfehler kann so keinen Meilenstein still unerfüllbar machen.
 *
 * Die Komponente ist bewusst domänenfrei gegenüber den Meilensteinen: sie kennt
 * nur `Bedingung`. Damit kann sie später ohne Fork den Regel-Tab des
 * Status-Cockpits übernehmen, der bei Bedingungen bis heute read-only ist.
 */
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Bedingung } from '@/core/status';
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

type Gruppe = { alle: Bedingung[] } | { einige: Bedingung[] };

const istGruppe = (b: Bedingung): b is Gruppe => 'alle' in b || 'einige' in b;
const kinderVon = (g: Gruppe): Bedingung[] => ('alle' in g ? g.alle : g.einige);
const mitKindern = (g: Gruppe, kinder: Bedingung[]): Gruppe =>
  ('alle' in g ? { alle: kinder } : { einige: kinder });

/** Hebt ein Blatt in eine UND-Gruppe, damit der Editor immer eine Gruppe zeigt. */
export function alsGruppe(b: Bedingung): Gruppe {
  return istGruppe(b) ? b : { alle: [b] };
}

const selectKlasse =
  'text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] cursor-pointer';

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

function BlattZeile({ blatt, spalten, pruefeFeld, onChange, onEntfernen }: {
  blatt: Exclude<Bedingung, Gruppe>;
  spalten: SpaltenEintrag[];
  pruefeFeld?: FeldPruefung;
  onChange: (b: Bedingung) => void;
  onEntfernen: () => void;
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

  // Beide Feld-Referenzen prüfen — `datumNachFeld` nennt ein zweites.
  const monita = [
    pruefeFeld?.(blatt.feldId),
    zeigeVergleichsfeld && 'vergleichFeldId' in blatt ? pruefeFeld?.(blatt.vergleichFeldId) : null,
  ].filter((m): m is string => typeof m === 'string' && m.length > 0);

  return (
    <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        value={blatt.feldId}
        onChange={e => setFeld(e.target.value)}
        className={`${selectKlasse} max-w-[240px]`}
        style={feldStil}
        aria-label="Feld"
      >
        {!spalten.some(s => s.feldId === blatt.feldId) && (
          <option value={blatt.feldId}>{blatt.feldId} (nicht gemappt)</option>
        )}
        {spalten.map(s => (
          <option key={s.feldId} value={s.feldId}>
            {s.label === s.feldId ? s.feldId : `${s.label} · ${s.feldId}`}
          </option>
        ))}
      </select>

      <select
        value={blatt.op}
        onChange={e => setOperator(e.target.value)}
        className={selectKlasse}
        style={feldStil}
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
          className={`${selectKlasse} max-w-[220px]`}
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
          className="text-[12px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] w-[160px]"
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
            className="text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] w-[72px] text-right"
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
            className="text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] w-[72px] text-right"
            style={feldStil}
            aria-label="Tage"
          />
          Tage
        </span>
      )}

      {zeigeVergleichsfeld && (
        <select
          value={'vergleichFeldId' in blatt ? blatt.vergleichFeldId : ''}
          onChange={e => onChange({ ...blatt, vergleichFeldId: e.target.value } as Bedingung)}
          className={`${selectKlasse} max-w-[240px]`}
          style={feldStil}
          aria-label="Vergleichsfeld"
        >
          {'vergleichFeldId' in blatt && !spalten.some(s => s.feldId === blatt.vergleichFeldId) && (
            <option value={blatt.vergleichFeldId}>{blatt.vergleichFeldId} (nicht gemappt)</option>
          )}
          {spalten.map(s => (
            <option key={s.feldId} value={s.feldId}>
              {s.label === s.feldId ? s.feldId : `${s.label} · ${s.feldId}`}
            </option>
          ))}
        </select>
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
                className={`text-[11px] leading-none rounded px-1.5 py-1 cursor-pointer ${
                  gewaehlt ? 'text-white' : 'text-[var(--tf-text-tertiary)]'}`}
                style={gewaehlt ? { background: 'var(--tf-primary)' } : feldStil}
              >
                {label}
              </button>
            );
          })}
        </span>
      )}

      <button
        type="button"
        onClick={onEntfernen}
        aria-label="Bedingung entfernen"
        title="Bedingung entfernen"
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
      >
        <X size={13} />
      </button>
    </div>
      {monita.map(m => (
        <p key={m} className="text-[11.5px] text-[var(--tf-danger-text)] pl-0.5">{m}</p>
      ))}
    </div>
  );
}

export function BedingungEditor({ bedingung, spalten, pruefeFeld, onChange, tiefe = 0 }: {
  bedingung: Bedingung;
  spalten: SpaltenEintrag[];
  /** Ohne diese Prop verhält sich der Editor wie vor v2.386 (Meilensteine). */
  pruefeFeld?: FeldPruefung;
  onChange: (b: Bedingung) => void;
  tiefe?: number;
}): React.ReactElement {
  const gruppe = alsGruppe(bedingung);
  const kinder = kinderVon(gruppe);
  const istUnd = 'alle' in gruppe;

  const setzeKind = (i: number, b: Bedingung): void =>
    onChange(mitKindern(gruppe, kinder.map((k, j) => (j === i ? b : k))));
  const entferneKind = (i: number): void =>
    onChange(mitKindern(gruppe, kinder.filter((_, j) => j !== i)));

  const ersteSpalte = spalten[0]?.feldId ?? 'status';

  return (
    <div
      className="flex flex-col gap-1.5 rounded px-2 py-2"
      style={tiefe > 0 ? feldStil : { background: 'var(--tf-bg)' }}
    >
      <div className="flex items-center gap-1.5">
        <select
          value={istUnd ? 'alle' : 'einige'}
          onChange={e => onChange(e.target.value === 'alle' ? { alle: kinder } : { einige: kinder })}
          className={selectKlasse}
          style={feldStil}
          aria-label="Verknüpfung"
        >
          <option value="alle">ALLE müssen zutreffen</option>
          <option value="einige">EINE genügt</option>
        </select>
        {kinder.length === 0 && (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {istUnd
              ? 'Leer = immer erfüllt — bitte Bedingung ergänzen.'
              : 'Leer = nie direkt erfüllt (nur über Unter-Meilensteine).'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pl-3 border-l border-[var(--tf-border)]">
        {kinder.map((kind, i) => (
          <div key={i}>
            {istGruppe(kind) ? (
              <div className="flex items-start gap-1.5">
                <div className="flex-1 min-w-0">
                  <BedingungEditor
                    bedingung={kind} spalten={spalten} tiefe={tiefe + 1}
                    pruefeFeld={pruefeFeld}
                    onChange={b => setzeKind(i, b)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => entferneKind(i)}
                  aria-label="Gruppe entfernen"
                  title="Gruppe entfernen"
                  className="p-1 mt-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <BlattZeile
                blatt={kind} spalten={spalten} pruefeFeld={pruefeFeld}
                onChange={b => setzeKind(i, b)}
                onEntfernen={() => entferneKind(i)}
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost" size="sm" icon={Plus}
            onClick={() => onChange(mitKindern(gruppe, [...kinder, { feldId: ersteSpalte, op: 'gefuellt' }]))}
          >
            Bedingung
          </Button>
          {tiefe < 2 && (
            <Button
              variant="ghost" size="sm" icon={Plus}
              onClick={() => onChange(mitKindern(gruppe, [...kinder, { einige: [] }]))}
            >
              Gruppe
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
