// Verwaltungs-Dialog des Feedback-Boards (v2.364) — löst den Menüpunkt
// Kuration → Feedback ab.
//
// Die Ticket-Arbeit (Status, Antwort, Löschen) passiert direkt am Ticket im
// Board-Detail (FeedbackVerwaltungBlock). Hier bleiben die vier Aufgaben, die
// NICHT an einem einzelnen Ticket hängen — unverändert aus dem früheren
// Kurator-Dashboard übernommen:
//
//   Inbox        — persönliche Outboxen der read-only-Nutzer einsammeln
//                  (einmaliger User-Wurzel-Connect braucht eine FSAPI-Geste)
//   FAQ          — FAQ-Einträge pflegen
//   Sponsoring   — Ranking + Schwellen + Budget
//   Einstellungen— Modell, System-Prompt, Shared-File-Status
//
// Kanonischer Modal-Pfad ist der Dialog aus @/components/ui/dialog (Höhen-Cap +
// interner Scroll eingebaut, Guard `no-raw-modal`).

import { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { FeedbackInboxTab } from './FeedbackInboxTab';
import { FeedbackFaqTab } from './FeedbackFaqTab';
import { FeedbackSponsoringOverview } from './FeedbackSponsoringOverview';
import { FeedbackConfigPanel } from './FeedbackConfigPanel';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Alle Tickets (inkl. archivierter) — Quelle für FAQ-Liste + Sponsoring-Ranking. */
  tickets: FeedbackItem[];
  config: FeedbackConfig;
  /** Nach Änderungen in einem Tab — Aufrufer lädt neu. */
  onChanged: () => void;
}

export function FeedbackVerwaltungDialog({ open, onClose, tickets, config, onChanged }: Props): React.ReactElement {
  const [tab, setTab] = useState('inbox');
  const faqs = useMemo(() => tickets.filter(t => t.is_faq), [tickets]);

  const tabs = useMemo(() => [
    { id: 'inbox', label: 'Inbox' },
    { id: 'faq', label: 'FAQ', badge: faqs.length },
    { id: 'sponsoring', label: 'Sponsoring' },
    { id: 'config', label: 'Einstellungen' },
  ], [faqs.length]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Feedback-Verwaltung"
      description={`${tickets.length} ${tickets.length === 1 ? 'Ticket' : 'Tickets'} · ${faqs.length} FAQ`}
      size="xl"
      align="top"
      // Lange Formulare (Schwellen, System-Prompt) — ein Klick daneben darf sie
      // nicht wegwerfen. Escape + Schließen-Knopf bleiben wirksam.
      dismissOnOverlayClick={false}
    >
      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />
      <div className="mt-4 pb-2">
        {tab === 'inbox' && <FeedbackInboxTab />}
        {tab === 'faq' && <FeedbackFaqTab faqs={faqs} onChanged={onChanged} />}
        {tab === 'sponsoring' && (
          <FeedbackSponsoringOverview tickets={tickets} config={config} onConfigChanged={onChanged} />
        )}
        {tab === 'config' && <FeedbackConfigPanel />}
      </div>
    </Dialog>
  );
}
