/**
 * Bestätigungsleiste unten mittig — „Meine Anträge ausgeblendet" + Rückgängig.
 *
 * Mittig, nicht rechts: rechts unten sitzt der Feedback-FAB, den die Leiste nicht
 * verdecken darf (dieselbe Wahl wie beim `fb-toast` des Boards). Sie hält den
 * kompletten Vorstand (rueckgaengigStore) und schreibt ihn zurück — ein Weg für
 * Ausblenden, „alle aus" und Zurücksetzen.
 */
import { useEffect } from 'react';
import { Undo2, X } from 'lucide-react';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { useRueckgaengigStore } from './rueckgaengigStore';

/** Reue-Frist. Lang genug zum Lesen und Zielen, kurz genug, um nicht im Weg zu stehen. */
const SICHTBAR_MS = 7000;

export function RueckgaengigLeiste(): React.ReactElement | null {
  const api = useHomeWidgets();
  const eintrag = useRueckgaengigStore(s => s.eintrag);
  const leere = useRueckgaengigStore(s => s.leere);

  // `nr` in den Deps, nicht der Text: zweimal dasselbe Ausblenden hintereinander
  // soll den Timer neu starten, nicht die alte Frist weiterlaufen lassen.
  const nr = eintrag?.nr;
  useEffect(() => {
    if (nr === undefined) return;
    const t = setTimeout(() => leere(), SICHTBAR_MS);
    return () => clearTimeout(t);
  }, [nr, leere]);

  if (!eintrag) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[22px] left-1/2 z-[120] flex -translate-x-1/2 items-center gap-3 rounded-full py-[9px] pl-4 pr-[10px] text-[12.5px]"
      style={{
        background: 'var(--tf-text)',
        color: 'var(--tf-bg)',
        boxShadow: 'var(--tf-shadow-dialog)',
      }}
    >
      <span>{eintrag.text}</span>
      <button
        type="button"
        onClick={() => { void api.ersetze(eintrag.vorstand); leere(); }}
        className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[12px] cursor-pointer hover:opacity-80"
        style={{ background: 'color-mix(in srgb, var(--tf-bg) 16%, transparent)', color: 'inherit' }}
      >
        <Undo2 size={13} aria-hidden />
        Rückgängig
      </button>
      <button
        type="button"
        onClick={leere}
        aria-label="Meldung schließen"
        className="cursor-pointer opacity-70 hover:opacity-100"
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  );
}
