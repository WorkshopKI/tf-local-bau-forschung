/**
 * Die geöffnete To-do-Regel — Kopf und Editor in der rechten Spalte.
 *
 * Der Kopf wiederholt bewusst, was links in der Zeile nicht mehr steht: die
 * Zustände, den aktiv-Haken, die Regel-Id und die **Positions-Pfeile**. Die
 * Pfeile wohnen hier, weil die schlanken Auswahl-Zeilen selbst Knöpfe sind und
 * keine weiteren tragen dürfen; „Position 5 von 27" nennt dazu die Stelle in der
 * Kaskade, die man beim Verschieben im Blick behalten will.
 *
 * Der Bedingungs-Editor ist der **domänenfreie** aus den Meilensteinen — kein
 * zweiter, der beim nächsten Operator auseinanderliefe. Sein Feld-Vorrat und
 * seine Prüfung kommen aus der **Fassung** (`baueTodoFeldVorrat` /
 * `referenzierbareFelder`), nicht aus den CSV-Schemas: die Kaskade wird gegen den
 * Katalog ausgewertet, und wer ein Feld anbietet, das dort fehlt, lädt zu einer
 * Regel ein, die nie zutrifft (v2.386).
 */
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BedingungEditor } from '@/plugins/meilensteine/BedingungEditor';
import type { SpaltenEintrag } from '@/core/services/csv/spalten-inventar';
import {
  ROLLE_LABEL, ROLLE_LANG, regelsatzVon,
  type Bedingung, type MappingVersion, type RegelWirkung, type Rolle, type TodoRegel,
} from '@/core/status';
import { feldKlasse, feldKlasseSchmal, feldStil } from './labels';
import { TodoRegelSatz } from './TodoRegelSatz';
import {
  ROLLOUT_HINWEIS, bekannteStraenge, brauchtRolloutRueckfrage, fehltStrangTrotzSperre,
  positionsText, wirkungsAnzeige, zustandsMarker,
  type KaskadenPosition, type TodoRegelnApi,
} from './todoRegelnAnsicht';

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

const PFEIL_KLASSE = 'p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]'
  + ' cursor-pointer disabled:opacity-30 disabled:cursor-default';

export function TodoRegelDetail({
  r, version, position, satz, api, vorrat, pruefeFeld, unbekannte, wirkung, veraltet,
  onSchliessen,
}: {
  r: TodoRegel;
  version: MappingVersion;
  /**
   * Stelle in der Kaskade DIESES Satzes — `null` an einer fremden Sperre.
   * „Position 5 von 27" zählte bis v4.120 die angezeigte Liste, verschoben
   * wurde aber in der eigenen Kaskade: zwei Listen, eine Angabe.
   */
  position: KaskadenPosition | null;
  /** Der gerade gezeigte Regelsatz — nicht zwingend der der Regel (Sperren). */
  satz: Rolle;
  api: TodoRegelnApi;
  vorrat: SpaltenEintrag[];
  pruefeFeld: (feldId: string) => string | null;
  unbekannte: readonly string[];
  /** Gemessene Wirkung am Bestand; `undefined`, solange kein Lauf stattfand. */
  wirkung: RegelWirkung | undefined;
  veraltet: boolean;
  onSchliessen: () => void;
}): React.ReactElement {
  const { istSperre, eigen, giltFuerAlle } = zustandsMarker(r, satz, unbekannte);
  const w = wirkungsAnzeige(wirkung, istSperre);
  const alleRegeln = version.todoRegeln ?? [];
  const straenge = bekannteStraenge(alleRegeln);
  const strangFehlt = fehltStrangTrotzSperre(r, alleRegeln, satz);
  const set = (patch: Partial<TodoRegel>): void => api.setTodoRegel(r.id, patch);
  const setzeAktiv = (an: boolean): void => {
    if (brauchtRolloutRueckfrage(r, an)
      && !window.confirm(`${ROLLOUT_HINWEIS}\n\nRegel „${r.beschreibung}" trotzdem aktivieren?`)) return;
    set({ aktiv: an });
  };
  // Eine vorgangsweite Sperre erscheint in JEDEM Satz — verschieben lässt sie
  // sich aber nur dort, wo sie zu Hause ist: sonst bewegte ein Klick im FB-Tab
  // eine Regel, die im AB-Tab an anderer Stelle steht.
  const pfeilTitel = eigen
    ? null
    : 'Diese Sperre gilt für alle Regelsätze — verschieben im Satz AB';

  return (
    // Das Detail-Pane des Shells ist `overflow-hidden`; das Scrollen bringt der
    // Inhalt mit. Kein `opacity` für stillgelegte Regeln: ein gedimmter Editor
    // läse sich wie „gesperrt", obwohl jedes Feld bedienbar ist.
    <div className="h-full overflow-y-auto flex flex-col gap-3 p-4">
      <div className="shrink-0 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <h4 className="flex-1 min-w-0 text-[14px] font-medium text-[var(--tf-text)]">
            {r.beschreibung}
          </h4>
          <Button variant="ghost" size="sm" icon={X} onClick={onSchliessen} title="Schließen (Esc)">
            Schließen
          </Button>
        </div>

        {(istSperre || !r.aktiv || unbekannte.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {istSperre && <Badge variant="default">Sperre</Badge>}
            {giltFuerAlle && (
              <span title="Sie trägt kein giltFuer und wirkt deshalb in jedem Regelsatz.">
                <Badge variant="default">gilt für alle Regelsätze</Badge>
              </span>
            )}
            {!r.aktiv && <Badge variant="default">stillgelegt</Badge>}
            {unbekannte.length > 0 && (
              <Badge variant="error">trifft nie zu: {unbekannte.join(', ')}</Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap text-[12px]">
          <label className="inline-flex items-center gap-1.5 text-[var(--tf-text-secondary)] cursor-pointer">
            <input
              type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={r.aktiv}
              onChange={e => setzeAktiv(e.target.checked)}
            />
            aktiv
          </label>
          <span className="inline-flex items-center gap-1 text-[var(--tf-text-secondary)]">
            {position === null
              ? `Sperre aus dem Satz ${ROLLE_LABEL[regelsatzVon(r)]}`
              : positionsText(position.index, position.anzahl)}
            <button
              type="button" disabled={position === null || position.index === 0} className={PFEIL_KLASSE}
              title={pfeilTitel ?? 'eine Position nach oben'}
              onClick={() => api.verschiebeTodoRegel(r.id, -1)}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button" className={PFEIL_KLASSE}
              disabled={position === null || position.index === position.anzahl - 1}
              title={pfeilTitel ?? 'eine Position nach unten'}
              onClick={() => api.verschiebeTodoRegel(r.id, 1)}
            >
              <ChevronDown size={14} />
            </button>
          </span>
          <span className="ml-auto text-[11px] font-mono text-[var(--tf-text-tertiary)]">{r.id}</span>
        </div>

        <TodoRegelSatz r={r} version={version} />

        {/* Hier prominenter als in der Zeile: wer eine Regel bearbeitet, trifft
            genau hier die Entscheidung, für die die Zahl gedacht ist. */}
        {w !== null && (
          <p
            className={`text-[12px] leading-[1.35] rounded px-2 py-1.5 ${
              w.nullbefund ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-secondary)]'}`}
            style={feldStil}
          >
            {w.lang}
            {veraltet && (
              <em> — Stand vor der letzten Änderung; erneut messen für aktuelle Zahlen.</em>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
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

            {/* Freitext MIT Vorschlagsliste (`datalist`), nicht `select`: die
                Fachseite pflegt die Kaskade selbst, und ein neuer Strang darf
                kein Release brauchen. */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)] shrink-0">Strang</span>
              <input
                value={r.strang ?? ''} list={`straenge-${r.id}`} placeholder="ohne Strang"
                className={`${feldKlasseSchmal} w-[180px] shrink-0`} style={feldStil}
                onChange={e => set({ strang: e.target.value.trim() || undefined })}
              />
              <datalist id={`straenge-${r.id}`}>
                {straenge.map(x => <option key={x} value={x} />)}
              </datalist>
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                Sperren legen ganze Stränge still — der Strang entscheidet, ob diese Regel
                davon erfasst wird.
              </span>
            </div>

            {/* Der Hinweis steht NUR da, wo im gezeigten Satz wirklich eine
                Strang-Sperre greift. Sonst wäre er Lärm an jeder Regel. */}
            {strangFehlt && (
              <p className="text-[11.5px] text-[var(--tf-warning-text)]">
                ⚠ Diese Regel trägt keinen Strang und wird deshalb von <strong>keiner</strong>{' '}
                Strang-Sperre erfasst — sie feuert auch am zurückgezogenen Antrag. Gehört sie in
                eine der gesperrten Ketten, muss der Strang hier stehen.
              </p>
            )}
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
          spalten={vorrat}
          pruefeFeld={pruefeFeld}
          onChange={(b: Bedingung) => set({ bedingung: b })}
        />

        {/* Steht bewusst UNTER dem Bedingungs-Editor: sie beschreibt, warum die
            Regel so aussieht, wie sie darüber steht. In einem halben Jahr ist
            das der einzige Weg zurück zu der Sitzung, in der sie entstand. */}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">
            Begründung
          </span>
          <textarea
            value={r.begruendung ?? ''} rows={2}
            placeholder="woher stammt diese Regel, wer hat sie beschlossen?"
            className={`${feldKlasse} resize-y`} style={feldStil}
            onChange={e => set({ begruendung: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
