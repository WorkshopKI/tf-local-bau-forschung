/**
 * Die **To-do-Kaskade** pflegen — der geteilte Ersatz für die WENN-Formeln der
 * AB-Mappe.
 *
 * Jede Regel steht als deutscher Satz da: „WENN … DANN «…», zuständig AB". Wer
 * eine Regel lesen kann, kann sie prüfen — und darum geht es, denn die Kaskade
 * ersetzt eine Rechnung, die bisher nur eine Person überblickte.
 *
 * **Reihenfolge über Pfeile, nicht über Ziehen.** Die Position IST das Ergebnis
 * (erste zutreffende Regel gewinnt), deshalb muss sie präzise und
 * nachvollziehbar änderbar sein — ein Pfeilklick verschiebt um genau eine
 * Position, mit der Tastatur bedienbar und ohne Drop-Ziel-Raten. Der
 * Ordner-Editor zieht, weil dort eine Baum-Struktur das Ziel bestimmt; hier gibt
 * es nur ein Davor und ein Danach.
 *
 * Der Bedingungs-Editor ist der **domänenfreie** aus den Meilensteinen — kein
 * zweiter, der beim nächsten Operator auseinanderliefe.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BedingungEditor } from '@/plugins/meilensteine/BedingungEditor';
import type { SpaltenEintrag } from '@/core/services/csv/spalten-inventar';
import {
  ROLLE_LABEL, ROLLE_LANG, bedingungSatz,
  type Bedingung, type MappingVersion, type Rolle, type TodoRegel,
} from '@/core/status';
import { feldKlasse, feldStil } from './labels';

/** Wer wartet — Rollen plus „Antragsteller", der außerhalb des Hauses steht. */
const WARTET_WAHL: { wert: string; label: string }[] = [
  { wert: '', label: '—' },
  { wert: 'ab', label: ROLLE_LANG.ab },
  { wert: 'fb', label: ROLLE_LANG.fb },
  { wert: 'qs', label: ROLLE_LANG.qs },
  { wert: 'pa', label: ROLLE_LANG.pa },
  { wert: 'jur', label: ROLLE_LANG.jur },
  { wert: 'ast', label: 'Antragsteller' },
];

const ROLLEN_WAHL: readonly Rolle[] = ['ab', 'fb', 'qs', 'pa', 'jur'];

function RegelSatz({ r, version }: { r: TodoRegel; version: MappingVersion }): React.ReactElement {
  const istSperre = (r.sperrt?.length ?? 0) > 0;
  return (
    <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
      <span className="text-[var(--tf-text-tertiary)]">WENN</span>{' '}
      {bedingungSatz(r.bedingung, version)}{' '}
      <span className="text-[var(--tf-text-tertiary)]">DANN</span>{' '}
      {istSperre ? (
        <span className="text-[var(--tf-text)]">
          {r.sperrt!.length} Regeln überspringen ({r.sperrt!.join(', ')})
        </span>
      ) : (
        <>
          <span className="text-[var(--tf-text)]">„{r.todo}"</span>
          {r.zustaendig.length > 0 && (
            <>, zuständig {r.zustaendig.map(x => ROLLE_LABEL[x]).join('/')}</>
          )}
          {r.wartetAuf && (
            <>, wartet auf {r.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LABEL[r.wartetAuf]}</>
          )}
        </>
      )}
    </p>
  );
}

function RegelKarte({ r, version, index, anzahl, api }: {
  r: TodoRegel;
  version: MappingVersion;
  index: number;
  anzahl: number;
  api: TodoRegelnApi;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const istSperre = (r.sperrt?.length ?? 0) > 0;
  const set = (patch: Partial<TodoRegel>): void => api.setTodoRegel(r.id, patch);

  return (
    <div className="rounded px-3 py-2 flex flex-col gap-1.5" style={{ ...feldStil, opacity: r.aktiv ? 1 : 0.6 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)] w-[26px]">{index + 1}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button" title="eine Position nach oben" disabled={index === 0}
            onClick={() => api.verschiebeTodoRegel(r.id, -1)}
            className="p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button" title="eine Position nach unten" disabled={index === anzahl - 1}
            onClick={() => api.verschiebeTodoRegel(r.id, 1)}
            className="p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{r.beschreibung}</span>
        {istSperre && <Badge variant="default">Sperre</Badge>}
        {!r.aktiv && <Badge variant="default">stillgelegt</Badge>}
        <span className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer">
            <input
              type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={r.aktiv}
              onChange={e => set({ aktiv: e.target.checked })}
            />
            aktiv
          </label>
          <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{r.id}</span>
        </span>
      </div>

      <RegelSatz r={r} version={version} />

      <button
        type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
        className="self-start text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline"
      >
        {offen ? 'Bearbeitung schließen' : 'Bearbeiten'}
      </button>

      {offen && (
        <div className="flex flex-col gap-2 pt-1">
          <input
            value={r.beschreibung} placeholder="Beschreibung" className={feldKlasse} style={feldStil}
            onChange={e => set({ beschreibung: e.target.value })}
          />
          {!istSperre && (
            <>
              <input
                value={r.todo} placeholder="To-do-Text (Gruppe im Board)" className={feldKlasse} style={feldStil}
                onChange={e => set({ todo: e.target.value })}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">zuständig</span>
                {ROLLEN_WAHL.map(x => {
                  const an = r.zustaendig.includes(x);
                  return (
                    <button
                      key={x} type="button" aria-pressed={an} title={ROLLE_LANG[x]}
                      onClick={() => set({
                        zustaendig: an ? r.zustaendig.filter(y => y !== x) : [...r.zustaendig, x],
                      })}
                      className={`text-[11px] leading-none rounded px-1.5 py-1 cursor-pointer ${
                        an ? 'text-white' : 'text-[var(--tf-text-tertiary)]'}`}
                      style={an ? { background: 'var(--tf-primary)' } : feldStil}
                    >
                      {ROLLE_LABEL[x]}
                    </button>
                  );
                })}
                <span className="w-2" />
                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">wartet auf</span>
                <select
                  value={r.wartetAuf ?? ''} className={feldKlasse} style={feldStil}
                  onChange={e => set({ wartetAuf: (e.target.value || null) as TodoRegel['wartetAuf'] })}
                >
                  {WARTET_WAHL.map(w => <option key={w.wert} value={w.wert}>{w.label}</option>)}
                </select>
              </div>
            </>
          )}
          <BedingungEditor
            bedingung={r.bedingung}
            spalten={api.spalten}
            onChange={(b: Bedingung) => set({ bedingung: b })}
          />
        </div>
      )}
    </div>
  );
}

/** Der Ausschnitt der Cockpit-API, den dieser Bereich braucht. */
export interface TodoRegelnApi {
  setTodoRegel: (id: string, patch: Partial<TodoRegel>) => void;
  verschiebeTodoRegel: (id: string, richtung: -1 | 1) => void;
  todoRegelnNachziehen: () => void;
  /** Spalten-Vorrat für den Bedingungs-Editor — derselbe wie bei den Meilensteinen. */
  spalten: SpaltenEintrag[];
}

export function TodoRegelnBereich({ version, api }: {
  version: MappingVersion;
  api: TodoRegelnApi;
}): React.ReactElement {
  const regeln = [...(version.todoRegeln ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">To-do-Regeln</h3>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{regeln.length}</span>
      </div>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Geordnete Kaskade: die <strong>erste zutreffende</strong> Regel bestimmt das To-do — die
        Reihenfolge ist also Teil des Ergebnisses, keine Sortierung der Anzeige. Sperren stehen vorn
        und erzeugen kein To-do, sondern legen ganze Stränge stumm. Trifft nichts, steht der Antrag
        im Board unter „Kein To-do ermittelt".
      </p>

      {regeln.length === 0 ? (
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <span className="text-[12.5px] text-[var(--tf-text)]">
            Diese Fassung führt keine To-do-Regeln. Die Auslieferung bringt den AB-Regelsatz mit
            (25 Regeln + 2 Sperren, transkribiert aus der Mappe „AB Anträge").
          </span>
          <Button variant="secondary" size="sm" onClick={api.todoRegelnNachziehen}>Nachziehen</Button>
        </div>
      ) : (
        regeln.map((r, i) => (
          <RegelKarte
            key={r.id} r={r} version={version} index={i} anzahl={regeln.length} api={api}
          />
        ))
      )}
    </section>
  );
}
