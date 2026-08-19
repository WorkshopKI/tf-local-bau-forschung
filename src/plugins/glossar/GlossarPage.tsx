/**
 * Die Seite „Glossar": Suchfeld oben, Liste links, Erklärung rechts.
 *
 * **Ein Suchfeld über alles.** Wer nachschlägt, weiß nicht, ob das Gesuchte eine
 * Abkürzung, ein Kürzel oder ein Statuswert ist; zwei Suchfelder verlangten
 * genau die Unterscheidung, die man hier erst lernen will.
 *
 * **Es steht ganz links und gilt für BEIDE Reiter.** Rechts neben den Reitern und
 * nur im ersten sichtbar wurde es übersehen — und ein Feld, das beim
 * Reiterwechsel wirkungslos wird, muss man zweimal erklären.
 *
 * Die Auswahl wird aus den sichtbaren Gruppen ABGELEITET, nicht mitgeführt:
 * verschwindet ein Eintrag beim Weitertippen, schließt sich das Detail von
 * selbst — ohne Effekt, der zwei Zustände synchron hält.
 *
 * **Fehlt der Katalog, sagt die Seite das und zeigt trotzdem die Abkürzungen.**
 * Ein leerer Bildschirm ohne Begründung wäre die schlechtere Antwort.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { useSichtbareReiter } from '@/core/hooks/useSichtbar';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { MasterDetailLayout, fokusIstTippziel } from '@/components/master-detail';
import { GLOSSAR_BEGRIFFE } from '@/core/glossar';
import { useProfile } from '@/core/hooks/useProfile';
import { leseStatusRolle, type Rolle } from '@/core/status';
import { GlossarListe } from './GlossarListe';
import { GlossarDetail, GlossarLeer } from './GlossarDetail';
import { RollenSicht } from './RollenSicht';
import { useGlossar } from './useGlossar';
import { kuerzelZeilen, regelZeilen, statuswertZeilen } from './glossarZeilen';
import {
  begriffAlsEintrag, flacheIds, gruppiere, gesamtZahl, kuerzelAlsEintrag,
  leseSuche, naechsteId, passtKuerzel, regelAlsEintrag, statuswertAlsEintrag,
  waehleEintrag,
} from './glossarSuche';

type Sicht = 'nachschlagen' | 'rolle';

export function GlossarPage(): React.ReactElement {
  const { version, trigger, vorkommen, laden } = useGlossar();
  const { profile } = useProfile();
  const [sicht, setSicht] = useState<Sicht>('nachschlagen');
  const [suche, setSuche] = useState('');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const sucheRef = useRef<HTMLInputElement | null>(null);

  // Rolle und Richtlinien liegen HIER, nicht in `RollenSicht`: die Komponente
  // wird beim Reiterwechsel ausgehängt, und seit die Suche in beiden Reitern
  // gilt, wechselt man öfter. Die Profil-Rolle bleibt eine Vorauswahl.
  const [rolle, setRolle] = useState<Rolle | 'alle'>(
    () => leseStatusRolle(profile?.status_rolle),
  );
  const [programme, setProgramme] = useState<string[]>([]);

  const kuerzel = useMemo(
    () => (version === null ? [] : kuerzelZeilen(version, vorkommen)),
    [version, vorkommen],
  );
  // Die Eingabe wird EINMAL gelesen (gefaltet, in Wörter zerlegt) — nicht je
  // Eintrag neu. Alle Vergleicher bekommen dasselbe Ergebnis.
  const begriff = useMemo(() => leseSuche(suche), [suche]);
  const kuerzelGefiltert = useMemo(
    () => kuerzel.filter(z => passtKuerzel(z, begriff)),
    [kuerzel, begriff],
  );
  // Bis v4.111 stand die Reiter-Liste inline im JSX; sie steht jetzt als Array
  // da, damit die Beta/Experte-Marken einen Schlüssel zum Filtern haben.
  const alleTabs = [
    { key: 'nachschlagen', label: 'Nachschlagen' },
    {
      // Die Zahl ist eine Zusage: sie zählt, was der Reiter unter der
      // laufenden Suche zeigt — nicht den ganzen Kürzel-Bestand.
      key: 'rolle', label: 'Für meine Rolle wichtig',
      count: kuerzelGefiltert.length,
      disabled: kuerzel.length === 0,
      title: kuerzel.length === 0
        ? 'Ohne geladenen Katalog gibt es keine Kürzel'
        : 'Die Kürzel einer Fachrolle, nach Vorkommen im Bestand',
    },
  ];
  const sichtbareTabs = useSichtbareReiter(
    'glossar', alleTabs, t => t.key, sicht, k => setSicht(k as Sicht),
  );

  // Einmal je Fassung, nicht je Kürzel-Detail: `bedingungFeldRefs` läuft
  // rekursiv über jeden Bedingungsbaum.
  const regeln = useMemo(() => (version === null ? [] : regelZeilen(version)), [version]);

  const alle = useMemo(() => [
    ...GLOSSAR_BEGRIFFE.map(begriffAlsEintrag),
    ...(version === null ? [] : statuswertZeilen(version, vorkommen).map(statuswertAlsEintrag)),
    ...kuerzel.map(kuerzelAlsEintrag),
    ...regeln.map(regelAlsEintrag),
  ], [version, vorkommen, kuerzel, regeln]);

  const gruppen = useMemo(() => gruppiere(alle, begriff), [alle, begriff]);
  const auswahl = waehleEintrag(gruppen, gewaehlt);

  /**
   * Ein Querverweis springt zum Ziel — und holt es zurück in die Sicht.
   *
   * Das Leeren der Suche ist Bedingung, nicht Bequemlichkeit: `waehleEintrag`
   * liest die Auswahl aus den SICHTBAREN Gruppen. Bliebe ein Filter stehen, der
   * die Ziel-Id nicht trifft, liefe der Sprung ins Leere.
   */
  const springeZu = (id: string): void => {
    setSuche('');
    setSicht('nachschlagen');
    setGewaehlt(id);
  };

  // „/" führt zum Suchfeld — außer jemand tippt gerade irgendwo hinein.
  // Auf deutscher Tastatur ist „/" Shift+7, der Handler darf also NICHT auf
  // „ohne Shift" prüfen.
  useEffect(() => {
    const auf = (e: KeyboardEvent): void => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const ziel = e.target as HTMLElement | null;
      if (fokusIstTippziel(ziel?.tagName, ziel?.isContentEditable === true)) return;
      e.preventDefault();
      sucheRef.current?.focus();
      sucheRef.current?.select();
    };
    window.addEventListener('keydown', auf);
    return () => window.removeEventListener('keydown', auf);
  }, []);

  /** Tastatur im Suchfeld: leeren, wandern, den ersten Treffer nehmen. */
  const sucheTaste = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape' && suche !== '') {
      e.preventDefault();
      setSuche('');
      return;
    }
    // Gewandert wird nur dort, wo eine Trefferliste steht.
    if (sicht !== 'nachschlagen') return;
    const richtung = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : null;
    if (richtung !== null) {
      e.preventDefault();
      setGewaehlt(naechsteId(flacheIds(gruppen), auswahl?.id ?? null, richtung));
      return;
    }
    if (e.key === 'Enter' && auswahl === null) {
      e.preventDefault();
      setGewaehlt(flacheIds(gruppen)[0] ?? null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--tf-border)] px-6 pb-3 pt-5">
        <PageHeader
          title="Glossar"
          subtitle="Nachschlagen, nicht ändern"
          meta={
            <span className="text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
              {/* Im Rolle-Reiter stehen nur Kürzel — die Summe über alle Arten
                  wäre dort eine Zahl zu einer Liste, die niemand sieht. */}
              {sicht === 'rolle' ? kuerzelGefiltert.length : gesamtZahl(gruppen)} Einträge
            </span>
          }
          actions={<SeitenHilfeButton pluginId="glossar" />}
        />
        <div className="flex flex-wrap items-center gap-3">
          {/* Zuerst das Suchfeld: nachgeschlagen wird durch Tippen, nicht durch
              Reiterwahl. Die Breite trägt der Wrapper — `Input` bringt `w-full`
              mit, eine feste Breite am Feld selbst schlüge sich damit. */}
          <div className="relative min-w-[240px] max-w-[520px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-secondary)]"
            />
            <Input
              ref={sucheRef}
              autoFocus
              autoComplete="off"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              onKeyDown={sucheTaste}
              placeholder="Abkürzung, Begriff, Statuswert oder Kürzel suchen"
              aria-label="Glossar durchsuchen"
              className="h-8 pl-7.5 pr-8 text-[12.5px]"
            />
            {suche.length > 0 && (
              <button
                type="button"
                onClick={() => { setSuche(''); sucheRef.current?.focus(); }}
                aria-label="Suche leeren"
                title="Suche leeren (Esc)"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--tf-text-tertiary)] transition hover:text-[var(--tf-text)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <ScopeTabs
            variant="pills"
            aria-label="Sicht"
            activeKey={sicht}
            onChange={k => setSicht(k as Sicht)}
            items={sichtbareTabs}
          />
        </div>
        {version === null && !laden && (
          // Ehrlich leer: die Abkürzungen stehen weiter da, aber warum die
          // anderen Gruppen fehlen, gehört gesagt.
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Kein Status-Katalog geladen — Statuswerte und Kürzel fehlen deshalb. Die
            Abkürzungen und Begriffe stehen unabhängig davon.
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {sicht === 'rolle' ? (
          <RollenSicht
            zeilen={kuerzelGefiltert}
            trigger={trigger}
            begriff={begriff}
            rolle={rolle}
            onRolle={setRolle}
            programme={programme}
            onProgramme={setProgramme}
            onWaehlen={springeZu}
          />
        ) : (
          <MasterDetailLayout
            listWidthKey="teamflow_glossar_narrow_width"
            onCloseDetail={() => setGewaehlt(null)}
            list={
              // Kein eigener Scroller: `MasterDetailLayout` bringt für die
              // Listen-Spalte schon einen mit, und zwei ineinander bedeuten nur,
              // dass die Sticky-Köpfe am inneren hängen.
              <GlossarListe
                gruppen={gruppen}
                gewaehlt={auswahl?.id ?? null}
                begriff={begriff}
                onWaehlen={setGewaehlt}
                leerText={`Kein Eintrag zu „${begriff.roh}". Was hier fehlt, fehlt im Glossar — sagen Sie es über „Hilfe → Text stimmt nicht".`}
              />
            }
            detail={
              auswahl
                ? <GlossarDetail
                    key={auswahl.id} eintrag={auswahl}
                    version={version} regeln={regeln} trigger={trigger} onWaehlen={springeZu}
                  />
                : <GlossarLeer />
            }
          />
        )}
      </div>
    </div>
  );
}
