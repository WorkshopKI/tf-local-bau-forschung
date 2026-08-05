/**
 * Regeln-Tab — die **To-do-Kaskade** des Vorgangssystems.
 *
 * Geordnet: die erste zutreffende Regel gewinnt. Die Reihenfolge IST das
 * Ergebnis, deshalb wird sie über Pfeile gesetzt, nicht per Ziehen
 * ([TodoRegelnBereich](./TodoRegelnBereich.tsx)).
 *
 * Bis v2.384 stand hier ein zweites Regelwerk daneben: fünf handgeschriebene
 * „Nächste-Schritte-Regeln" der alten Ableitung, priorisiert statt kaskadiert.
 * Sie sind mit dem Rückbau entfallen — inhaltlich gehen alle fünf im
 * AB-Regelsatz auf, dort feiner geschnitten und mit zuständiger Rolle:
 *
 * | Alt-Regel | geht auf in |
 * |---|---|
 * | NF gestellt → Nachforderung bearbeiten | „NF erstellen" · „NF ergänzen" · „Erinnerung an NF" · „NL prüfen" |
 * | Gutachten fertig → Erstentscheidung vorbereiten | „GA schreiben" · „in QS" · „QS erfolgt" · „SV erstellen" |
 * | bewilligungsreif → Bewilligung vorbereiten | „ZuwB erstellen" |
 * | ablehnungsreif → Ablehnung vorbereiten | „Abl/RNE erstellen" · „Abl erstellt" · „Abl in QS" · „Abl ergänzen" |
 * | beantragt → Vollständigkeit prüfen | „PC offen" · „NF erstellen" |
 */
import { useCallback, useState } from 'react';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { REGELSATZ_DEFAULT, type Rolle } from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { TodoRegelnBereich } from './TodoRegelnBereich';
import { usePlatzhalterErhebung } from './usePlatzhalterErhebung';
import { useRegelWirkung } from './useRegelWirkung';
import { useRegelProbelauf } from './useRegelProbelauf';
import { exportiereErhebung } from './fbErhebungExport';

export function RegelnTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  // Die Hooks stehen VOR dem Early-Return: Hook-Reihenfolge ist an die
  // Aufrufreihenfolge gebunden, und `tsc` fängt einen Verstoß nicht (React #310).
  const platzhalter = usePlatzhalterErhebung(api.entwurf);
  // Der gewählte Regelsatz wohnt hier statt in `TodoRegelnBereich`, weil der
  // Wirkungs-Lauf ihn braucht: gemessen wird IMMER genau ein Satz (der gezeigte),
  // sonst stünden an einer FB-Regel Zahlen aus der AB-Kaskade.
  const [satz, setSatz] = useState<Rolle>(REGELSATZ_DEFAULT);
  const wirkung = useRegelWirkung(api.entwurf, satz);
  const probe = useRegelProbelauf(api.entwurf, satz);
  // Reiner Export, deshalb OHNE Schreibrecht-Gate: er nimmt nichts mit auf den
  // Share, er nimmt etwas mit in den Termin.
  const onExportieren = useCallback((rolle: Rolle) => {
    const e = platzhalter.erhebung;
    if (!e) return;
    exportiereErhebung(
      {
        stichtag: platzhalter.stichtag,
        bereichText: platzhalter.bereichText ?? 'unbekannt',
        rolle,
      },
      { platzhalter: e.platzhalter, flecken: e.flecken, karte: e.karte(rolle) },
    );
  }, [platzhalter.erhebung, platzhalter.stichtag, platzhalter.bereichText]);
  const entwurf = api.entwurf;
  if (!entwurf) return null;
  if (!isVorgangssystemEnabled()) {
    return (
      <p className="pt-3 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Die To-do-Kaskade gehört zum Vorgangssystem und ist in dieser Variante nicht aktiv.
      </p>
    );
  }
  // Flex-Spalten-Höhenkontext für das Master-Detail-Shell darunter: `flex-1
  // min-h-0` greift nur in einem `flex flex-col`-Elternteil, sonst verliert das
  // Split-Layout seine definite Höhe und die Panes scrollen nicht mehr selbst.
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TodoRegelnBereich
        version={entwurf} api={api} platzhalter={platzhalter} onExportieren={onExportieren}
        satz={satz} onSatzWechsel={setSatz} wirkung={wirkung} probe={probe}
      />
    </div>
  );
}
