/**
 * Hüllt einen Abschnitt, der nur mit Beta-Funktionen oder Expertenmodus
 * erscheinen soll.
 *
 * ```tsx
 * <WennSichtbar id={abschnittId('antraege', 'detail-gutachten')}>
 *   <GutachtenCard … />
 * </WennSichtbar>
 * ```
 *
 * Bewusst eine Hülle und kein `if` an jeder Aufrufstelle: die Id steht damit
 * genau einmal je Abschnitt im Baum, der Guard `sichtbarkeit-ids-existieren`
 * findet sie, und ein verborgener Abschnitt rendert seine Kinder gar nicht erst
 * (keine Arbeit für etwas, das niemand sieht).
 */
import { useSichtbar } from '@/core/hooks/useSichtbar';

interface Props {
  /** Katalog-Id, gebaut über `abschnittId()` / `widgetId()` — nie von Hand getippt. */
  id: string;
  children: React.ReactNode;
}

export function WennSichtbar({ id, children }: Props): React.ReactElement | null {
  const sichtbar = useSichtbar();
  if (!sichtbar(id)) return null;
  return <>{children}</>;
}
