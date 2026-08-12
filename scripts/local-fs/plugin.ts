/**
 * Vite-Plugin der Variante „local": mountet die Dateisystem-Brücke im Dev-Server.
 *
 * `apply: 'serve'` ist Absicht und Sicherheitsgrenze zugleich — das Plugin
 * existiert in keinem Build. Zusammen mit `__TEAMFLOW_LOCAL_FS__` (haengt an
 * `command === 'serve'`) und dem `validateConfig`-Abbruch bei
 * `local` + `variant: "production"` sind das drei unabhängige Schichten.
 */

import type { Plugin } from 'vite';
import { baueSlotTabelle } from './pfad-guard';
import { bearbeite } from './handler';
import {
  SLOT_DATEN_SHARE,
  SLOT_PERSOENLICH,
  SLOT_USER_FOLDERS_ROOT,
  SLOT_CSV_SOURCE_DIR,
  SLOT_VORLAGEN,
  dmsSlot,
  userFoldersRootSlot,
} from '../../src/core/services/infrastructure/local-fs/typen';

/** Der `local`-Block aus der Variant-Config (siehe TeamflowLocalConfig). */
export interface LocalBlock {
  datenShare?: string | null;
  persoenlich?: string | null;
  userFoldersRoot?: string | null;
  /** v4.1: Wurzeln der persoenlichen Ordner je Gruppe (`rootId → Pfad`). */
  userFoldersRoots?: Record<string, string>;
  csvSourceDir?: string | null;
  vorlagenDir?: string | null;
  dmsSources?: Record<string, string>;
  profil?: { name: string; kuerzel?: string; isKurator?: boolean };
}

/**
 * Übersetzt den Config-Block in die Slot-Tabelle.
 *
 * Die Slot-NAMEN sind der Vertrag zwischen Client und Server — sie stehen
 * einmal in `typen.ts` und werden hier und im Adapter von dort gelesen.
 */
function sammleSlots(local: LocalBlock): Record<string, string> {
  const slots: Record<string, string> = {};
  const setze = (name: string, pfad: string | null | undefined): void => {
    if (typeof pfad === 'string' && pfad.trim()) slots[name] = pfad;
  };
  setze(SLOT_DATEN_SHARE, local.datenShare);
  setze(SLOT_PERSOENLICH, local.persoenlich);
  setze(SLOT_USER_FOLDERS_ROOT, local.userFoldersRoot);
  for (const [id, pfad] of Object.entries(local.userFoldersRoots ?? {})) {
    setze(userFoldersRootSlot(id), pfad);
  }
  setze(SLOT_CSV_SOURCE_DIR, local.csvSourceDir);
  setze(SLOT_VORLAGEN, local.vorlagenDir);
  for (const [id, pfad] of Object.entries(local.dmsSources ?? {})) setze(dmsSlot(id), pfad);
  return slots;
}

export function localFsPlugin(local: LocalBlock): Plugin {
  return {
    name: 'teamflow-local-fs',
    apply: 'serve',
    configureServer(server) {
      const slots = baueSlotTabelle(sammleSlots(local));

      const namen = [...slots.wurzeln.keys()];
      server.config.logger.info(
        `  \x1b[32m➜\x1b[0m  \x1b[1mlocal-fs\x1b[0m: ${namen.length} Ordner verdrahtet (${namen.join(', ')})`,
      );
      if (slots.fehlend.length > 0) {
        server.config.logger.warn(
          `  ⚠  local-fs: Ordner fehlen und bleiben unverbunden: ${slots.fehlend.join(', ')}`,
        );
      }

      // Vor Vites eigenen Middlewares einhängen, damit `/__tf-local-fs/*` nicht
      // vom SPA-Fallback verschluckt wird.
      server.middlewares.use((req, res, next) => {
        const port = server.config.server.port ?? 5173;
        void bearbeite(req, res, slots, `http://localhost:${port}`).then(bearbeitet => {
          if (!bearbeitet) next();
        }).catch(next);
      });
    },
  };
}
