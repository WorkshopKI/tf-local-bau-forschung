/**
 * Die linke Spalte der Textbaustein-Verwaltung: der Katalog als Baum statt als
 * flache Liste über 78+ Einträge.
 *
 * **Was hier passiert, ist Kuration von Metadaten — kein Texteingriff.**
 * Umbenennen setzt `thema`, Ziehen setzt `thema`; der Rechtstext bleibt
 * unberührt (Pitfall #34). Geschrieben wird ausschließlich über die bestehende
 * Pipeline (`bearbeiteBaustein`/`setzeBausteinStatus` → `upsertBaustein` →
 * `persist`), und ein Thema-Umbenennen über N Bausteine geht als **ein**
 * Schreibvorgang hinaus (Pitfall #16/#20).
 *
 * **Kein Löschen.** Der Katalog kennt keins (`versionierung.ts`), und der
 * NF-Seed trüge einen entfernten Baustein beim nächsten Laden wieder ein. Das
 * Kontextmenü bietet Stilllegen an; Entf öffnet dieselbe Rückfrage.
 */
import { useMemo, useState } from 'react';
import { FileText, Folder, FolderOpen } from 'lucide-react';
import { TfTree, type TfTreeNodeRenderProps } from '@/components/tree';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BausteinStatus, TextbausteinRecord } from '@/core/services/skills';
import {
  BAUSTEIN_BAUM_ROOT, baueBausteinBaum, bausteinKnotenId, bausteineImThema, darfVerschieben,
  themaKnotenId, type BausteinGruppe, type BausteinKnoten,
} from './bausteinBaum';
import { STATUS_LABEL, STATUS_VARIANT } from './textbausteinLabels';

export interface TextbausteinBaumProps {
  /** Gefilterte Sicht — sie speist den Baum. */
  gefiltert: readonly TextbausteinRecord[];
  /** Vollbestand — nötig, um Ziel-Gruppen und Betroffene sauber zu bestimmen. */
  alle: readonly TextbausteinRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canEdit: boolean;
  busy: boolean;
  /** Thema aller übergebenen Bausteine setzen — EIN Schreibvorgang. */
  onThemaSetzen: (bausteine: readonly TextbausteinRecord[], thema: string) => void;
  onStatus: (baustein: TextbausteinRecord, status: BausteinStatus, grund: string) => void;
}

/** Welche Statuswechsel aus dem Kontextmenü heraus sinnvoll sind. */
const UEBERGAENGE: Record<BausteinStatus, BausteinStatus[]> = {
  entwurf: ['freigegeben', 'stillgelegt'],
  freigegeben: ['entwurf', 'stillgelegt'],
  stillgelegt: ['entwurf'],
};

export function TextbausteinBaum({
  gefiltert, alle, selectedId, onSelect, canEdit, busy, onThemaSetzen, onStatus,
}: TextbausteinBaumProps): React.ReactElement {
  const { items, rootId } = useMemo(() => baueBausteinBaum(gefiltert), [gefiltert]);
  const [offen, setOffen] = useState<string[]>([]);
  const [statusFrage, setStatusFrage] = useState<
    { baustein: TextbausteinRecord; ziel: BausteinStatus } | null
  >(null);
  const [themaFrage, setThemaFrage] = useState<
    { gruppe: BausteinGruppe; betroffen: TextbausteinRecord[]; neu: string } | null
  >(null);
  const [einzelThema, setEinzelThema] = useState<
    { baustein: TextbausteinRecord; wert: string } | null
  >(null);

  // Die Filterleiste oben schneidet den Baum zu — Trefferpfade müssen offen
  // sein, sonst zeigt eine erfolgreiche Suche lauter zugeklappte Ordner.
  const alleOrdner = useMemo(
    () => Object.values(items).filter(i => i.isFolder && i.id !== BAUSTEIN_BAUM_ROOT).map(i => i.id),
    [items],
  );
  const sichtbar = offen.length === 0 && gefiltert.length < alle.length ? alleOrdner : offen;

  const bausteinVon = (id: string): TextbausteinRecord | undefined =>
    alle.find(b => bausteinKnotenId(b.id) === id);

  const gruppeVonKnoten = (id: string): BausteinGruppe | undefined => {
    const d = items[id]?.data;
    return d?.art === 'thema' ? d.gruppe : undefined;
  };

  /**
   * Inline-Umbenennen gilt **nur für Thema-Knoten**. Ein Baustein zeigt in der
   * Zeile seine Id — stünde die im Eingabefeld, läse sich der Vorgang als
   * „Id ändern", und genau das darf nie passieren (Ids stehen in versandten
   * NF-Dokumenten). Das Thema eines einzelnen Bausteins ändert der Dialog aus
   * dem Kontextmenü, der die Beschriftung dazuschreibt.
   */
  /**
   * Die Id eines Gruppenknotens trägt seine Beschriftung — nach dem Umbenennen
   * ist es eine andere Id. Der Aufklapp-Zustand wandert mit, sonst klappte die
   * Gruppe unter der Hand des Nutzers zu.
   */
  const uebertrageOffen = (alt: BausteinGruppe, neu: string): void => {
    const alteId = themaKnotenId(alt.typ, alt.kategorie, alt.thema);
    const neueId = themaKnotenId(alt.typ, alt.kategorie, neu);
    setOffen(prev => (prev.includes(alteId) ? prev.map(i => (i === alteId ? neueId : i)) : prev));
  };

  const umbenennen = (id: string, wert: string): void => {
    const neu = wert.trim();
    if (!neu) return;
    const gruppe = gruppeVonKnoten(id);
    if (!gruppe || gruppe.thema === neu) return;
    const betroffen = bausteineImThema(alle, gruppe);
    // Ein Thema-Knoten steht für mehrere Datensätze — das muss vor dem
    // Schreiben auf dem Tisch liegen, nicht danach in der Historie.
    if (betroffen.length > 1) { setThemaFrage({ gruppe, betroffen, neu }); return; }
    uebertrageOffen(gruppe, neu);
    onThemaSetzen(betroffen, neu);
  };

  return (
    <div className="flex w-[340px] shrink-0 flex-col">
      {gefiltert.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-[var(--tf-text-tertiary)]">
          Keine Bausteine für diesen Filter.
        </div>
      ) : (
        <TfTree<BausteinKnoten>
          items={items}
          rootId={rootId}
          label="Textbausteine"
          className="max-h-[70vh] overflow-y-auto pr-1"
          features={{ selection: true, renaming: canEdit, dnd: canEdit }}
          expandedItems={sichtbar}
          onExpandedChange={setOffen}
          selectedItems={selectedId ? [bausteinKnotenId(selectedId)] : []}
          onPrimaryAction={(_, data) => { if (data.art === 'baustein') onSelect(data.baustein.id); }}
          canRename={(_, data) => data.art === 'thema'}
          onRename={umbenennen}
          canDrag={ids => ids.every(i => bausteinVon(i) !== undefined)}
          canDrop={(quellen, ziel) => {
            const gruppe = gruppeVonKnoten(ziel);
            if (!gruppe) return false;
            return quellen.every(q => {
              const b = bausteinVon(q);
              return b !== undefined && darfVerschieben(b, gruppe, alle);
            });
          }}
          onDrop={(quellen, ziel) => {
            const gruppe = gruppeVonKnoten(ziel);
            if (!gruppe) return;
            const bausteine = quellen.map(bausteinVon).filter((b): b is TextbausteinRecord => !!b);
            if (bausteine.length > 0) onThemaSetzen(bausteine, gruppe.thema);
          }}
          slots={{
            icon: p => <Symbol p={p} />,
            label: p => <Beschriftung p={p} />,
            trailing: p => <Rechts p={p} />,
            contextMenu: p => (canEdit
              ? (
                <Menue
                  p={p}
                  onUmbenennen={() => p.starteUmbenennen()}
                  onThemaAendern={b => setEinzelThema({ baustein: b, wert: b.thema })}
                  onStatus={setStatusFrage}
                />
              )
              : null),
          }}
        />
      )}

      {statusFrage && (
        <StatusDialog
          baustein={statusFrage.baustein}
          ziel={statusFrage.ziel}
          busy={busy}
          onClose={() => setStatusFrage(null)}
          onBestaetigen={grund => {
            onStatus(statusFrage.baustein, statusFrage.ziel, grund);
            setStatusFrage(null);
          }}
        />
      )}

      {einzelThema && (
        <Dialog
          open
          onClose={() => setEinzelThema(null)}
          size="sm"
          title={`Thema ändern — ${einzelThema.baustein.id}`}
          description="Verschiebt den Baustein in ein anderes Thema. Die Id bleibt unverändert — sie steht in versandten Nachforderungen."
          footer={
            <>
              <Button variant="ghost" onClick={() => setEinzelThema(null)}>Abbrechen</Button>
              <Button
                variant="primary"
                disabled={einzelThema.wert.trim() === '' || einzelThema.wert.trim() === einzelThema.baustein.thema}
                loading={busy}
                onClick={() => {
                  onThemaSetzen([einzelThema.baustein], einzelThema.wert.trim());
                  setEinzelThema(null);
                }}
              >
                Thema setzen
              </Button>
            </>
          }
        >
          <Input
            value={einzelThema.wert}
            onChange={e => setEinzelThema(f => (f ? { ...f, wert: e.target.value } : f))}
            placeholder="Thema"
            className="h-8 text-[12.5px]"
          />
        </Dialog>
      )}

      {themaFrage && (
        <Dialog
          open
          onClose={() => setThemaFrage(null)}
          size="sm"
          title="Thema umbenennen"
          description={`„${themaFrage.gruppe.thema}" wird zu „${themaFrage.neu}" — das ändert ${themaFrage.betroffen.length} Bausteine.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setThemaFrage(null)}>Abbrechen</Button>
              <Button
                variant="primary"
                loading={busy}
                onClick={() => {
                  uebertrageOffen(themaFrage.gruppe, themaFrage.neu);
                  onThemaSetzen(themaFrage.betroffen, themaFrage.neu);
                  setThemaFrage(null);
                }}
              >
                {themaFrage.betroffen.length} Bausteine umbenennen
              </Button>
            </>
          }
        >
          <div className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">
            {themaFrage.betroffen.map(b => b.id).join(' · ')}
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Symbol({ p }: { p: TfTreeNodeRenderProps<BausteinKnoten> }): React.ReactElement {
  const Icon = p.data.art === 'baustein' ? FileText : p.isExpanded ? FolderOpen : Folder;
  return <Icon size={13} className="shrink-0 text-[var(--tf-text-tertiary)]" />;
}

function Beschriftung({ p }: { p: TfTreeNodeRenderProps<BausteinKnoten> }): React.ReactElement {
  if (p.data.art === 'baustein') {
    const b = p.data.baustein;
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">{b.id}</span>
        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${
          p.isSelected ? 'font-medium text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'
        }`}>
          {b.text.slice(0, 60)}
        </span>
      </span>
    );
  }
  return (
    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--tf-text)]">{p.name}</span>
  );
}

function Rechts({ p }: { p: TfTreeNodeRenderProps<BausteinKnoten> }): React.ReactElement | null {
  if (p.data.art === 'baustein') {
    return <Badge variant={STATUS_VARIANT[p.data.baustein.status]}>{STATUS_LABEL[p.data.baustein.status]}</Badge>;
  }
  if (p.data.art === 'wurzel') return null;
  return (
    <span className="shrink-0 text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">{p.data.anzahl}</span>
  );
}

function Menue({ p, onUmbenennen, onThemaAendern, onStatus }: {
  p: TfTreeNodeRenderProps<BausteinKnoten>;
  onUmbenennen: () => void;
  onThemaAendern: (b: TextbausteinRecord) => void;
  onStatus: (f: { baustein: TextbausteinRecord; ziel: BausteinStatus }) => void;
}): React.ReactElement | null {
  if (p.data.art === 'wurzel' || p.data.art === 'bereich' || p.data.art === 'kategorie') return null;
  if (p.data.art === 'thema') {
    return (
      <>
        <ContextMenuLabel>{p.data.anzahl} Bausteine</ContextMenuLabel>
        <ContextMenuItem onSelect={onUmbenennen}>Thema umbenennen …</ContextMenuItem>
      </>
    );
  }
  const b = p.data.baustein;
  return (
    <>
      <ContextMenuLabel>{b.id} · Fassung {b.version}</ContextMenuLabel>
      <ContextMenuItem onSelect={() => onThemaAendern(b)}>Thema ändern …</ContextMenuItem>
      <ContextMenuSeparator />
      {UEBERGAENGE[b.status].map(ziel => (
        <ContextMenuItem
          key={ziel}
          variant={ziel === 'stillgelegt' ? 'danger' : 'default'}
          onSelect={() => onStatus({ baustein: b, ziel })}
        >
          {ziel === 'freigegeben' ? 'Freigeben …'
            : ziel === 'entwurf' ? 'Zurück in Entwurf …'
              : 'Stilllegen …'}
        </ContextMenuItem>
      ))}
    </>
  );
}

/** Statuswechsel braucht eine Begründung — sie ist die auditrelevante Angabe. */
function StatusDialog({ baustein, ziel, busy, onClose, onBestaetigen }: {
  baustein: TextbausteinRecord;
  ziel: BausteinStatus;
  busy: boolean;
  onClose: () => void;
  onBestaetigen: (grund: string) => void;
}): React.ReactElement {
  const [grund, setGrund] = useState('');
  const titel = ziel === 'freigegeben' ? 'Baustein freigeben'
    : ziel === 'entwurf' ? 'Zurück in Entwurf' : 'Baustein stilllegen';
  const hinweis = ziel === 'stillgelegt'
    ? 'Stillgelegte Bausteine bleiben lesbar, damit alte Artefakte nachvollziehbar bleiben. Gelöscht wird nichts.'
    : `Der Baustein wechselt auf „${STATUS_LABEL[ziel]}" und bekommt eine neue Fassung.`;
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={`${titel} — ${baustein.id}`}
      description={hinweis}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={grund.trim() === ''} loading={busy} onClick={() => onBestaetigen(grund.trim())}>
            {titel}
          </Button>
        </>
      }
    >
      <Input
        value={grund}
        onChange={e => setGrund(e.target.value)}
        placeholder="Begründung (Pflicht)"
        className="h-8 text-[12.5px]"
      />
    </Dialog>
  );
}
