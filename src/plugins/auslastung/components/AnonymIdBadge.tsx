/** Anzeige fuer MA-Identitaeten. Monospace, dezent.
 *
 *  v2.18: Ist ein echtes Kuerzel (`realName`) bekannt, zeigt der Badge NUR das
 *  echte TIB-Kuerzel (z.B. "PG") — das anonyme "MAxx" ist im passwortgeschuetzten
 *  PL-Build redundant. Die anonyme ID bleibt als Hover-`title` erhalten. Fehlt
 *  das Kuerzel (Feature deaktiviert), faellt der Badge auf die anonyme ID zurueck.
 *  Konsumenten lesen das Kuerzel ueber `useDeAnonName(anonId)` / `useDeAnonResolver`.
 */
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { isDeAnonymisierungEnabled } from '@/config/feature-flags';

interface Props {
  anonId: string;
  size?: 'sm' | 'md' | 'lg';
  /** Wenn gesetzt: der Badge zeigt NUR dieses echte Kuerzel (die anonyme ID
   *  wandert in den Hover-`title`). Wenn `undefined`/`null`, zeigt der Badge die
   *  anonyme ID. Konsumenten sollten `useDeAnonName(anonId)` nutzen, statt das
   *  Mapping selbst zu loesen — der Hook respektiert das Feature-Flag. */
  realName?: string | null;
}

export function AnonymIdBadge({ anonId, size = 'md', realName }: Props): React.ReactElement {
  const fontSize =
    size === 'lg' ? 'text-[18px]'
    : size === 'sm' ? 'text-[11px]'
    : 'text-[13px]';
  const padding =
    size === 'lg' ? 'px-3 py-1'
    : size === 'sm' ? 'px-1.5 py-0.5'
    : 'px-2 py-0.5';
  return (
    <span
      title={realName ? anonId : undefined}
      className={`inline-flex items-center font-mono font-medium tracking-wide ${fontSize} ${padding} rounded-md`}
      style={{
        background: 'var(--tf-bg-secondary)',
        color: 'var(--tf-text)',
      }}
    >
      {realName ?? anonId}
    </span>
  );
}

/**
 * Looked-up Klartext-Kuerzel fuer einen anonId, ODER null wenn:
 *  - das Feature in der aktuellen Variante deaktiviert ist (`deAnonymisierung`)
 *  - das Mapping kein echtes Kuerzel hat (anonId unbekannt)
 *
 * Seit v2.17 ohne De-Anon-Passwort/Session: der PL-Build ist beim App-Start
 * per Rollen-Passwort gated ([AppPasswordGate]) — echte Kuerzel werden in
 * pl/dev (`deAnonymisierung: true`) direkt angezeigt. Konsumenten reichen den
 * Wert direkt als `realName`-Prop in den Badge.
 */
export function useDeAnonName(anonId: string): string | null {
  const enabled = isDeAnonymisierungEnabled();
  const cache = useAntraegeCache();
  if (!enabled) return null;
  return cache.anonymMap.toReal.get(anonId) ?? null;
}

/**
 * Resolver-Variante fuer Loop-Konsumenten (z.B. Mitarbeiter-Tabelle mit
 * map()). Hook wird einmal aufgerufen, gibt eine pure Funktion zurueck,
 * die pro anonId das Kuerzel liefert (oder null). Respektiert das
 * `deAnonymisierung`-Feature-Flag wie `useDeAnonName`.
 */
export function useDeAnonResolver(): (anonId: string) => string | null {
  const enabled = isDeAnonymisierungEnabled();
  const cache = useAntraegeCache();
  return (anonId: string): string | null => {
    if (!enabled) return null;
    return cache.anonymMap.toReal.get(anonId) ?? null;
  };
}
