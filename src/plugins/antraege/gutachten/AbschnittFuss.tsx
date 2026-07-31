/**
 * Gedämpfte Fußzeile der Abschnitts-Karte: Kennzahlen + Provenienz links,
 * 👍/👎 rechts.
 *
 * Das Feedback bleibt AUSDRÜCKLICH sichtbar und wandert nicht ins ⋯-Menü — das
 * System lernt daraus (Skill-Reifegrad), also darf es nicht einen Klick tief
 * versteckt sein. Gedämpfter Stil, aber immer da.
 *
 * Zwei-Stufen-👎 (erst Notizfeld, dann senden) und die Notiz als `<input>` sind
 * unverändert übernommen — der Convention-Test `gutachten-entwurf-kein-plain-textarea`
 * deckt diese Datei mit ab und verlangt hier ein einzeiliges Eingabefeld.
 * (Der Guard ist eine Substring-Prüfung: das verbotene Element darf auch in
 * Kommentaren nicht ausgeschrieben werden.)
 */
import { useEffect, useState } from 'react';
import { Info, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatDate } from '../kurzfassung/kurzfassung-verlauf';
import { zielLabel } from './abschnittAnzeige';
import type { StepRun } from './types';

interface Props {
  run: StepRun;
  satzanzahl: number;
  wortanzahl: number;
  /** Anzahl der Regeln ohne Beanstandung / gesamt. */
  regelnOk: number;
  regelnGesamt: number;
  provenance?: { skillName: string };
  onOpenSkill?: () => void;
  /** Fehlt → keine Feedback-Knöpfe. */
  onFeedback?: (rating: 'up' | 'down', notiz?: string) => void;
}

export function AbschnittFuss({
  run, satzanzahl, wortanzahl, regelnOk, regelnGesamt, provenance, onOpenSkill, onFeedback,
}: Props): React.ReactElement {
  const [fbDone, setFbDone] = useState(false);
  const [fbNote, setFbNote] = useState('');
  const [downActive, setDownActive] = useState(false);
  // Ein Votum je Abschnittsversion — Reset bei neuer Generierung.
  useEffect(() => { setFbDone(false); setFbNote(''); setDownActive(false); }, [run.erstellt_am, run.skillVersion]);

  const submitFeedback = (rating: 'up' | 'down'): void => {
    if (fbDone) return; // Doppel-Trigger (Blur + Klick) abfangen
    onFeedback?.(rating, fbNote.trim() || undefined);
    setFbDone(true);
  };
  const onDownClick = (): void => {
    if (!downActive) { setDownActive(true); return; }
    submitFeedback('down');
  };

  const prov = provenance
    ? `${provenance.skillName}${run.skillVersion != null ? ` v${run.skillVersion}` : ''}`
    : null;
  const ki = zielLabel(run);

  return (
    <div className="g-fuss">
      <span>
        {satzanzahl} {satzanzahl === 1 ? 'Satz' : 'Sätze'} · {wortanzahl.toLocaleString('de-DE')} {wortanzahl === 1 ? 'Wort' : 'Wörter'}
        {regelnGesamt > 0 && ` · ${regelnOk} von ${regelnGesamt} ${regelnGesamt === 1 ? 'Regel' : 'Regeln'} ok`}
        {run.status === 'freigegeben' && ` · freigegeben am ${formatDate(run.freigegeben_am ?? run.erstellt_am)}`}
        {run.mitTweak ? ' · mit persönlichem Stil' : ''}
        {prov && ` · generiert von ${prov}`}
        {ki && ` · ${ki}`}
      </span>
      {prov && onOpenSkill && (
        <button
          type="button"
          className="g-meta-info"
          onClick={onOpenSkill}
          title={`Skill „${provenance!.skillName}" öffnen`}
          aria-label={`Skill ${provenance!.skillName} öffnen`}
        >
          <Info size={13} />
        </button>
      )}
      <span className="g-ab-spacer" />
      {onFeedback && (
        fbDone ? (
          <span className="g-fb-done">Danke — Rückmeldung gespeichert.</span>
        ) : (
          <span className="g-fuss-feedback">
            {downActive && (
              <input
                className="g-noteinput g-noteinput-ctx"
                value={fbNote}
                onChange={e => setFbNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitFeedback('down'); } }}
                onBlur={() => submitFeedback('down')}
                placeholder="Was stört dich am Entwurf? (kein Antragsbezug)"
                maxLength={140}
                autoFocus
              />
            )}
            <button type="button" className="g-vbtn" title="Entwurf gut" aria-label="Entwurf gut" onClick={() => submitFeedback('up')}>
              <ThumbsUp className="g-vi" />
            </button>
            <button type="button" className={`g-vbtn${downActive ? ' down' : ''}`} title="Entwurf nicht gut" aria-label="Entwurf nicht gut" onClick={onDownClick}>
              <ThumbsDown className="g-vi" />
            </button>
          </span>
        )
      )}
    </div>
  );
}
