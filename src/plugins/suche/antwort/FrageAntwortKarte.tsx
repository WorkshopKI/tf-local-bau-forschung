/**
 * Die Antwort auf eine gestellte Frage — über der Trefferliste, nicht daneben.
 *
 * Sie steht hier und nicht im Assistenten-Panel, weil sie zum ERGEBNIS gehört:
 * gefragt wurde die Suche, nicht ein Gesprächspartner. Bis v4.88 ging nach dem
 * Suchlauf das Panel auf, trug dieselbe Frage im Eingabefeld und wartete auf
 * eine zweite Absendung — der Nutzer musste seine Frage zweimal stellen, um
 * einmal eine Antwort zu bekommen. Das Panel bleibt für Rückfragen, mit der
 * Frage im Feld.
 *
 * Drei Zustände, und der dritte ist der wichtigste: **scheitert die Antwort,
 * bleibt die Trefferliste stehen.** Sie ist deterministisch entstanden und hängt
 * an keinem Modell.
 */
import { Loader2, Sparkles, TriangleAlert } from 'lucide-react';

export interface FrageAntwortKarteProps {
  /** `true`, solange der Lauf läuft. */
  laeuft: boolean;
  /** Die fertige Antwort, oder `null`. */
  antwort: string | null;
  /** Fehlermeldung, oder `null`. */
  fehler: string | null;
  /** Wie viele Treffer der Befund umfasst — die Zahl der Liste darunter. */
  gesamt: number;
  /** Springt zu einem Treffer, wenn sein Kennzeichen angeklickt wird. */
  onFkz?: (fkz: string) => void;
}

/** Ein Förderkennzeichen im Antworttext: `16KN065624`, auch mit Suffix. */
const FKZ_MUSTER = /\b(\d{2}[A-Z]{2}\d{4,8}[A-Z0-9]{0,3})\b/g;

/**
 * Macht die Kennzeichen im Antworttext anklickbar.
 *
 * Der Prompt verlangt sie bei jeder Aussage über ein Vorhaben (Pflicht 8 in
 * [frageantwort-lauf.ts](src/core/services/search/frageantwort-lauf.ts)) — hier
 * werden sie zu dem, wofür sie da sind: dem Weg in die Liste darunter. Rein
 * dekorativ wäre die Belegpflicht eine Formalie.
 */
function mitKennzeichen(text: string, onFkz?: (fkz: string) => void): React.ReactNode[] {
  const teile: React.ReactNode[] = [];
  let zuletzt = 0;
  for (const m of text.matchAll(FKZ_MUSTER)) {
    const i = m.index ?? 0;
    if (i > zuletzt) teile.push(text.slice(zuletzt, i));
    const fkz = m[0];
    teile.push(onFkz
      ? (
        <button
          key={`${fkz}-${i}`}
          type="button"
          onClick={() => onFkz(fkz)}
          title={`Zu ${fkz} in der Trefferliste`}
          className="font-mono text-[var(--tf-primary)] underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0"
        >
          {fkz}
        </button>
      )
      : <span key={`${fkz}-${i}`} className="font-mono">{fkz}</span>);
    zuletzt = i + fkz.length;
  }
  if (zuletzt < text.length) teile.push(text.slice(zuletzt));
  return teile;
}

export function FrageAntwortKarte({
  laeuft, antwort, fehler, gesamt, onFkz,
}: FrageAntwortKarteProps): React.ReactElement | null {
  if (!laeuft && antwort === null && fehler === null) return null;

  return (
    <div
      className="mt-3 w-full max-w-6xl rounded-[10px] px-3.5 py-3"
      style={{ background: 'var(--tf-desk)', border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.04em] text-[var(--tf-text-tertiary)]">
        {laeuft
          ? <Loader2 size={12} className="animate-spin" aria-hidden />
          : fehler !== null
            ? <TriangleAlert size={12} aria-hidden />
            : <Sparkles size={12} aria-hidden />}
        <span>Antwort der internen KI</span>
        {/* Die Bezugsgröße gehört in den Kopf: eine Antwort ohne Nenner liest
            sich, als gälte sie für alles, was es gibt. */}
        {!laeuft && fehler === null && (
          <span className="normal-case tracking-normal">
            · aus {gesamt.toLocaleString('de-DE')} Treffern
          </span>
        )}
      </div>

      {laeuft && (
        <p className="mt-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          Die Treffer stehen bereits — die Antwort dazu wird gerade formuliert.
        </p>
      )}

      {fehler !== null && (
        <p className="mt-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">{fehler}</p>
      )}

      {antwort !== null && !laeuft && (
        <>
          <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--tf-text)]">
            {mitKennzeichen(antwort, onFkz)}
          </div>
          {/* Kein Kleingedrucktes, sondern die Bedingung, unter der der Text
              gelesen werden muss: die Zahlen sind gezählt, die Formulierung ist
              es nicht. */}
          <p className="mt-2 text-[11px] text-[var(--tf-text-tertiary)]">
            Die Zahlen sind aus allen Treffern gezählt; der Text ist von der KI
            formuliert und kann Fehler enthalten.
          </p>
        </>
      )}
    </div>
  );
}
