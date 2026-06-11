/**
 * Statische Feld-Mapping-Tabelle Vorlagen-Code → TeamFlow-Wert. Bewusst als
 * eigene Datei (skill-unabhängig, später ggf. kurator-konfigurierbar).
 *
 * Unbekannte Codes liefern `null` — der Füller lässt den Platzhalter dann
 * unverändert und meldet ihn als „nicht befüllbar".
 */
import type { Antrag } from '@/core/services/csv/types';

type FieldResolver = (antrag: Antrag) => string;

export const FIELD_MAPPING: Readonly<Record<string, FieldResolver>> = {
  'VMS VB Projekt': a => a.titel ?? '',
  'VMS AD FKZ': a => a.aktenzeichen,
  'ADA.FD.Langname': a => a.antragsteller ?? '',
};

/** Löst einen Vorlagen-Code auf; null = kein Mapping (Platzhalter bleibt stehen). */
export function resolveField(code: string, antrag: Antrag): string | null {
  const resolver = FIELD_MAPPING[code];
  return resolver ? resolver(antrag) : null;
}
