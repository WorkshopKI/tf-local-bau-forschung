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
 * Das Schreibfeld selbst ist seit v5.2 das geteilte `FeedbackBeitragFeld` —
 * dieselbe Textarea steht am `⋯`-Menü, an der Karte und im Erfassungs-Panel.
 * Hier bleibt, was diesen Ort ausmacht: die Liste, das Avatar und die Frage,
 * welcher Zusatzknopf gilt.
 *
 * Der Thread selbst bleibt bestehen; er wird an anderer Stelle weiter benutzt.
 */
import { FeedbackAvatar } from '@/components/feedback/FeedbackAvatar';
import {
  FeedbackBeitragFeld,
  type BeitragZusatzAktion,
} from '@/components/feedback/FeedbackBeitragFeld';
import { FeedbackCommentList } from '@/components/feedback/FeedbackCommentList';
import { waehleKommentarVorschau } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import { bausteineFuer } from './bausteine';
import type { TicketKontext } from './typen';

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
  const kommentare = t.comments ?? [];

  const dev = ctx.darfSchreiben;
  const meins = ctx.istMeins(t);
  const darfSchreiben = !!ctx.meineId;

  // „Als Ergänzung" gehört dem eigenen Ticket — unabhängig von der Rolle
  // (v5.2): wer verwalten darf, bleibt am eigenen Ticket trotzdem der Autor.
  // An fremden Tickets bietet das Team stattdessen die Rückfrage an.
  const zusatz: BeitragZusatzAktion | undefined = meins
    ? { label: 'Als Ergänzung', art: 'ergaenzung', titel: 'Als Ergänzung zum ursprünglichen Text kennzeichnen.' }
    : dev
      ? {
        label: 'Als Rückfrage senden',
        art: 'rueckfrage',
        titel: 'Setzt zugleich den Status auf „Rückfrage“ — das Ticket wartet dann auf den Ersteller.',
      }
      : undefined;

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
          {/* Das Feld ist je Ticket gekeyt: beim Wechsel bekommt es einen
              frischen Entwurf, statt den fremden mitzunehmen. */}
          <FeedbackBeitragFeld
            key={t.id}
            bausteine={bausteineFuer(dev, meins)}
            platzhalter={dev ? 'Umsetzungsdetails für den Ersteller …' : 'Antwort oder Ergänzung …'}
            hinweis={dev ? 'Der Ersteller wird benachrichtigt.' : 'Geht an das Entwicklerteam.'}
            vorspann={<FeedbackAvatar name={meName || ctx.meineId || '?'} size={22} />}
            zusatzAktion={zusatz}
            fokusSignal={fokusSignal}
            senden={(text, art) => ctx.kommentiere(t, text, art)}
          />
        </div>
      ) : (
        <p className="fb-verlauf-leer">Zum Kommentieren im Profil anmelden.</p>
      )}
    </div>
  );
}
