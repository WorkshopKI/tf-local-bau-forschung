/**
 * Der Verfahrensschnitt als Baum: Phasen aufklappen, Statuswerte umhängen.
 *
 * Die Handlung, die AB und FB vollziehen wollen, ist „diesen Status aus
 * *Vollständigkeit* nach *Prüfung* schieben". Das ist Ziehen auf einen anderen
 * Knoten — deshalb `TfTree`, zweiter Einsatz nach dem Ordner-Editor.
 *
 * Diese Datei hält nur die Gestalt. Die Struktur liefert `phasenKnoten.ts`, die
 * Zug-Regeln `phasenDrag.ts`, den rechten Bereich `PhasenDetail.tsx` — hier wird
 * keine Regel zum zweiten Mal geschrieben. (Das Datenmodul heißt bewusst NICHT
 * `phasenBaum.ts`: ein Geschwister, das sich nur im Casing unterscheidet, ist
 * unter Windows eine TS1149-Kollision.)
 *
 * **Der Zieh-Griff ist Pflicht** (`dragHandle`): die Zeilen tragen Zähler und
 * Beschriftungen, die man markieren können muss, ohne einen Zug zu starten.
 */
import { useMemo, useState } from 'react';
import { GripVertical, Plus, Trash2, CircleSlash, Milestone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenuItem, ContextMenuLabel, ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { MasterDetailLayout } from '@/components/master-detail';
import { TfTree, type TfTreeNodeRenderProps } from '@/components/tree';
import { MAX_PHASEN, phaseFuerCode, zahPhasenVon } from '@/core/status';
import { wertId, type StatusCockpitApi } from './useStatusCockpit';
import {
  bauePhasenBaum, OHNE_PHASE_ID, WURZEL_ID, type PhasenBaumKnoten,
} from './phasenKnoten';
import { darfAblegen, darfZiehen, deuteZug } from './phasenDrag';
import { PhasenDetail } from './PhasenDetail';
import { PhaseLoeschenDialog } from './PhaseLoeschenDialog';

const zahl = (n: number): string => n.toLocaleString('de-DE');

/** „1 Wert" / „5 Werte" — die Zahl steht an jeder Zeile, der Fehler fiele auf. */
const werteWort = (n: number): string => `${n} ${n === 1 ? 'Wert' : 'Werte'}`;
const vorgangWort = (n: number): string => `${zahl(n)} ${n === 1 ? 'Vorgang' : 'Vorgänge'}`;

export function PhasenBaum({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const entwurf = api.entwurf;
  const [offen, setOffen] = useState<string[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<string | null>(null);

  const { items, rootId, verwaiste } = useMemo(
    () => (entwurf
      ? bauePhasenBaum(entwurf, api.vorkommen, wertId, phaseFuerCode)
      : { items: {}, rootId: WURZEL_ID, verwaiste: 0 }),
    [entwurf, api.vorkommen],
  );

  const phasen = useMemo(() => zahPhasenVon(entwurf?.zahPhasen), [entwurf?.zahPhasen]);

  // Auswahl ABLEITEN statt synchronisieren: verschwindet der Knoten (Phase
  // gelöscht, Code umgehängt), schließt sich das Detail von selbst.
  const auswahl = gewaehlt !== null ? items[gewaehlt] : undefined;

  const zuLoeschen = loeschen !== null ? items[loeschen] : undefined;
  const loeschPhase = zuLoeschen?.data.art === 'phase' ? zuLoeschen.data : null;

  if (!entwurf) return null;

  const vollBesetzt = phasen.length >= MAX_PHASEN;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <p className="flex-1 text-[12.5px] text-[var(--tf-text-secondary)]">
          Ziehen Sie einen Statuswert auf einen anderen Verfahrensschritt, um ihn umzuhängen.
          Beide Katalog-Zeilen des Codes (TV und Verbund) ziehen mit.
        </p>
        <Button
          variant="secondary" size="sm"
          disabled={!api.darfSchreiben || vollBesetzt}
          title={vollBesetzt
            ? `Höchstens ${MAX_PHASEN} Schritte — darüber wird die Verfahrensleiste unlesbar.`
            : undefined}
          onClick={() => api.addZahPhase('Neuer Schritt', 'sonstige')}
        >
          <Plus size={13} /> Schritt anlegen
        </Button>
      </div>

      {verwaiste > 0 && (
        <p className="shrink-0 text-[12px] text-[var(--tf-warning-text)]">
          {verwaiste} Statuswerte zeigen auf einen Schritt, den es nicht mehr gibt. Sie stehen
          unten unter „Ohne Phase" und sind dort als <em>verwaist</em> markiert.
        </p>
      )}

      {/* Der Split braucht einen Flex-Spalten-Kontext mit DEFINITER Höhe. Der
          Katalog-Tab liegt in einem Seiten-Scroller (dort stehen unter ihm noch
          Referenzdaten und Fassungen) — eine `flex-1`-Höhe gäbe es hier also
          nicht. Deshalb eine feste Bühne statt „nimm, was übrig ist". */}
      <div className="flex h-[62vh] min-h-[380px] flex-col rounded" style={{ border: '0.5px solid var(--tf-border)' }}>
        <MasterDetailLayout
          listWidthKey="teamflow_status_phasen_narrow_width"
          onCloseDetail={() => setGewaehlt(null)}
          list={(
            <div className="pr-1">
            <TfTree<PhasenBaumKnoten>
              items={items}
              rootId={rootId}
              label="Verfahrensschnitt"
              features={{
                renaming: true, dnd: true, dragHandle: true, reorder: true, selection: true,
              }}
              expandedItems={offen}
              onExpandedChange={setOffen}
              selectedItems={gewaehlt !== null ? [gewaehlt] : []}
              onSelectedChange={ids => setGewaehlt(ids[0] ?? null)}
              canRename={(_, d) => d.art === 'phase'}
              onRename={(id, wert) => {
                const label = wert.trim();
                if (label) api.setZahPhase(id, { label });
              }}
              canDrag={darfZiehen}
              canDrop={(quellen, ziel) => darfAblegen(items, quellen, ziel)}
              onDrop={(quellen, ziel, index) => {
                const zug = deuteZug(items, quellen, ziel, index);
                if (zug.art === 'code-umhaengen') api.setCodePhase(zug.codes, zug.zielPhase);
                else if (zug.art === 'phase-sortieren') api.moveZahPhase(zug.phaseId, zug.index);
              }}
              slots={{
                leading: p => (p.dragHandleProps && p.id !== OHNE_PHASE_ID ? (
                  <span
                    {...p.dragHandleProps}
                    className="shrink-0 cursor-grab text-[var(--tf-text-tertiary)] active:cursor-grabbing"
                    title={p.data.art === 'phase'
                      ? 'Ziehen, um die Reihenfolge zu ändern'
                      : 'Ziehen und auf einem Verfahrensschritt ablegen'}
                  >
                    <GripVertical size={13} />
                  </span>
                ) : null),
                icon: p => (p.data.art === 'ohne-phase'
                  ? <CircleSlash size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" />
                  : p.data.art === 'phase'
                    ? <Milestone size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" />
                    : null),
                label: p => <Beschriftung p={p} />,
                trailing: p => <Steuerung p={p} api={api} onLoeschen={setLoeschen} />,
                contextMenu: p => (
                  <Menue p={p} api={api} onLoeschen={setLoeschen} />
                ),
              }}
            />
          </div>
        )}
          detail={auswahl && (
            <div className="h-full overflow-y-auto">
              <PhasenDetail key={auswahl.id} knoten={auswahl.data} api={api} />
            </div>
          )}
        />
      </div>

      <PhaseLoeschenDialog
        phase={loeschPhase?.phase ?? null}
        codeAnzahl={loeschPhase?.codeAnzahl ?? 0}
        phasen={phasen}
        offen={loeschen !== null}
        darfSchreiben={api.darfSchreiben}
        onSchliessen={() => setLoeschen(null)}
        onLoeschen={zielId => {
          if (loeschen !== null) api.removeZahPhase(loeschen, zielId);
          setGewaehlt(null);
        }}
      />
    </div>
  );
}

/**
 * Die Beschriftung trägt, was die Entscheidung braucht: bei der Phase, wie viel
 * an ihr hängt; beim Statuswert, wie oft er vorkommt und ob eine Zielvorgabe
 * gepflegt ist. Ohne die Zahlen diskutiert man im Leeren.
 */
function Beschriftung({ p }: {
  p: TfTreeNodeRenderProps<PhasenBaumKnoten>;
}): React.ReactElement {
  const d = p.data;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className={`min-w-0 truncate text-[13px] ${
        d.art === 'code' ? 'text-[var(--tf-text)]' : 'font-medium text-[var(--tf-text)]'
      }`}>
        {p.name}
      </span>
      {d.art === 'code' && d.verwaist && <Badge variant="warning">verwaist</Badge>}
      <span className="shrink-0 font-mono text-[11px] text-[var(--tf-text-tertiary)]">
        {d.art === 'phase' || d.art === 'ohne-phase'
          ? `· ${werteWort(d.codeAnzahl)} · ${vorgangWort(d.vorkommen)}`
          : d.art === 'code'
            ? `· ${zahl(d.vorkommen)}${d.zieltage !== null ? ` · ${d.zieltage} T` : ''}`
            : ''}
      </span>
    </span>
  );
}

/** Nur der Löschknopf — alles Weitere steht rechts im Detail. */
function Steuerung({ p, api, onLoeschen }: {
  p: TfTreeNodeRenderProps<PhasenBaumKnoten>;
  api: StatusCockpitApi;
  onLoeschen: (id: string) => void;
}): React.ReactElement | null {
  if (p.data.art !== 'phase' || !api.darfSchreiben) return null;
  return (
    // Der Klick darf NICHT bis zur Zeile durchschlagen — dort klappt er auf.
    <span
      className="flex shrink-0 items-center"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded p-1 text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-danger-text)]"
        title="Schritt entfernen — die Statuswerte ziehen um, sie verschwinden nicht"
        onClick={() => onLoeschen(p.id)}
      >
        <Trash2 size={14} />
      </button>
    </span>
  );
}

function Menue({ p, api, onLoeschen }: {
  p: TfTreeNodeRenderProps<PhasenBaumKnoten>;
  api: StatusCockpitApi;
  onLoeschen: (id: string) => void;
}): React.ReactElement | null {
  const d = p.data;
  if (d.art === 'phase') {
    return (
      <>
        <ContextMenuLabel>{d.phase.id} · {werteWort(d.codeAnzahl)}</ContextMenuLabel>
        <ContextMenuItem onSelect={p.starteUmbenennen}>Umbenennen …</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="danger" onSelect={() => onLoeschen(p.id)}>
          Schritt entfernen …
        </ContextMenuItem>
      </>
    );
  }
  if (d.art === 'code') {
    return (
      <>
        <ContextMenuLabel>Code {d.code} · {vorgangWort(d.vorkommen)}</ContextMenuLabel>
        <ContextMenuItem onSelect={() => api.setCodePhase([d.code], null)}>
          Neben das Verfahren stellen
        </ContextMenuItem>
      </>
    );
  }
  return null;
}
