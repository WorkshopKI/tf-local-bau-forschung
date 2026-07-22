/**
 * Stichwort-Editor des Deep-Research-Auftrags (Paket 5). Der interne Lauf liefert nur
 * Stichworte; der Auftragstext kommt aus der festen Vorlage (`recherche-auftrag.ts`).
 * Hier korrigiert der Prüfer diese Stichworte — jede Änderung baut den Auftrag neu.
 *
 * Jede Eingabe läuft durch `pruefeStichwort`, also durch DIESELBE deterministische Regel
 * wie die Modell-Antwort (Zahlwert-, Leak- und Wortgrenzen-Guard). Abgelehnt wird mit
 * Begründung, nicht still: ein Begriff, der ohne Erklärung verschwindet, ist für den
 * Prüfer nicht von einem Bug zu unterscheiden.
 */
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ABLEHNUNGS_TEXT, FELD_GRENZEN, pruefeStichwort, type RechercheStichworte,
} from './recherche-stichworte';
import type { BekannteStammwerte } from './recherche-leak';

type ListenKey = 'technologien' | 'leistungsdimensionen' | 'marktsegmente' | 'suchbegriffeEn';
type EinzelKey = 'themenfeld' | 'anwendungsdomaene';

const EINZEL_FELDER: { key: EinzelKey; label: string; platzhalter: string }[] = [
  { key: 'themenfeld', label: 'Technologiefeld', platzhalter: 'z. B. Simulationsgestützte Organisationsentwicklung' },
  { key: 'anwendungsdomaene', label: 'Anwendungsdomäne', platzhalter: 'z. B. Produzierender Mittelstand' },
];

const LISTEN_FELDER: { key: ListenKey; label: string }[] = [
  { key: 'technologien', label: 'Verfahren und Technologien' },
  { key: 'leistungsdimensionen', label: 'Leistungsdimensionen (ohne Zahlwert)' },
  { key: 'marktsegmente', label: 'Marktsegmente' },
  { key: 'suchbegriffeEn', label: 'Englische Suchbegriffe' },
];

interface Props {
  stichworte: RechercheStichworte;
  bekannteWerte: BekannteStammwerte;
  /** Wie viele Roh-Einträge der Sanitizer beim KI-Lauf verworfen hat. */
  entfernt?: number;
  busy: boolean;
  fehler: string | null;
  /** Der Auftragstext wurde von Hand überschrieben — eine Chip-Änderung baut ihn neu. */
  handfassung?: boolean;
  onAendern: (neu: RechercheStichworte) => void;
}

export function StichworteEditor({
  stichworte, bekannteWerte, entfernt, busy, fehler, handfassung, onAendern,
}: Props): React.ReactElement {
  const [meldung, setMeldung] = useState<string | null>(null);

  const setzeEinzel = (key: EinzelKey, roh: string): void => {
    const wert = roh.trim();
    if (wert === stichworte[key]) return;
    if (!wert) { setMeldung(null); onAendern({ ...stichworte, [key]: '' }); return; }
    const p = pruefeStichwort(wert, FELD_GRENZEN[key].woerter, bekannteWerte);
    if (!p.ok) { setMeldung(ABLEHNUNGS_TEXT[p.grund]); return; }
    setMeldung(null);
    onAendern({ ...stichworte, [key]: p.wert });
  };

  const fuegeHinzu = (key: ListenKey, roh: string): boolean => {
    const g = FELD_GRENZEN[key];
    const p = pruefeStichwort(roh, g.woerter, bekannteWerte);
    if (!p.ok) { setMeldung(ABLEHNUNGS_TEXT[p.grund]); return false; }
    const vorhanden = stichworte[key];
    if (vorhanden.some(v => v.toLowerCase() === p.wert.toLowerCase())) { setMeldung(null); return true; }
    if (vorhanden.length >= g.anzahl) {
      setMeldung(`Höchstens ${g.anzahl} Einträge — bitte zuerst einen entfernen.`);
      return false;
    }
    setMeldung(null);
    onAendern({ ...stichworte, [key]: [...vorhanden, p.wert] });
    return true;
  };

  const entferne = (key: ListenKey, wert: string): void => {
    setMeldung(null);
    onAendern({ ...stichworte, [key]: stichworte[key].filter(v => v !== wert) });
  };

  return (
    <div className="mt-3 rounded-lg p-3" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-[var(--tf-text)]">Suchfeld — Stichworte</span>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Der Auftragstext wird daraus gebaut. Zahlen und Namen sind ausgeschlossen.
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {EINZEL_FELDER.map(f => (
          <EinzelFeld
            key={f.key}
            label={f.label}
            platzhalter={f.platzhalter}
            wert={stichworte[f.key]}
            disabled={busy}
            onCommit={v => setzeEinzel(f.key, v)}
          />
        ))}
        {LISTEN_FELDER.map(f => (
          <ChipListe
            key={f.key}
            label={f.label}
            werte={stichworte[f.key]}
            disabled={busy}
            onHinzu={t => fuegeHinzu(f.key, t)}
            onEntfernen={w => entferne(f.key, w)}
          />
        ))}
      </div>

      {handfassung ? (
        <p className="mt-3 text-[11.5px] text-[var(--tf-warning-text)]">
          Der Auftragstext ist von Hand überschrieben. Eine Änderung hier baut ihn aus der Vorlage neu und verwirft die Handfassung.
        </p>
      ) : null}
      {entfernt ? (
        <p className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
          {entfernt} Angabe(n) der KI wurden verworfen — Zahlwert oder identifizierender Bezug.
        </p>
      ) : null}
      {meldung ? <p className="mt-2 text-[11.5px] text-[var(--tf-warning-text)]">{meldung}</p> : null}
      {fehler ? <p className="mt-2 text-[11.5px] text-[var(--tf-danger-text)]">{fehler}</p> : null}
    </div>
  );
}

/** Einzeiliges Feld — übernimmt bei Enter oder beim Verlassen, Esc verwirft. */
function EinzelFeld({
  label, platzhalter, wert, disabled, onCommit,
}: {
  label: string;
  platzhalter: string;
  wert: string;
  disabled: boolean;
  onCommit: (v: string) => void;
}): React.ReactElement {
  const [entwurf, setEntwurf] = useState(wert);
  // Nach einer übernommenen (und ggf. gekappten) Fassung gewinnt der Prop-Wert.
  useEffect(() => { setEntwurf(wert); }, [wert]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{label}</span>
      <input
        type="text"
        value={entwurf}
        placeholder={platzhalter}
        disabled={disabled}
        onChange={e => setEntwurf(e.target.value)}
        onBlur={() => onCommit(entwurf)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(entwurf); }
          if (e.key === 'Escape') { e.preventDefault(); setEntwurf(wert); }
        }}
        className="w-full px-3 py-1.5 text-[12px] rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-border-hover)] disabled:opacity-50"
      />
    </label>
  );
}

/** Chip-Liste mit Entfernen-× und einem Eingabefeld zum Ergänzen. */
function ChipListe({
  label, werte, disabled, onHinzu, onEntfernen,
}: {
  label: string;
  werte: string[];
  disabled: boolean;
  /** `true` = übernommen (Eingabefeld leeren). */
  onHinzu: (text: string) => boolean;
  onEntfernen: (wert: string) => void;
}): React.ReactElement {
  const [neu, setNeu] = useState('');
  const uebernehmen = (): void => {
    if (!neu.trim()) return;
    if (onHinzu(neu)) setNeu('');
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {werte.map(w => (
          <span
            key={w}
            className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-[11.5px] text-[var(--tf-text)] bg-[var(--tf-bg-secondary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {w}
            <button
              type="button"
              onClick={() => onEntfernen(w)}
              disabled={disabled}
              title={`„${w}" entfernen`}
              aria-label={`„${w}" entfernen`}
              className="rounded-full p-0.5 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-50"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {werte.length === 0 ? (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">— nichts erkannt</span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <input
            type="text"
            value={neu}
            placeholder="ergänzen …"
            disabled={disabled}
            onChange={e => setNeu(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); uebernehmen(); } }}
            className="w-[150px] px-2 py-1 text-[11.5px] rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-border-hover)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={uebernehmen}
            disabled={disabled || !neu.trim()}
            title="Stichwort hinzufügen"
            aria-label="Stichwort hinzufügen"
            className="rounded-lg p-1 text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] disabled:opacity-40"
          >
            <Plus size={13} />
          </button>
        </span>
      </div>
    </div>
  );
}
