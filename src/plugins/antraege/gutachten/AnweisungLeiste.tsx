/**
 * Eingabe der freien KI-Überarbeitungs-Anweisung („Bearbeiten mit KI").
 *
 * Erscheint INLINE anstelle der Werkzeugzeile — der Abschnittstext bleibt sichtbar,
 * während man formuliert, was an ihm geändert werden soll („die anderen entfernen"
 * ist ohne den Text vor Augen nicht schreibbar). Aufbau + Optik spiegeln bewusst die
 * `g-edit`-Leiste des Entwurfs-Editors, damit die Karte nicht zwei Eingabe-Sprachen
 * spricht.
 *
 * Zum `<textarea>`: der Convention-Test `gutachten-entwurf-kein-plain-textarea`
 * bewacht den ENTWURFS-Editor (SectionReviewCard) und das Feedback-Notizfeld
 * (AbschnittFuss) — dort ist der Buffer rohes Markdown und ein Roundtrip wäre ein
 * Datenverlust. Eine Arbeitsanweisung ist kein Markdown-Dokument; sie geht wortgetreu
 * in den Prompt. Deshalb hier bewusst ein einfaches Mehrzeilenfeld und KEINE
 * Erweiterung der Guard-Dateiliste.
 */
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ANWEISUNG_MAX_LAENGE, ladeAnweisungen, merkeAnweisung, speichereAnweisungen } from './anweisungVerlauf';

/** Chip-Beschriftung: eine Zeile, der Volltext steht im `title`. */
const CHIP_MAX = 38;

interface Props {
  /** Startet den Überarbeitungs-Lauf mit der eingegebenen Anweisung. */
  onStart: (anweisung: string) => void;
  onAbbrechen: () => void;
  /** KI nicht möglich (busy/offline) → Start gesperrt. */
  genDisabled: boolean;
}

export function AnweisungLeiste({ onStart, onAbbrechen, genDisabled }: Props): React.ReactElement {
  const [text, setText] = useState('');
  // Einmal beim Öffnen lesen: die Liste ändert sich nur durch den eigenen Start,
  // und dann schließt die Leiste ohnehin.
  const [zuletzt] = useState<string[]>(() => ladeAnweisungen());
  const feldRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { feldRef.current?.focus(); }, []);

  const bereit = text.trim().length > 0 && !genDisabled;

  const start = (): void => {
    const anweisung = text.trim();
    if (!anweisung || genDisabled) return;
    speichereAnweisungen(merkeAnweisung(zuletzt, anweisung));
    onStart(anweisung);
  };

  return (
    <div className="g-anweisung">
      <div className="g-anweisung-bar">
        <Sparkles className="g-abi" />
        <span>Mit KI überarbeiten</span>
        <span className="g-ab-spacer" />
        <button type="button" className="g-btn ghost sm" onClick={onAbbrechen}>Abbrechen</button>
        <button type="button" className="g-btn primary sm" disabled={!bereit} onClick={start}>Überarbeiten</button>
      </div>

      <textarea
        ref={feldRef}
        className="g-anweisung-feld"
        rows={3}
        maxLength={ANWEISUNG_MAX_LAENGE}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); onAbbrechen(); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); start(); }
        }}
        placeholder="z. B. „Technische Risiken auf die des Lösungswegs beschränken, die anderen entfernen“ oder „Details des Lösungsweges vertiefen“"
      />

      {zuletzt.length > 0 && (
        <div className="g-anweisung-chips">
          <span className="g-anweisung-chips-lbl">Zuletzt:</span>
          {zuletzt.map(a => (
            <button
              key={a}
              type="button"
              className="g-anweisung-chip"
              title={a}
              onClick={() => { setText(a); feldRef.current?.focus(); }}
            >
              {a.length > CHIP_MAX ? `${a.slice(0, CHIP_MAX).trimEnd()}…` : a}
            </button>
          ))}
        </div>
      )}

      <div className="g-anweisung-fuss">
        Der bisherige Text und die Vorhabensbeschreibung bleiben im Kontext — die Anweisung gilt
        für genau diesen Lauf. ⌘/Strg + Enter startet · Esc bricht ab
      </div>
    </div>
  );
}
