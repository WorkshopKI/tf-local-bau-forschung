/**
 * Die Zeile unter dem Suchfeld: was die laufende Suche gerade findet — und der
 * Weg zur Ähnlichkeitssuche.
 *
 * **Warum kein Dauer-Schalter mehr (v4.64).** Bis dahin stand neben dem Suchfeld
 * permanent ein Auswahlfeld „Ohne Ähnlichkeitssuche / Mit Ähnlichkeitssuche" —
 * ein Bedienelement, das immer Platz belegte, auch wenn niemand suchte. Die
 * Fördertabelle ist eine Arbeitsliste; man kommt mit FKZ, Akronym oder
 * Antragsteller, und der Wortlaut trifft. Die Ähnlichkeit braucht man erst,
 * wenn die Trefferliste dünn bleibt — also erscheint der Weg dorthin genau
 * dann: bei laufender Suche, unter dem Feld, als Satz statt als Schalter.
 *
 * **Der Zustand hat immer einen Rückweg.** Eingeschaltet steht hier, dass die
 * Ähnlichkeit läuft, samt Weg zurück auf den Wortlaut — ein Modus, den man
 * anschaltet und nicht mehr findet, wäre schlimmer als das Dropdown.
 *
 * Der Schalter selbst ist sitzungsweit und mit der Suchseite geteilt
 * (`useSemanticSearchMode`) — hier steht nur seine Bedienung.
 */
import { Loader2 } from 'lucide-react';
import { useAntraegeStore } from './store';
import { useWirksamerSuchtext } from './frage/suchtext';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';

/** Ab hier lohnt die Rückfrage — darunter ist die Eingabe noch im Fluss. */
const MIN_ZEICHEN = 2;

export function AehnlichkeitsHinweis(): React.ReactElement | null {
  // Der WIRKSAME Text, nicht der rohe Feldinhalt: im Frage-Modus ist eine
  // getippte, noch nicht übersetzte Frage kein Suchtext, und eine übersetzte
  // Frage ohne Leitbegriffe ebenso wenig. Diese Zeile beschreibt die Liste
  // darunter — las sie `s.search`, versprach sie „Wortlaut-Treffer", während
  // gar keine Wortlaut-Suche lief (v4.124).
  const search = useWirksamerSuchtext();
  const unavailable = useAntraegeStore(s => s.hybridSearch.unavailable);
  const downloadingCorpus = useAntraegeStore(s => s.hybridSearch.downloadingCorpus);
  const semanticEnabled = useSemanticSearchMode(s => s.enabled);
  const setSemanticEnabled = useSemanticSearchMode(s => s.setEnabled);

  if (search.trim().length < MIN_ZEICHEN) return null;

  if (downloadingCorpus) {
    return (
      <Zeile>
        <Loader2 size={11} className="animate-spin shrink-0" aria-hidden="true" />
        <span>
          Ähnlichkeitssuche wird vorbereitet (Modell laden + Embedding-Korpus vom Daten-Share,
          einmalig ~5–15 s) — solange liefert die Suche Wortlaut-Treffer.
        </span>
      </Zeile>
    );
  }

  // Eingeschaltet, aber der Korpus fehlt: der Zustand bleibt sichtbar UND
  // umkehrbar — sonst stünde hier ein Modus an, der nichts tut und den man
  // nicht mehr los wird.
  const korpusFehlt = semanticEnabled && unavailable.includes('embedding');

  return (
    <Zeile>
      <span>
        {korpusFehlt
          ? 'Ähnlichkeitssuche eingeschaltet, aber ohne Wirkung — der Embedding-Korpus fehlt (im Auslastungs-Modul bauen).'
          : semanticEnabled
            ? 'Ähnlichkeitssuche aktiv — die Liste enthält auch inhaltlich verwandte Anträge.'
            : 'Wortlaut-Treffer aus Antragsdaten und Dokumenten.'}
      </span>
      <button
        type="button"
        onClick={() => setSemanticEnabled(!semanticEnabled)}
        className="underline underline-offset-2 hover:text-[var(--tf-text)] transition-colors cursor-pointer"
        title={semanticEnabled
          ? 'Wieder nur Wortlaut-Treffer zeigen.'
          : 'Lädt einmalig das Embedding-Modell (~5–10 s, deutlich mehr Arbeitsspeicher) und ergänzt inhaltlich ähnliche Anträge.'}
      >
        {semanticEnabled ? 'Auf Wortlaut beschränken' : 'Auch inhaltlich ähnliche einbeziehen'}
      </button>
    </Zeile>
  );
}

function Zeile({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mt-1 mb-2 flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
      {children}
    </div>
  );
}
