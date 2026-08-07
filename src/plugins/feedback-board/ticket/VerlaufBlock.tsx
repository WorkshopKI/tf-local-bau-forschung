/**
 * „Verlauf" im Detail-Panel (v3.19, Handoff feedback-redesign) — löst den
 * geteilten `FeedbackCommentThread` an DIESER Stelle ab.
 *
 * Warum ein eigener Baustein statt des vorhandenen Threads: der Thread ist die
 * Kommentar-Ansicht von v2.199 („Kommentare (3)" + Feld + Papierflieger). Er
 * kennt die drei Beitragsarten des Ticketsystems nicht — und genau die sind
 * hier der Punkt:
 *
 * - Der Entwickler schickt eine **Rückfrage**: Beitrag UND Statuswechsel in
 *   einem Zug, sonst wartet der Ersteller auf etwas, das er nie sieht.
 * - Der Ersteller hängt eine **Ergänzung** an, wenn sein Text schon in Arbeit
 *   ist und nicht mehr geändert werden soll.
 * - Alles andere ist ein gewöhnlicher **Kommentar**.
 *
 * Die Textbausteine sind dieselben wie im Schnell-Kommentar des `⋯`-Menüs
 * (bausteine.ts) — zwei Wege, ein Wortlaut.
 *
 * Der Thread selbst bleibt bestehen; er wird an anderer Stelle weiter benutzt.
 */
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { FeedbackAvatar } from '@/components/feedback/FeedbackAvatar';
import { FeedbackCommentList } from '@/components/feedback/FeedbackCommentList';
import { waehleKommentarVorschau } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import { bausteineFuer } from './bausteine';
import type { KommentarArt, TicketKontext } from './typen';

interface Props {
  t: FeedbackItem;
  ctx: TicketKontext;
  /** Eigener Anzeigename — nur für das Avatar neben dem Eingabefeld. */
  meName?: string;
  /** Beim Öffnen eingefrorene Zahl neuer Kommentare → die letzten N hervorgehoben. */
  neueKommentare?: number;
  /**
   * Zähler statt Ref: jede Erhöhung fokussiert das Feld. So können die Knöpfe
   * der Aktionsleiste („Kommentar", „Ergänzung hinzufügen") hierher zeigen,
   * ohne dass das Panel eine imperative Handle durchreichen muss.
   */
  fokusSignal?: number;
}

export function VerlaufBlock({ t, ctx, meName, neueKommentare = 0, fokusSignal = 0 }: Props): React.ReactElement {
  const [text, setText] = useState('');
  const feld = useRef<HTMLTextAreaElement>(null);
  const kommentare = t.comments ?? [];

  const dev = ctx.darfVerwalten && ctx.rolle === 'entwickler';
  const meins = ctx.istMeins(t);
  const bausteine = bausteineFuer(dev);
  const leer = !text.trim();
  const darfSchreiben = !!ctx.meineId;

  // Beim Ticket-Wechsel den Entwurf verwerfen: das Panel ist je Ticket gekeyt,
  // dieser Effekt ist die Absicherung für den Fall, dass sich das einmal ändert.
  useEffect(() => { setText(''); }, [t.id]);

  useEffect(() => {
    if (fokusSignal === 0) return;
    const el = feld.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus();
  }, [fokusSignal]);

  // Geleert wird NUR nach bestätigtem Schreiben — der Entwurf ist die einzige
  // Kopie, und `kommentiere` meldet einen Share-Fehler über den Toast zurück.
  const senden = useAsyncAction(async (art: KommentarArt) => {
    if (leer) return;
    if (await ctx.kommentiere(t, text, art)) setText('');
  });

  const setzeBaustein = (vorlage: string): void => {
    setText(vorlage);
    feld.current?.focus();
  };

  return (
    <div className="fb-d-block">
      <div className="fb-d-label">
        Verlauf
        {kommentare.length > 0 && <span className="fb-d-zahl">· {kommentare.length}</span>}
      </div>

      {kommentare.length === 0 ? (
        <p className="fb-verlauf-leer">
          {meins ? 'Noch keine Antwort vom Team.' : 'Noch keine Beiträge.'}
        </p>
      ) : (
        // Dieselbe Auswahl-Funktion wie der Hover, nur ohne Grenzen: der Verlauf
        // zeigt alles und kürzt nichts.
        <FeedbackCommentList
          {...waehleKommentarVorschau(kommentare, {
            maxEintraege: Infinity,
            maxZeichen: Infinity,
            neuAnzahl: neueKommentare,
          })}
          variante="thread"
        />
      )}

      {darfSchreiben ? (
        <div className="fb-compose">
          <div className="fb-bausteine">
            {bausteine.map(([label, vorlage]) => (
              <button key={label} type="button" onClick={() => setzeBaustein(vorlage)}>
                {label}
              </button>
            ))}
          </div>
          <div className="fb-compose-feld">
            <FeedbackAvatar name={meName || ctx.meineId || '?'} size={22} />
            <textarea
              ref={feld}
              className="fb-kmt-feld"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={dev ? 'Umsetzungsdetails für den Ersteller …' : 'Antwort oder Ergänzung …'}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void senden.run('kommentar');
                }
              }}
            />
          </div>
          <div className="fb-kmt-zeile">
            <span className="fb-kmt-hinweis">
              {dev ? 'Der Ersteller wird benachrichtigt.' : 'Geht an das Entwicklerteam.'} · Strg+↵ sendet
            </span>
            {dev && (
              <Button
                size="sm"
                variant="secondary"
                disabled={leer || senden.busy}
                title="Setzt zugleich den Status auf „Rückfrage“ — das Ticket wartet dann auf den Ersteller."
                onClick={() => senden.run('rueckfrage')}
              >
                Als Rückfrage senden
              </Button>
            )}
            {!dev && meins && (
              <Button
                size="sm"
                variant="secondary"
                disabled={leer || senden.busy}
                title="Als Ergänzung zum ursprünglichen Text kennzeichnen."
                onClick={() => senden.run('ergaenzung')}
              >
                Als Ergänzung
              </Button>
            )}
            <Button size="sm" disabled={leer || senden.busy} onClick={() => senden.run('kommentar')}>
              <Send size={13} aria-hidden /> Senden
            </Button>
          </div>
        </div>
      ) : (
        <p className="fb-verlauf-leer">Zum Kommentieren im Profil anmelden.</p>
      )}
    </div>
  );
}
