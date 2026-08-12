import { Search, Clock, MessageSquare, Info } from 'lucide-react';

/**
 * Positiver Leerzustand der Suche (Mockup `journey-paket-4/suche-leerzustand.png`).
 *
 * Betont, was AKTIV geht — die Antragssuche über {n} Anträge — statt auf den
 * (noch) fehlenden Dokumentenindex hinzuweisen. Der Index-Hinweis erscheint NUR
 * bei leerem Index als dezente, abgesetzte Info-Zeile OHNE Handlungsaufforderung:
 * Index-Einrichtung ist Kurator-Aufgabe, nicht Nutzer-Aufgabe. Ausnahme: In der
 * Kurator-Build-Variante trägt die Zeile zusätzlich einen dezenten Link.
 *
 * Die Beispiel-Chips lösen die Suche über EXAKT denselben Pfad aus wie getippte
 * Eingaben (inkl. Verlaufs-Eintrag) — der Aufrufer reicht `onExample` durch.
 */

/** Statische, realistische Beispiele — je Chip eine Sucheingabe-Art
 *  (thematisch · FKZ · Mehrwort-Thema · Ort). */
const BEISPIELE = ['Bilderkennung', '16KN055710', 'additive Fertigung', 'Dresden'] as const;

export function SucheLeerzustand({
  antraegeGeladen,
  textabschnitteImIndex,
  onExample,
  kuratorVariant,
  onOpenDokumentenquellen,
}: {
  antraegeGeladen: number;
  textabschnitteImIndex: number;
  onExample: (query: string) => void;
  /** Kurator-Build (kuratorMenus + dokumentenscan) → dezenter Kuratier-Link. */
  kuratorVariant: boolean;
  onOpenDokumentenquellen: () => void;
}): React.ReactElement {
  const indexLeer = textabschnitteImIndex === 0;
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <p className="text-[16px] font-medium text-[var(--tf-text)] mb-1.5">
        {antraegeGeladen.toLocaleString('de-DE')} Anträge durchsuchbar
      </p>
      <p className="text-[13px] text-[var(--tf-text-secondary)] max-w-lg leading-relaxed">
        Nach Titel, Akronym, FKZ, Antragsteller oder Ort — mit Ähnlichkeitssuche
        findest du auch thematisch verwandte Vorhaben.
      </p>

      {/* Klickbare Beispiel-Chips — führen die Suche über den regulären Pfad aus. */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        {BEISPIELE.map(beispiel => (
          <button
            key={beispiel}
            type="button"
            onClick={() => onExample(beispiel)}
            title={`„${beispiel}" suchen`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40"
            style={{ background: 'transparent', border: '0.5px solid var(--tf-border)' }}
          >
            <Search size={12} className="text-[var(--tf-text-tertiary)]" />
            <span>{beispiel}</span>
          </button>
        ))}
      </div>

      {/* Zwei dezente Hinweis-Items. */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5 text-[11.5px] text-[var(--tf-text-tertiary)]">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={12} aria-hidden />
          Letzte Suchen im Feld
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare size={12} aria-hidden />
          Fragen beantwortet der Assistent
        </span>
      </div>

      {/* Index-Hinweis — NUR bei leerem Dokumentenindex, dezent, keine CTA. */}
      {indexLeer && (
        <div className="w-full max-w-lg mt-8 pt-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <p className="inline-flex items-start gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)] leading-relaxed">
            <Info size={12} className="mt-[2px] shrink-0" aria-hidden />
            <span>
              Volltextsuche in Dokumenten ist noch nicht eingerichtet — sobald der
              Dokumentenindex vorliegt, erscheinen auch Treffer aus Vorhabensbeschreibungen.
              {kuratorVariant && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onOpenDokumentenquellen}
                    className="underline underline-offset-2 hover:text-[var(--tf-text-secondary)] cursor-pointer"
                  >
                    Dokumentenquellen öffnen
                  </button>
                </>
              )}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
