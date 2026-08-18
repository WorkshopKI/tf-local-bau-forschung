/**
 * Die Belege der Antwort für die TABELLE erreichbar machen.
 *
 * Die Liste bekommt sie als Prop durchgereicht — sie hat sie ohnehin zur Hand.
 * Die Tabelle rendert ihre Zellen über `SearchColumn.render(row)`, eine
 * Signatur ohne Platz für zusätzliche Daten (sie liegt im geteilten
 * `SortableColumn`-Vertrag aller Tabellen der App). Genau dieselbe Lücke hat
 * die Suchwort-Markierung, und sie wird hier genauso geschlossen wie dort
 * ([SuchMarkierung.tsx](../SuchMarkierung.tsx)): über einen Kontext um die
 * Tabelle, statt die Signatur für alle Tabellen aufzubohren.
 *
 * Gemeldet mit Screenshot: die Marke „in der Antwort" und der KI-Satz standen
 * nur in der Liste. Wer in der Tabelle arbeitete, sah die Antwort oben und die
 * Treffer unten — wieder unverbunden, nur eine Ansicht weiter.
 *
 * Ohne Provider ist der Kontext leer und die Spalte bleibt still — kein
 * Sonderfall an den Aufrufstellen.
 */
import { createContext, useContext } from 'react';
import type { AntwortBeleg } from './genannteTreffer';

const LEER: ReadonlyMap<string, AntwortBeleg> = new Map();

const AntwortBelegKontext = createContext<ReadonlyMap<string, AntwortBeleg>>(LEER);

/**
 * Dieselben Belege für den `accessor` der Spalte — und NUR für ihn.
 *
 * Der `accessor` ist eine reine Funktion im geteilten `SortableColumn`-Vertrag;
 * er läuft außerhalb von React (Export, Zwischenablage, Sortierung) und kann
 * keinen Kontext lesen. Ohne diese Ablage trüge der Export eine leere Spalte,
 * während am Bildschirm der Satz steht.
 *
 * Gesetzt wird beim Rendern des Providers, nicht in einem Effekt: der Export
 * liest lange nach dem Rendern, und ein Effekt hinge dem Bildschirm um einen
 * Durchlauf hinterher. Geschrieben wird nur DIESELBE Map, die auch der Kontext
 * trägt — es gibt keinen zweiten Stand, der auseinanderlaufen könnte.
 */
let belegeFuerAccessor: ReadonlyMap<string, AntwortBeleg> = LEER;

export function AntwortBelegProvider({ belege, children }: {
  belege: ReadonlyMap<string, AntwortBeleg>;
  children: React.ReactNode;
}): React.ReactElement {
  belegeFuerAccessor = belege;
  return (
    <AntwortBelegKontext.Provider value={belege}>
      {children}
    </AntwortBelegKontext.Provider>
  );
}

/** Der volle Satz zu einem Kennzeichen — für `accessor`/Export. Leer, wenn die
 *  Antwort das Vorhaben nicht genannt hat. */
export function antwortSatzFuer(fkz: string | undefined): string {
  return (fkz === undefined ? undefined : belegeFuerAccessor.get(fkz))?.satz ?? '';
}

/** Was die Antwort über dieses Kennzeichen sagt — `undefined`, wenn sie es
 *  nicht genannt hat. */
export function useAntwortBeleg(fkz: string | undefined): AntwortBeleg | undefined {
  const belege = useContext(AntwortBelegKontext);
  return fkz === undefined ? undefined : belege.get(fkz);
}
