/**
 * Der Klartext-Streifen unter dem Fortschritts-Stepper (Nutzer-Sicht, v3.12).
 * Die Aussage selbst kommt aus der reinen `dauerAussage` — hier wird nur
 * gerendert.
 */
import { CircleCheck, Clock, Info, MessageCircleQuestion } from 'lucide-react';
import type { FeedbackItem } from '@/core/types/feedback';
import { dauerAussage, type DauerTon } from './dauerText';

const ICON: Record<DauerTon, typeof Clock> = {
  info: Clock,
  warnung: Clock,
  wartet: MessageCircleQuestion,
  fertig: CircleCheck,
  neutral: Info,
};

export function DauerStreifen({ t }: { t: FeedbackItem }): React.ReactElement {
  const a = dauerAussage(t);
  const Icon = ICON[a.ton];
  return (
    <div className={`fb-eta${a.ton === 'info' ? '' : ` ${a.ton}`}`} role="status">
      <Icon size={16} aria-hidden />
      <span>
        {a.betont && <><b>{a.betont}</b>{' '}</>}
        {a.text}
      </span>
    </div>
  );
}
