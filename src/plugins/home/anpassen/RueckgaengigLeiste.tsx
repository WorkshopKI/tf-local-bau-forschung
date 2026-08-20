/**
 * Bestätigungsleiste unten mittig — „Meine Anträge ausgeblendet" + Rückgängig.
 *
 * Mittig, nicht rechts: rechts unten sitzt der Feedback-FAB, den die Leiste nicht
 * verdecken darf (dieselbe Wahl wie beim `fb-toast` des Boards). Sie hält die
 * Umkehrung der letzten Aktion (rueckgaengigStore) und wendet sie auf den
 * AKTUELLEN Stand an — ein Weg für Ausblenden, „alle aus" und Zurücksetzen.
 *
 * **Die Reue-Frist läuft an der Uhr, nicht an der Lebensdauer dieser Komponente**
 * (v4.131). Vorher räumte der Cleanup den Timer ab, sobald man die Startseite
 * verließ — `leere()` feuerte nie, der Eintrag blieb im Modul-Store stehen, und
 * bei der Rückkehr stand die Leiste wieder da und startete die Frist von vorn.
 * Sie bot dann eine beliebig alte Änderung zum Zurücknehmen an. Jetzt entscheidet
 * `seit`: abgelaufen wird beim Mount verworfen, sonst läuft nur die Restzeit.
 */
import { useEffect } from 'react';
import { Undo2, X } from 'lucide-react';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { RUECKGAENGIG_MS, useRueckgaengigStore } from './rueckgaengigStore';

export function RueckgaengigLeiste(): React.ReactElement | null {
  const api = useHomeWidgets();
  const eintrag = useRueckgaengigStore(s => s.eintrag);
  const leere = useRueckgaengigStore(s => s.leere);

  // `nr` in den Deps, nicht der Text: zweimal dasselbe Ausblenden hintereinander
  // soll den Timer neu starten, nicht die alte Frist weiterlaufen lassen.
  const nr = eintrag?.nr;
  const seit = eintrag?.seit;
  useEffect(() => {
    if (nr === undefined || seit === undefined) return;
    const rest = seit + RUECKGAENGIG_MS - Date.now();
    if (rest <= 0) { leere(); return; }
    const t = setTimeout(() => leere(), rest);
    return () => clearTimeout(t);
  }, [nr, seit, leere]);

  // Abgelaufen, aber der Effekt hat noch nicht geräumt (erster Render nach der
  // Rückkehr): nicht zeichnen, statt für einen Frame etwas anzubieten, das
  // gleich verschwindet.
  if (!eintrag || eintrag.seit + RUECKGAENGIG_MS <= Date.now()) return null;

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
        onClick={() => { void api.wendeAn(eintrag.wende); leere(); }}
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
