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
import { useCallback } from 'react';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import type { Rolle } from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { TodoRegelnBereich } from './TodoRegelnBereich';
import { usePlatzhalterErhebung } from './usePlatzhalterErhebung';
import { exportiereErhebung } from './fbErhebungExport';

export function RegelnTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  // Die Hooks stehen VOR dem Early-Return: Hook-Reihenfolge ist an die
  // Aufrufreihenfolge gebunden, und `tsc` fängt einen Verstoß nicht (React #310).
  const platzhalter = usePlatzhalterErhebung(api.entwurf);
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
  return (
    <div className="flex flex-col gap-4 pt-3">
      <TodoRegelnBereich
        version={entwurf} api={api} platzhalter={platzhalter} onExportieren={onExportieren}
      />
    </div>
  );
}
