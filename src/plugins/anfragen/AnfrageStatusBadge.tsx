/** Farbiger Status-Badge einer Anfrage — geteilt von Liste/Tabelle/Karten/Detail
 *  (Fortschritt-Semantik, Quelle: `statusVariant` in `status.ts`). */
import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, statusVariant } from './status';
import type { AnfrageStatus } from './types';

export function AnfrageStatusBadge({ status }: { status: AnfrageStatus }): React.ReactElement {
  return <Badge variant={statusVariant(status)}>{STATUS_LABEL[status]}</Badge>;
}
