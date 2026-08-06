/**
 * Die Seite „Glossar": Suchfeld oben, Liste links, Erklärung rechts.
 *
 * **Ein Suchfeld über alles.** Wer nachschlägt, weiß nicht, ob das Gesuchte eine
 * Abkürzung, ein Kürzel oder ein Statuswert ist; zwei Suchfelder verlangten
 * genau die Unterscheidung, die man hier erst lernen will.
 *
 * Die Auswahl wird aus den sichtbaren Gruppen ABGELEITET, nicht mitgeführt:
 * verschwindet ein Eintrag beim Weitertippen, schließt sich das Detail von
 * selbst — ohne Effekt, der zwei Zustände synchron hält.
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { MasterDetailLayout } from '@/components/master-detail';
import { GLOSSAR_BEGRIFFE } from '@/core/glossar';
import { GlossarListe } from './GlossarListe';
import { GlossarDetail, GlossarLeer } from './GlossarDetail';
import { begriffAlsEintrag, gruppiere, gesamtZahl, waehleEintrag } from './glossarSuche';

export function GlossarPage(): React.ReactElement {
  const [suche, setSuche] = useState('');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const alle = useMemo(() => GLOSSAR_BEGRIFFE.map(begriffAlsEintrag), []);
  const gruppen = useMemo(() => gruppiere(alle, suche), [alle, suche]);
  const auswahl = waehleEintrag(gruppen, gewaehlt);

  /** Ein Querverweis springt zum Ziel — und holt es zurück in die Sicht. */
  const springeZu = (id: string): void => {
    setSuche('');
    setGewaehlt(id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--tf-border)] px-6 pb-3 pt-5">
        <PageHeader
          title="Glossar"
          subtitle="Nachschlagen, nicht ändern"
          meta={
            <span className="text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
              {gesamtZahl(gruppen)} Einträge
            </span>
          }
          actions={<SeitenHilfeButton pluginId="glossar" />}
        />
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]"
          />
          <Input
            autoFocus
            autoComplete="off"
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="Abkürzung, Begriff, Statuswert oder Kürzel suchen"
            aria-label="Glossar durchsuchen"
            className="h-8 max-w-[420px] pl-7 text-[12.5px]"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <MasterDetailLayout
          listWidthKey="teamflow_glossar_narrow_width"
          onCloseDetail={() => setGewaehlt(null)}
          list={
            <div className="h-full overflow-y-auto">
              <GlossarListe
                gruppen={gruppen}
                gewaehlt={auswahl?.id ?? null}
                onWaehlen={setGewaehlt}
                leerText={`Kein Eintrag zu „${suche.trim()}". Was hier fehlt, fehlt im Glossar — sagen Sie es über „Hilfe → Text stimmt nicht".`}
              />
            </div>
          }
          detail={
            auswahl
              ? <GlossarDetail key={auswahl.id} eintrag={auswahl} onWaehlen={springeZu} />
              : <GlossarLeer />
          }
        />
      </div>
    </div>
  );
}
