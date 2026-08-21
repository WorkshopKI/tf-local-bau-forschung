/**
 * Der Schreibteil des `⋯`-Menüs: Kopfzeile + das geteilte
 * [FeedbackBeitragFeld](../../../components/feedback/FeedbackBeitragFeld.tsx),
 * gebunden an `ctx.kommentiere`.
 *
 * Die Art kommt vom Menüeintrag herein, der ihn geöffnet hat (v5.2) — Kopfzeile,
 * Platzhalter und Primärknopf richten sich danach. Vorher hieß der Primärknopf
 * immer „Senden" und schrieb immer einen gewöhnlichen Kommentar; die Absicht
 * stand nur im Label des Menüeintrags und ging auf dem Weg verloren.
 */
import {
  FeedbackBeitragFeld,
  type BeitragZusatzAktion,
} from '@/components/feedback/FeedbackBeitragFeld';
import { feedbackNummer } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import { bausteineFuer } from './bausteine';
import type { KommentarArt, TicketKontext } from './typen';

const PLATZHALTER: Record<KommentarArt, string> = {
  ergaenzung: 'Was möchtest du ergänzen?',
  rueckfrage: 'Was brauchst du vom Ersteller?',
  kommentar: 'Dein Kommentar …',
};

const PRIMAER: Record<KommentarArt, string> = {
  ergaenzung: 'Ergänzung anhängen',
  rueckfrage: 'Als Rückfrage',
  kommentar: 'Senden',
};

export function SchnellKommentar({ t, ctx, art, zurueck, fertig }: {
  t: FeedbackItem;
  ctx: TicketKontext;
  art: KommentarArt;
  zurueck: () => void;
  fertig: () => void;
}): React.ReactElement {
  const dev = ctx.darfSchreiben;
  const meins = ctx.istMeins(t);

  // Der zweite Knopf gilt nur im offenen Kommentar-Modus: wer beim Schreiben
  // merkt, dass es eine Ergänzung bzw. eine Rückfrage ist, soll nicht zurück
  // ins Menü müssen. Ergänzung und Rückfrage haben ihren eigenen Einstieg.
  let zusatz: BeitragZusatzAktion | undefined;
  if (art === 'kommentar' && meins) {
    zusatz = { label: 'Als Ergänzung', art: 'ergaenzung', titel: 'Als Ergänzung zum ursprünglichen Text kennzeichnen.' };
  } else if (art === 'kommentar' && dev) {
    zusatz = {
      label: 'Als Rückfrage',
      art: 'rueckfrage',
      titel: 'Setzt zugleich den Status auf „Rückfrage“ — das Ticket wartet dann auf den Ersteller.',
    };
  }

  const kopf = art === 'ergaenzung'
    ? 'Ergänzung'
    : art === 'rueckfrage'
      ? 'Rückfrage an den Ersteller'
      : (dev ? 'Kommentar an den Ersteller' : 'Kommentar');

  return (
    <div>
      <div className="fb-pop-lbl" style={{ padding: '0 0 6px' }}>
        {kopf} · #{feedbackNummer(t)}
      </div>
      <FeedbackBeitragFeld
        bausteine={bausteineFuer(dev, meins)}
        platzhalter={PLATZHALTER[art]}
        primaerArt={art}
        primaerLabel={PRIMAER[art]}
        zusatzAktion={zusatz}
        autofokus
        aufEscape={zurueck}
        // Das Popover schließt erst, wenn wirklich geschrieben wurde — sonst
        // wäre der Text mit dem Popover verschwunden und die Fehlermeldung im
        // Toast hätte niemandem geholfen.
        senden={async (text, gewaehlteArt) => {
          const ok = await ctx.kommentiere(t, text, gewaehlteArt);
          if (ok) fertig();
          return ok;
        }}
      />
    </div>
  );
}
