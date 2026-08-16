/**
 * Das Menü hinter dem Lesezeichen: eigene Reiter merken, nachziehen, umbenennen,
 * entfernen.
 *
 * **Eine Fläche für alles.** Die Alternative wären Griffe an den Reitern selbst
 * (Stift beim Überfahren, × daneben) — die sind in einer Reiterleiste, die schon
 * Zähler und Trenner trägt, nur mit der Maus zu finden und im Fokus-Modus weg.
 * Hier steht jeder Reiter mit seinen drei Handgriffen, dauerhaft an derselben
 * Stelle.
 *
 * **„Merken" bietet sich nur an, wenn es etwas zu merken gibt**: passt der
 * aktuelle Stand schon zu einem Reiter, steht dort dessen Name statt eines
 * zweiten, gleichlautenden Eintrags. Und weicht der Stand von einem gemerkten
 * ab, kann man ihn an genau diesem Reiter nachziehen — deshalb sitzt
 * „Aktualisieren" an der Zeile und nicht oben.
 */
import { useState } from 'react';
import { Bookmark, Check, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  useEigeneReiter,
  passenderReiter,
  beschreibeZustand,
  MAX_EIGENE_REITER,
  type EigenerReiter,
} from './eigeneReiter';
import { useAktuellerKern, zustandJetzt } from './reiterZustand';
import { getView } from './views';

/** Vorschlag für den Namen: die Basis-Sicht, danach nummeriert. Ein leeres Feld
 *  wäre ein Formular; ein Vorschlag ist ein Angebot, das man überschreibt. */
function namensVorschlag(basisLabel: string, vorhanden: readonly EigenerReiter[]): string {
  const belegt = new Set(vorhanden.map(r => r.name));
  if (!belegt.has(basisLabel)) return basisLabel;
  for (let i = 2; i < 20; i++) {
    const name = `${basisLabel} ${i}`;
    if (!belegt.has(name)) return name;
  }
  return basisLabel;
}

export function EigeneReiterMenue(): React.ReactElement {
  const reiter = useEigeneReiter(s => s.reiter);
  const merke = useEigeneReiter(s => s.merke);
  const aktualisiere = useEigeneReiter(s => s.aktualisiere);
  const benenneUm = useEigeneReiter(s => s.benenneUm);
  const entferne = useEigeneReiter(s => s.entferne);
  const kern = useAktuellerKern();
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState('');
  const [umbenennen, setUmbenennen] = useState<string | null>(null);
  const [neuerName, setNeuerName] = useState('');

  const aktiv = passenderReiter(reiter, kern);
  const basisLabel = getView(kern.basis).label;
  const voll = reiter.length >= MAX_EIGENE_REITER;

  const oeffne = (auf: boolean): void => {
    setOffen(auf);
    if (auf) setName(namensVorschlag(basisLabel, reiter));
    else setUmbenennen(null);
  };

  const speichere = (): void => {
    merke(name, zustandJetzt());
    setOffen(false);
  };

  return (
    <Popover open={offen} onOpenChange={oeffne}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Eigene Reiter"
          title="Eigene Reiter: diesen Stand merken oder einen gemerkten verwalten"
          className="shrink-0 mb-1.5 p-1 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] transition-colors cursor-pointer"
        >
          <Bookmark size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] gap-2">
        <div
          className="px-1.5 text-[10.5px] font-medium uppercase text-[var(--tf-text-tertiary)]"
          style={{ letterSpacing: '0.08em' }}
        >
          Eigene Reiter
        </div>

        {reiter.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {reiter.map(r => (
              <div
                key={r.id}
                className="group/reiter flex items-center gap-1 rounded px-1.5 py-1 hover:bg-[var(--tf-hover)]"
              >
                {umbenennen === r.id ? (
                  <>
                    <Input
                      value={neuerName}
                      autoFocus
                      onChange={e => setNeuerName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { benenneUm(r.id, neuerName); setUmbenennen(null); }
                        if (e.key === 'Escape') setUmbenennen(null);
                      }}
                      className="h-6 flex-1 min-w-0 text-[12px]"
                      aria-label="Neuer Name"
                    />
                    <button
                      type="button"
                      onClick={() => { benenneUm(r.id, neuerName); setUmbenennen(null); }}
                      title="Namen übernehmen"
                      className="shrink-0 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setUmbenennen(null)}
                      title="Abbrechen"
                      className="shrink-0 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] text-[var(--tf-text)]">
                        {r.name}
                        {aktiv?.id === r.id ? (
                          <span className="ml-1.5 text-[10.5px] text-[var(--tf-primary)]">aktiv</span>
                        ) : null}
                      </div>
                      <div className="truncate text-[10.5px] text-[var(--tf-text-tertiary)]">
                        {beschreibeZustand(r.zustand, getView(r.zustand.basis).label)}
                      </div>
                    </div>
                    {/* Nachziehen nur, wenn der aktuelle Stand ein anderer ist —
                        sonst wäre der Knopf eine Aktion ohne Wirkung. */}
                    {aktiv?.id === r.id ? null : (
                      <button
                        type="button"
                        onClick={() => aktualisiere(r.id, zustandJetzt())}
                        title={`„${r.name}" auf den aktuellen Stand bringen`}
                        aria-label={`„${r.name}" aktualisieren`}
                        className="shrink-0 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setUmbenennen(r.id); setNeuerName(r.name); }}
                      title="Umbenennen"
                      aria-label={`„${r.name}" umbenennen`}
                      className="shrink-0 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => entferne(r.id)}
                      title="Entfernen"
                      aria-label={`„${r.name}" entfernen`}
                      className="shrink-0 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div className="border-t-[0.5px] border-[var(--tf-border)] pt-2">
          {aktiv ? (
            <p className="px-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
              Dieser Stand ist bereits als „{aktiv.name}" gemerkt.
            </p>
          ) : voll ? (
            <p className="px-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
              {MAX_EIGENE_REITER} eigene Reiter sind das Maximum — einen entfernen oder
              einen davon auf diesen Stand aktualisieren.
            </p>
          ) : (
            <>
              <p className="px-1.5 pb-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
                Diesen Stand als Reiter merken: {beschreibeZustand(zustandJetzt(), basisLabel)}
              </p>
              <div className="flex items-center gap-1.5 px-1.5">
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') speichere(); }}
                  placeholder="Name des Reiters"
                  aria-label="Name des Reiters"
                  className="h-7 flex-1 min-w-0 text-[12px]"
                />
                <button
                  type="button"
                  onClick={speichere}
                  className="shrink-0 h-7 rounded-[var(--tf-radius-sm)] bg-[var(--tf-primary)] px-2.5 text-[11.5px] text-[var(--tf-on-primary)] cursor-pointer"
                >
                  Merken
                </button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
