/**
 * Panel-Grundform des Prüfblatts: Kopfzeile mit optionalem Zusatz rechts,
 * darunter der Inhalt. Alle Screens des Moduls bauen darauf auf, damit der
 * Rhythmus über die neun Schritte hinweg gleich bleibt.
 *
 * Abweichungen vom Design-Handoff sind bewusst: 0.5px-Rahmen statt 1px und
 * Schriftgewicht 500 statt 600 (DESIGN_GUIDE), kein Deko-Schatten.
 */
export function Karte({ titel, kopfRechts, randlos = false, children }: {
  titel: string;
  kopfRechts?: React.ReactNode;
  /** Inhalt randlos anlegen — für Zeilenlisten und Raster über die volle Breite. */
  randlos?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      className="rounded-[12px] bg-[var(--tf-card-surface,var(--tf-bg))] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <h2 className="text-[13.5px] font-medium text-[var(--tf-text)]">{titel}</h2>
        {kopfRechts != null && (
          <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)]">{kopfRechts}</span>
        )}
      </div>
      <div className={randlos ? '' : 'px-4 pb-4'}>{children}</div>
    </section>
  );
}

type BannerTon = 'warn' | 'info' | 'ok';

const BANNER_STIL: Record<BannerTon, { hintergrund: string; symbol: string }> = {
  warn: { hintergrund: 'var(--tf-warning-bg)', symbol: 'var(--tf-warning-text)' },
  info: { hintergrund: 'var(--tf-primary-light)', symbol: 'var(--tf-primary)' },
  ok: { hintergrund: 'var(--tf-success-bg)', symbol: 'var(--tf-success-text)' },
};

/**
 * Hinweisbalken über dem Inhalt eines Schritts — trägt die wichtigste Aussage
 * des Screens, bevor der Prüfer in die Details geht.
 */
export function Banner({ ton, titel, symbol, children }: {
  ton: BannerTon;
  titel: string;
  symbol?: React.ReactNode;
  children?: React.ReactNode;
}): React.ReactElement {
  const stil = BANNER_STIL[ton];
  return (
    <div
      className="flex gap-3 rounded-[11px] px-4 py-3.5"
      style={{ background: stil.hintergrund }}
    >
      {symbol != null && (
        <span className="shrink-0 grid place-items-center w-5 h-5" style={{ color: stil.symbol }}>
          {symbol}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--tf-text)]">{titel}</div>
        {children != null && (
          <div className="text-[12px] leading-[1.45] text-[var(--tf-text-secondary)] mt-1">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
