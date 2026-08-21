// Eigener Feedback-Verlauf — gefiltert über die tolerante Identität
// (Kürzel ODER Profilname, siehe feedbackIdentitaet).
//
// Seit v5.2 nicht mehr nur eine Anzeige: jede Karte kann ihr Ticket an Ort und
// Stelle **ergänzen**. Vorher war der einzige Ausgang der id-lose Sprung aufs
// Board — man musste sein eigenes Ticket dort erneut suchen und dann das volle
// Detail-Panel öffnen, um einen Satz nachzutragen.

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, MessageSquarePlus } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeineFeedbackIdentitaet } from '@/core/hooks/useMeineFeedbackIdentitaet';
import { addComment, getMyFeedback, FEEDBACK_STATUS } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from './constants';
import { formatShortDate, getLucideIcon } from './feedbackUi';
import { bausteineFuer } from './beitragBausteine';
import { FeedbackBeitragFeld } from './FeedbackBeitragFeld';

export function MyFeedbackList(): React.ReactElement {
  const storage = useStorage();
  const ich = useMeineFeedbackIdentitaet();
  const { profile } = useProfile();
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  // Höchstens ein offenes Feld: zwei halb getippte Entwürfe untereinander wären
  // in einem 470 px breiten Fenster nicht mehr auseinanderzuhalten.
  const [offeneId, setOffeneId] = useState<string | null>(null);

  const load = useCallback((): void => {
    void getMyFeedback(storage, ich).then(setItems);
  }, [storage, ich]);

  useEffect(() => { load(); }, [load]);

  // Live-Refresh bei feedback-updated Event (Submit im Panel, Admin-Updates)
  useEffect(() => {
    const handler = (): void => load();
    window.addEventListener('feedback-updated', handler);
    return () => window.removeEventListener('feedback-updated', handler);
  }, [load]);

  if (items === null) {
    return <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lade…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-6">
        Du hast noch kein Feedback abgesendet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <MeinTicketKarte
          key={item.id}
          item={item}
          schreibId={ich.schreibId}
          meinName={profile?.name}
          storage={storage}
          offen={offeneId === item.id}
          setOffen={auf => setOffeneId(auf ? item.id : null)}
        />
      ))}
    </div>
  );
}

function MeinTicketKarte({ item, schreibId, meinName, storage, offen, setOffen }: {
  item: FeedbackItem;
  schreibId: string | undefined;
  meinName: string | undefined;
  storage: ReturnType<typeof useStorage>;
  offen: boolean;
  setOffen: (auf: boolean) => void;
}): React.ReactElement {
  const [meldung, setMeldung] = useState<{ text: string; ton: 'fehler' | 'warnung' | 'ok' } | null>(null);
  const Icon = getLucideIcon(item.category ? CATEGORY_ICONS[item.category] : 'MessageCircle');
  const summary = item.llm_summary || item.text || '–';
  const beitraege = item.comments?.length ?? 0;

  // `addComment` liefert `ok:false`, statt zu werfen — das muss der Aufrufer
  // auswerten (Pitfall #15 deckt nur geworfene Fehler ab). Ein Toast-System hat
  // das Erfassungs-Panel nicht, die Meldung steht deshalb unter dem Feld. Bei
  // einem Fehler bleibt der Entwurf stehen: er ist die einzige Kopie.
  const senden = async (text: string): Promise<boolean> => {
    if (!schreibId) {
      setMeldung({ text: 'Ohne Namen im Profil lässt sich keine Ergänzung zuordnen.', ton: 'fehler' });
      return false;
    }
    const res = await addComment(storage, item.id, schreibId, text, meinName, 'ergaenzung');
    if (!res.ok) {
      setMeldung({
        text: res.error === 'share_unreadable'
          ? 'Die geteilte Feedback-Datei ist gerade nicht lesbar. Bitte gleich noch einmal senden.'
          : 'Die Ergänzung konnte nicht gespeichert werden.',
        ton: 'fehler',
      });
      return false;
    }
    setOffen(false);
    setMeldung(res.warning === 'no_personal_folder'
      ? {
        text: 'Ergänzung lokal gespeichert — ohne verbundenen persönlichen Ordner erreicht sie das Team noch nicht.',
        ton: 'warnung',
      }
      : { text: 'Ergänzung angehängt.', ton: 'ok' });
    return true;
  };

  return (
    <div className="p-2.5 rounded-[var(--tf-radius)]" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-start gap-2">
        <Icon size={14} className="mt-0.5 text-[var(--tf-text-secondary)]" />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-[var(--tf-text)] leading-snug line-clamp-2">{summary}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
              {item.category ? CATEGORY_LABELS[item.category] : 'Unklassifiziert'} · {formatShortDate(item.created_at)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[item.kurator_status]}`}>
              {STATUS_LABELS[item.kurator_status]}
            </span>
            {/* Ohne diese Zahl wäre nach dem Absenden nicht zu sehen, dass die
                Ergänzung angekommen ist. */}
            {beitraege > 0 && (
              <span
                className="flex items-center gap-1 text-[10.5px] text-[var(--tf-text-tertiary)]"
                title={`${beitraege} ${beitraege === 1 ? 'Beitrag' : 'Beiträge'} im Verlauf`}
              >
                <MessageSquare size={11} aria-hidden />{beitraege}
              </span>
            )}
            <button
              type="button"
              className="ml-auto flex items-center gap-1 text-[10.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
              onClick={() => { setOffen(!offen); setMeldung(null); }}
            >
              <MessageSquarePlus size={12} aria-hidden />
              {offen ? 'Abbrechen' : 'Ergänzen'}
            </button>
          </div>
          {item.kurator_status === FEEDBACK_STATUS.abgelehnt && item.kurator_notes && (
            <p className="mt-1 text-[10.5px] text-[var(--tf-text-tertiary)] italic">
              Hinweis: {item.kurator_notes}
            </p>
          )}
          {item.kurator_response?.trim() && (
            <div
              className="mt-1.5 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-info-bg)]"
              style={{ borderLeft: '2px solid var(--tf-info-text)' }}
            >
              <p className="text-[9.5px] uppercase tracking-[0.06em] font-medium text-[var(--tf-info-text)] mb-0.5">
                Antwort vom Team
              </p>
              <p className="text-[11px] text-[var(--tf-text)] whitespace-pre-wrap leading-snug">
                {item.kurator_response.trim()}
              </p>
            </div>
          )}
          {offen && (
            <div className="mt-2">
              <FeedbackBeitragFeld
                bausteine={bausteineFuer(false, true)}
                platzhalter="Was möchtest du ergänzen?"
                primaerArt="ergaenzung"
                primaerLabel="Ergänzung anhängen"
                hinweis="Geht an das Entwicklerteam."
                autofokus
                senden={senden}
              />
            </div>
          )}
          {meldung && <p className={`fb-kmt-meldung ${meldung.ton}`}>{meldung.text}</p>}
        </div>
      </div>
    </div>
  );
}
