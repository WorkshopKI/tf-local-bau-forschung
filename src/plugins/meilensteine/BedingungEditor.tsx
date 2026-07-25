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
import { STATUS_FELDER, bekannteStatusWerte, type SpaltenEintrag } from '@/core/meilensteine';
import { OPERATOR_LABEL, feldStil } from './labels';

/** Operatoren je Feld-Typ. Datumsspalten bekommen die Zeit-Operatoren. */
const OPERATOREN_WERT = ['ist', 'istNicht', 'gefuellt', 'leer'] as const;
const OPERATOREN_DATUM = ['gefuellt', 'leer', 'datumVor', 'datumNach'] as const;

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

function BlattZeile({ blatt, spalten, onChange, onEntfernen }: {
  blatt: Exclude<Bedingung, Gruppe>;
  spalten: SpaltenEintrag[];
  onChange: (b: Bedingung) => void;
  onEntfernen: () => void;
}): React.ReactElement {
  const eintrag = spalten.find(s => s.feldId === blatt.feldId);
  const istDatum = eintrag?.typ === 'datum';
  const operatoren = istDatum ? OPERATOREN_DATUM : OPERATOREN_WERT;
  const zeigeStatusAuswahl =
    (blatt.op === 'ist' || blatt.op === 'istNicht') && STATUS_FELDER.includes(blatt.feldId);
  const zeigeFreiWert = (blatt.op === 'ist' || blatt.op === 'istNicht') && !zeigeStatusAuswahl;
  const zeigeTage = blatt.op === 'datumVor' || blatt.op === 'datumNach';

  const setFeld = (feldId: string): void => {
    const neu = spalten.find(s => s.feldId === feldId);
    const passend = neu?.typ === 'datum' ? OPERATOREN_DATUM : OPERATOREN_WERT;
    // Operator mitziehen, wenn er zum neuen Feld-Typ nicht mehr passt.
    if ((passend as readonly string[]).includes(blatt.op)) {
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
    }
  };

  return (
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
        {operatoren.map(op => <option key={op} value={op}>{OPERATOR_LABEL[op]}</option>)}
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
  );
}

export function BedingungEditor({ bedingung, spalten, onChange, tiefe = 0 }: {
  bedingung: Bedingung;
  spalten: SpaltenEintrag[];
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
                blatt={kind} spalten={spalten}
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
