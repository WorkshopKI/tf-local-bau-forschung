/**
 * Konfigurations-Tab: der Meilenstein-Baum der PL. Struktur (wie viele
 * Meilensteine, welche Soll-Woche) und Zuordnung (welche CSV-Spalte erfüllt ihn)
 * an einer Stelle, ohne Code-Änderung.
 *
 * Seit dem Tree-Umbau auf der gemeinsamen `TfTree`-Basis: das Chevron klappt
 * die **Unter-Meilensteine** auf (wie überall in der App), und der
 * Bedingungs-Editor hängt am **ausgewählten** Knoten darunter. Vorher tat das
 * Dreieck beides nicht — es öffnete den Editor, und Unter-Meilensteine waren
 * immer sichtbar.
 *
 * **Umsortiert wird durch Ziehen.** Die Hoch/Runter-Schalter bleiben als
 * Zweitweg: sie waren bisher der einzige, stehen in jeder Einweisung und
 * funktionieren ohne Maus.
 *
 * Unbestätigte Zuordnungen aus dem Auslieferungs-Plan tragen einen sichtbaren
 * Hinweis — wer eine geratene Zahl für bare Münze nimmt, plant falsch.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { TfTree } from '@/components/tree';
import { ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from '@/components/ui/context-menu';
import {
  aendereKnoten, darfUmhaengen, entferneKnoten, fuegeKnotenHinzu, haengeKnotenUm,
  verschiebeKnoten, type MeilensteinKnoten, type SpaltenEintrag,
} from '@/core/meilensteine';
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import { BedingungEditor } from './BedingungEditor';
import { TYP_LABEL, feldStil } from './labels';
import {
  MEILENSTEIN_BAUM_ROOT, baueMeilensteinBaum, type MeilensteinBaumKnoten,
} from './meilensteinBaum';

interface Props {
  knoten: MeilensteinKnoten[];
  gesamtfristTage: number;
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  onKnoten: (k: MeilensteinKnoten[]) => void;
  onGesamtfrist: (tage: number) => void;
}

/** Kopfzeile eines Knotens: Nummer, Bezeichnung, Soll-Woche, Zustandsschalter. */
function KnotenKopf({ knoten, alle, schreibgeschuetzt, onKnoten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  schreibgeschuetzt: boolean;
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  const patch = (p: Partial<MeilensteinKnoten>): void => onKnoten(aendereKnoten(alle, knoten.id, p));
  return (
    // Die Eingabefelder dürfen den Zeilen-Klick nicht auslösen — der klappt
    // die Unter-Meilensteine auf.
    <span
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      <span className="text-[12px] font-mono text-[var(--tf-text-tertiary)] w-[46px] shrink-0">
        {knoten.nummer || '—'}
      </span>

      <input
        value={knoten.label}
        onChange={e => patch({ label: e.target.value })}
        disabled={schreibgeschuetzt}
        aria-label="Bezeichnung"
        className="flex-1 min-w-[180px] text-[13px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] disabled:opacity-60"
        style={feldStil}
      />

      <label className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
        Woche
        <input
          type="number" min={0}
          value={knoten.sollWoche}
          onChange={e => patch({ sollWoche: Math.max(0, Number(e.target.value) || 0) })}
          disabled={schreibgeschuetzt}
          className="w-[56px] text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] text-right disabled:opacity-60"
          style={feldStil}
        />
      </label>

      <ToggleChip
        label="aktiv"
        selected={knoten.aktiv}
        onToggle={() => patch({ aktiv: !knoten.aktiv })}
        disabled={schreibgeschuetzt}
        title="Inaktive Meilensteine werden nie als gerissen gezählt"
      />
      <ToggleChip
        label="Frist"
        selected={knoten.relevantFuerFrist}
        onToggle={() => patch({ relevantFuerFrist: !knoten.relevantFuerFrist })}
        disabled={schreibgeschuetzt}
        title="Zählt in die Prognose zur Gesamtfrist"
      />

      {knoten.unbestaetigt && (
        <span title="Vorbelegung aus dem Auslieferungs-Plan — bitte prüfen">
          <Badge variant="warning">unbestätigt</Badge>
        </span>
      )}
    </span>
  );
}

/** Hoch/Runter/Anlegen/Löschen — rechtsbündig. */
function KnotenAktionen({ knoten, alle, onKnoten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  return (
    <span className="flex shrink-0 items-center gap-0.5" onClick={e => e.stopPropagation()}>
      <button
        type="button" aria-label="Nach oben" title="Nach oben"
        onClick={() => onKnoten(verschiebeKnoten(alle, knoten.id, 'hoch'))}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button" aria-label="Nach unten" title="Nach unten"
        onClick={() => onKnoten(verschiebeKnoten(alle, knoten.id, 'runter'))}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <ChevronDown size={13} />
      </button>
      <button
        type="button" aria-label="Unter-Meilenstein anlegen" title="Unter-Meilenstein anlegen"
        onClick={() => onKnoten(fuegeKnotenHinzu(alle, knoten.id))}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <Plus size={13} />
      </button>
      <button
        type="button" aria-label="Meilenstein löschen" title="Meilenstein und Unter-Meilensteine löschen"
        onClick={() => onKnoten(entferneKnoten(alle, knoten.id))}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
      >
        <Trash2 size={13} />
      </button>
    </span>
  );
}

/** Detail-Bereich unter dem ausgewählten Knoten. */
function KnotenKoerper({ knoten, alle, spalten, schreibgeschuetzt, onKnoten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  const patch = (p: Partial<MeilensteinKnoten>): void => onKnoten(aendereKnoten(alle, knoten.id, p));
  return (
    <div className="rounded" style={feldStil}>
        <div className="border-[var(--tf-border)] px-3 py-2 flex flex-col gap-2">
          <input
            value={knoten.beschreibung ?? ''}
            onChange={e => patch({ beschreibung: e.target.value })}
            disabled={schreibgeschuetzt}
            placeholder="Beschreibung (optional)"
            aria-label="Beschreibung"
            className="text-[12px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] disabled:opacity-60"
            style={feldStil}
          />

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Gilt für:</span>
            {ANTRAGSTYP_BUCKETS.map(t => (
              <ToggleChip
                key={t}
                label={TYP_LABEL[t]}
                selected={knoten.nurTypen.length === 0 || knoten.nurTypen.includes(t)}
                disabled={schreibgeschuetzt}
                onToggle={() => {
                  const aktuell = knoten.nurTypen.length === 0 ? [...ANTRAGSTYP_BUCKETS] : knoten.nurTypen;
                  const naechste = aktuell.includes(t) ? aktuell.filter(x => x !== t) : [...aktuell, t];
                  // Alle ausgewählt ⇒ wieder „gilt für alle" (leere Liste).
                  patch({ nurTypen: naechste.length === ANTRAGSTYP_BUCKETS.length ? [] : naechste });
                }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Erfüllt, wenn:</span>
            {schreibgeschuetzt ? (
              <p className="text-[12px] text-[var(--tf-text-tertiary)]">
                Nur Lesezugriff — die Bedingung kann hier nicht geändert werden.
              </p>
            ) : (
              <BedingungEditor
                bedingung={knoten.bedingung}
                spalten={spalten}
                onChange={b => patch({ bedingung: b })}
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
            Ist-Termin aus Feld
            <select
              value={knoten.istDatumFeld ?? ''}
              onChange={e => patch({ istDatumFeld: e.target.value || undefined })}
              disabled={schreibgeschuetzt}
              className="text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] max-w-[260px] cursor-pointer disabled:opacity-60"
              style={feldStil}
            >
              <option value="">— frühestes Datum der Bedingungs-Felder —</option>
              {spalten.filter(s => s.typ === 'datum').map(s => (
                <option key={s.feldId} value={s.feldId}>
                  {s.label === s.feldId ? s.feldId : `${s.label} · ${s.feldId}`}
                </option>
              ))}
            </select>
          </label>
        </div>
    </div>
  );
}

function Menue({ knoten, alle, onKnoten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  return (
    <>
      <ContextMenuLabel>{knoten.nummer || '—'} · Woche {knoten.sollWoche}</ContextMenuLabel>
      <ContextMenuItem onSelect={() => onKnoten(fuegeKnotenHinzu(alle, knoten.id))}>
        Unter-Meilenstein anlegen
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onKnoten(aendereKnoten(alle, knoten.id, { aktiv: !knoten.aktiv }))}>
        {knoten.aktiv ? 'Stilllegen' : 'Wieder aktivieren'}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="danger" onSelect={() => onKnoten(entferneKnoten(alle, knoten.id))}>
        Meilenstein und Unter-Meilensteine löschen
      </ContextMenuItem>
    </>
  );
}

export function KonfigurationTab({
  knoten, gesamtfristTage, spalten, schreibgeschuetzt, onKnoten, onGesamtfrist,
}: Props): React.ReactElement {
  const [offen, setOffen] = useState<string[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const { items, rootId } = useMemo(() => baueMeilensteinBaum(knoten), [knoten]);
  const unbestaetigt = knoten.filter(k => k.unbestaetigt).length;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          Gesamtfrist ab Antragseingang
          <input
            type="number" min={1}
            value={gesamtfristTage}
            onChange={e => onGesamtfrist(Math.max(1, Number(e.target.value) || 1))}
            disabled={schreibgeschuetzt}
            className="w-[72px] text-[12.5px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] text-right disabled:opacity-60"
            style={feldStil}
          />
          Tage
        </label>
        {!schreibgeschuetzt && (
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => onKnoten(fuegeKnotenHinzu(knoten, null))}>
            Meilenstein
          </Button>
        )}
        {unbestaetigt > 0 && (
          <span className="text-[12px] text-[var(--tf-warning-text)]">
            {unbestaetigt} {unbestaetigt === 1 ? 'Zuordnung wartet' : 'Zuordnungen warten'} auf Bestätigung
          </span>
        )}
      </div>

      {knoten.length === 0 ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
          Noch kein Meilenstein angelegt.
        </p>
      ) : (
        <TfTree<MeilensteinBaumKnoten>
          items={items}
          rootId={rootId}
          label="Meilenstein-Plan"
          features={{
            selection: true,
            dnd: !schreibgeschuetzt,
            reorder: !schreibgeschuetzt,
            dragHandle: true,
          }}
          expandedItems={offen}
          onExpandedChange={setOffen}
          selectedItems={gewaehlt}
          onSelectedChange={setGewaehlt}
          canDrag={ids => ids.every(i => i !== MEILENSTEIN_BAUM_ROOT)}
          canDrop={(quellen, ziel) => quellen.every(q =>
            darfUmhaengen(knoten, q, ziel === MEILENSTEIN_BAUM_ROOT ? null : ziel))}
          onDrop={(quellen, ziel, index) => {
            const elternId = ziel === MEILENSTEIN_BAUM_ROOT ? null : ziel;
            // Reihum anwenden: jeder Zug rechnet auf dem Ergebnis des
            // vorigen, sonst kollidierten die neu vergebenen Sortierungen.
            let naechste = knoten;
            quellen.forEach((q, i) => {
              naechste = haengeKnotenUm(naechste, q, elternId, index === undefined ? undefined : index + i);
            });
            onKnoten(naechste);
          }}
          slots={{
            leading: p => (p.dragHandleProps && !schreibgeschuetzt ? (
              <span
                {...p.dragHandleProps}
                className="shrink-0 cursor-grab text-[var(--tf-text-tertiary)] active:cursor-grabbing"
                title="Ziehen, um umzusortieren oder unterzuordnen"
              >
                <GripVertical size={13} />
              </span>
            ) : null),
            label: p => (p.data.art === 'meilenstein' ? (
              <KnotenKopf
                knoten={p.data.knoten}
                alle={knoten}
                schreibgeschuetzt={schreibgeschuetzt}
                onKnoten={onKnoten}
              />
            ) : null),
            trailing: p => (p.data.art === 'meilenstein' && !schreibgeschuetzt
              ? <KnotenAktionen knoten={p.data.knoten} alle={knoten} onKnoten={onKnoten} />
              : null),
            // Der Bedingungs-Editor gehört zum AUSGEWÄHLTEN Knoten — das
            // Chevron bleibt beim Auf-/Zuklappen der Unter-Meilensteine.
            body: p => (p.isSelected && p.data.art === 'meilenstein' ? (
              <KnotenKoerper
                knoten={p.data.knoten}
                alle={knoten}
                spalten={spalten}
                schreibgeschuetzt={schreibgeschuetzt}
                onKnoten={onKnoten}
              />
            ) : null),
            contextMenu: p => (p.data.art === 'meilenstein' && !schreibgeschuetzt ? (
              <Menue knoten={p.data.knoten} alle={knoten} onKnoten={onKnoten} />
            ) : null),
          }}
        />
      )}
    </div>
  );
}
