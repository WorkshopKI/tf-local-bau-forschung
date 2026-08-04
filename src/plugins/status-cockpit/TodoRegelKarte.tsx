/**
 * Eine To-do-Regel als **breite Karte** — die Gestalt, in der die Kaskade als
 * Ganzes gelesen wird.
 *
 * Zwei Zeilen: Kopf (Nummer, Pfeile, Titel, Zustände, aktiv, Id, „Bearbeiten")
 * und darunter der Satz. Der Editor steckt NICHT mehr in der Karte — er würde
 * beim Aufklappen alle folgenden Regeln nach unten schieben und damit genau den
 * Überblick nehmen, auf den es hier ankommt (die Reihenfolge IST das Ergebnis).
 * Ein Klick öffnet die Regel stattdessen in der Detail-Spalte.
 *
 * **Reihenfolge über Pfeile, nicht über Ziehen.** Ein Pfeilklick verschiebt um
 * genau eine Position, mit der Tastatur bedienbar und ohne Drop-Ziel-Raten. Die
 * Pfeile bleiben in der Karte, weil man hier die ganze Kaskade sieht.
 */
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type MappingVersion, type Rolle, type TodoRegel } from '@/core/status';
import { feldStil } from './labels';
import { TodoRegelSatz } from './TodoRegelSatz';
import {
  ROLLOUT_HINWEIS, brauchtRolloutRueckfrage, zustandsMarker, type TodoRegelnApi,
} from './todoRegelnAnsicht';

export function TodoRegelKarte({ r, version, index, anzahl, satz, api, unbekannte, onWaehlen }: {
  r: TodoRegel;
  version: MappingVersion;
  index: number;
  anzahl: number;
  /** Der gerade gezeigte Regelsatz — nicht zwingend der der Regel (Sperren). */
  satz: Rolle;
  api: TodoRegelnApi;
  /** Feld-Referenzen ohne Entsprechung im Katalog — vom Bereich vorberechnet. */
  unbekannte: readonly string[];
  onWaehlen: () => void;
}): React.ReactElement {
  const { istSperre, eigen, giltFuerAlle } = zustandsMarker(r, satz, unbekannte);
  const setzeAktiv = (an: boolean): void => {
    if (brauchtRolloutRueckfrage(r, an)
      && !window.confirm(`${ROLLOUT_HINWEIS}\n\nRegel „${r.beschreibung}" trotzdem aktivieren?`)) return;
    api.setTodoRegel(r.id, { aktiv: an });
  };

  return (
    <div
      onClick={onWaehlen}
      className="rounded px-2.5 py-1.5 flex flex-col gap-1 cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
      style={{ ...feldStil, opacity: r.aktiv ? 1 : 0.6 }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono tabular-nums text-[var(--tf-text-tertiary)] w-[22px]">
          {index + 1}
        </span>
        {/* Pfeile und aktiv-Haken schlucken ihren Klick: sonst öffnete jedes
            Verschieben nebenbei die Detail-Spalte (Muster aus `ListItem`). */}
        <span className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button
            type="button" disabled={index === 0 || !eigen}
            title={eigen ? 'eine Position nach oben' : 'Diese Sperre gilt für alle Regelsätze — verschieben im Satz AB'}
            onClick={() => api.verschiebeTodoRegel(r.id, -1)}
            className="p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button" disabled={index === anzahl - 1 || !eigen}
            title={eigen ? 'eine Position nach unten' : 'Diese Sperre gilt für alle Regelsätze — verschieben im Satz AB'}
            onClick={() => api.verschiebeTodoRegel(r.id, 1)}
            className="p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronDown size={13} />
          </button>
        </span>
        <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{r.beschreibung}</span>
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
        {/* `shrink-0` gehört dazu: in einer `flex-wrap`-Zeile verhält sich
            `ml-auto` bei vielen Badges sonst unvorhersehbar. */}
        <span className="ml-auto shrink-0 flex items-center gap-2">
          <label
            className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer"
            onClick={e => e.stopPropagation()}
          >
            <input
              type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={r.aktiv}
              onChange={e => setzeAktiv(e.target.checked)}
            />
            aktiv
          </label>
          <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{r.id}</span>
          {/* Die tastaturerreichbare Einladung — der klickbare Container ist es
              nicht. Kein `Button`-Primitive: dessen `h-8` machte die Zeile höher. */}
          <button
            type="button" onClick={onWaehlen}
            className="text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline"
          >
            Bearbeiten
          </button>
        </span>
      </div>

      <TodoRegelSatz r={r} version={version} />
    </div>
  );
}
