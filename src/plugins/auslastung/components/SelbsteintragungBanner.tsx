/**
 * SelbsteintragungBanner — zeigt "X neue Antraege in deinen Kategorien"
 * oben auf der Homepage.
 *
 * Workflow-Revision 1.17. Nicht-blockierend, aber auffaellig (Border-Akzent).
 * Klick auf [→] dismissed den Banner UND scrollt zur "Neue Antraege fuer
 * dich"-Sektion. Wenn die Sektion noch nicht im DOM ist (Render-Order),
 * wird einfach nur dismissed.
 */
import { useProfile } from '@/core/hooks/useProfile';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useBenachrichtigung } from '../hooks/useBenachrichtigung';
import { useKuerzelMap } from '../hooks/useKuerzelMap';
import { resolveAnonIdForUser } from '../services/anonym-map';

/** Anchor-Selektor: `data-tour="neue-antraege-fuer-dich"` haengen wir
 *  perspektivisch an `NeueAntraegeFuerDich`-Section, damit Scroll funktioniert.
 *  Bis dahin: fallback auf `document.body.scrollIntoView()` ist Side-Effect,
 *  also einfach null-Check und no-op. */
const SCROLL_ANCHOR_SELECTOR = '[data-auslastung="neue-antraege"]';

export function SelbsteintragungBanner(): React.ReactElement | null {
  const { profile } = useProfile();
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const loaded = useAuslastungData(s => s.loaded);
  const cache = useAntraegeCache();
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);

  const myAnonId = resolveAnonIdForUser(profile?.bearbeiter_kuerzel, cache.anonymMap);
  const myMa = myAnonId ? mitarbeiter[myAnonId] : undefined;
  const myHauptKategorie = myMa?.hauptKategorie
    || (myMa?.ueberKategorien && myMa.ueberKategorien.length > 0 ? myMa.ueberKategorien[0]! : '');

  const { neueAnzahl, dismiss } = useBenachrichtigung(myAnonId, myHauptKategorie);

  if (!loaded || !kuerzelMapLoaded) return null;
  if (!myAnonId || !myHauptKategorie) return null;
  if (neueAnzahl === 0) return null;

  const onClick = (): void => {
    dismiss();
    const target = document.querySelector(SCROLL_ANCHOR_SELECTOR);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fristTage = config.selbsteintragungFristTage;
  return (
    <div
      className="flex items-center justify-between gap-3 p-3 px-4 mb-4 rounded-[var(--tf-radius)] cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
      style={{ borderLeft: '3px solid var(--tf-primary)' }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-[18px]" role="img">📋</span>
        <div>
          <p className="text-[13.5px] font-medium text-[var(--tf-text)]">
            {neueAnzahl} {neueAnzahl === 1 ? 'neuer Antrag' : 'neue Anträge'} in deinen Kategorien
          </p>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Selbsteintragungsfrist: {fristTage} Kalendertage
          </p>
        </div>
      </div>
      <span className="text-[16px] text-[var(--tf-text-tertiary)]" aria-hidden>→</span>
    </div>
  );
}
