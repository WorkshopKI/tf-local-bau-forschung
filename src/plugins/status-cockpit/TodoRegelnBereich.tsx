/**
 * Die **To-do-Kaskade** pflegen — der geteilte Ersatz für die WENN-Formeln der
 * AB-Mappe.
 *
 * Jede Regel steht als deutscher Satz da: „WENN … DANN «…», zuständig AB". Wer
 * eine Regel lesen kann, kann sie prüfen — und darum geht es, denn die Kaskade
 * ersetzt eine Rechnung, die bisher nur eine Person überblickte.
 *
 * **Zwei Gestalten, ein Reiter.** Ohne Auswahl liegt die Kaskade als Karten über
 * die volle Breite; wer eine Regel öffnet, bekommt links die schlanke Auswahl
 * und rechts den Editor ([MasterDetailLayout](@/components/master-detail)) — die
 * Reihenfolge IST das Ergebnis, und sie bleibt beim Bearbeiten sichtbar. Bis
 * v2.404 klappte der Editor stattdessen IN der Karte auf und schob alle
 * folgenden Regeln nach unten.
 *
 * Dieser Bereich hält nur noch den Zustand (Regelsatz, Auswahl) und die
 * abgeleiteten Mengen; die Gestalten wohnen in eigenen Dateien, das prüfbare
 * Ansichts-Modell in [todoRegelnAnsicht.ts](./todoRegelnAnsicht.ts).
 */
import { useMemo, useState } from 'react';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { MasterDetailLayout } from '@/components/master-detail';
import {
  ROLLEN, ROLLE_LABEL, ROLLE_LANG, bedingungFeldRefs, referenzierbareFelder,
  regelsatzVon, REGELSATZ_DEFAULT,
  type MappingVersion, type Rolle,
} from '@/core/status';
import { baueTodoFeldVorrat } from './todoFeldVorrat';
import { TodoRegelListe } from './TodoRegelListe';
import { TodoRegelDetail } from './TodoRegelDetail';
import {
  ROLLOUT_HINWEIS, sichtbareRegeln, waehleRegel, type TodoRegelnApi,
} from './todoRegelnAnsicht';
import type { PlatzhalterLauf } from './usePlatzhalterErhebung';
import type { WirkungsLauf } from './useRegelWirkung';
import type { ProbeLauf } from './useRegelProbelauf';
import type { TerminLauf } from './useTerminErhebung';

export type { TodoRegelnApi } from './todoRegelnAnsicht';

export function TodoRegelnBereich({
  version, api, platzhalter, onExportieren, satz, onSatzWechsel, wirkung, probe,
  termin, zieltageBeantragt, zieltageGepflegt,
}: {
  version: MappingVersion;
  api: TodoRegelnApi;
  platzhalter: PlatzhalterLauf;
  /** Erhebung als XLSX + Markdown herunterladen — schreibrechtsunabhängig. */
  onExportieren: (rolle: Rolle) => void;
  /** Der gezeigte Regelsatz. Liegt im Tab, weil der Wirkungs-Lauf ihn braucht. */
  satz: Rolle;
  onSatzWechsel: (r: Rolle) => void;
  wirkung: WirkungsLauf;
  probe: ProbeLauf;
  termin: TerminLauf;
  zieltageBeantragt: { median: number; n: number } | null;
  zieltageGepflegt: number | null;
}): React.ReactElement {
  const alleRegeln = version.todoRegeln ?? [];
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  // Sichtbar sind AB und FB immer — sie sind die beiden Achsen, um die es geht.
  // Weitere Rollen erscheinen erst, wenn für sie etwas existiert; eine leere
  // Juristen-Kaskade wäre ein Tab, der nie etwas zu sagen hat.
  const saetze = useMemo(() => {
    const belegt = new Set<Rolle>(alleRegeln.filter(r => (r.sperrt?.length ?? 0) === 0).map(regelsatzVon));
    return ROLLEN.filter(r => r === 'ab' || r === 'fb' || belegt.has(r));
  }, [alleRegeln]);
  const regeln = useMemo(() => sichtbareRegeln(alleRegeln, satz), [alleRegeln, satz]);
  const eigeneRegeln = regeln.filter(r => (r.sperrt?.length ?? 0) === 0);
  const aktiveEigene = eigeneRegeln.filter(r => r.aktiv).length;
  const vorrat = useMemo(() => baueTodoFeldVorrat(version.felder), [version.felder]);
  const pruefeFeld = useMemo(() => {
    const erlaubt = referenzierbareFelder(version.felder);
    return (feldId: string): string | null => erlaubt.has(feldId)
      ? null
      : `„${feldId}" steht nicht im Katalog — diese Bedingung träfe nie zu.`;
  }, [version.felder]);
  // Einmal je Fassung statt einmal je Karte je Render: die Liste rendert beim
  // Tippen im Detail mit, und `bedingungFeldRefs` läuft rekursiv über den Baum.
  const unbekannteJeRegel = useMemo(
    () => new Map<string, readonly string[]>(regeln.map(
      r => [r.id, bedingungFeldRefs(r.bedingung).filter(f => pruefeFeld(f) !== null)],
    )),
    [regeln, pruefeFeld],
  );
  // Auswahl ABLEITEN statt synchronisieren: verschwindet die Regel (Fassung neu
  // geladen, Entwurf verworfen, Satz gewechselt), schließt sich das Detail von
  // selbst — kein `useEffect`, der dem Render hinterherräumt.
  const auswahl = waehleRegel(regeln, gewaehlt);

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="shrink-0 flex flex-col gap-2">
        {/* Keine Überschrift „To-do-Regeln" mehr: seit v2.412 heißt der Reiter
            darüber genauso und trägt dieselbe Zahl — zwei Zeilen Abstand, Wort
            für Wort dasselbe. Die Regelsatz-Pills gleich darunter sagen, was
            man hier wirklich wissen will. */}

        {/* Je Rolle ein Regelsatz — ausgewertet wird immer genau einer. Die
            Auswahl fällt beim Wechsel: eine Sperre überlebte ihn technisch,
            aber ihre Pfeile würden im fremden Satz stumm. */}
        <ScopeTabs
          variant="pills"
          aria-label="Regelsatz"
          activeKey={satz}
          onChange={(k: string) => { onSatzWechsel(k as Rolle); setGewaehlt(null); }}
          items={saetze.map(r => ({
            key: r,
            label: ROLLE_LABEL[r],
            title: ROLLE_LANG[r],
            count: alleRegeln.filter(x => (x.sperrt?.length ?? 0) === 0 && regelsatzVon(x) === r).length,
          }))}
        />

        {/* Steht dauerhaft da, nicht nur beim Aktivieren: wer den Tab öffnet, soll
            wissen, warum hier alles stillgelegt ist. */}
        {satz !== REGELSATZ_DEFAULT && (
          <p className="text-[11.5px] text-[var(--tf-warning-text)]">{ROLLOUT_HINWEIS}</p>
        )}

        {/* Der `aktiv: false`-Default beim Anlegen und die Rückfrage beim
            Umschalten decken die beiden Wege ab, die durch diesen Editor führen —
            nicht aber den Katalog-IMPORT: eine eingelesene Fassung bringt ihre
            `aktiv`-Flags mit, ohne je einen Dialog zu sehen. Deshalb hier eine
            Feststellung über den ZUSTAND statt über den Weg. */}
        {satz !== REGELSATZ_DEFAULT && aktiveEigene > 0 && (
          <p className="text-[11.5px] text-[var(--tf-warning-text)]">
            ⚠ {aktiveEigene === 1 ? 'Eine Regel dieses Satzes ist' : `${aktiveEigene} Regeln dieses Satzes sind`}
            {' '}<strong>aktiv</strong> und wirkt damit in jeder Installation — auch in denen, die den
            Regelsatz noch nicht kennen und sie als AB-Regel werten.
          </p>
        )}
      </div>

      <MasterDetailLayout
        listWidthKey="teamflow_status_todo_narrow_width"
        onCloseDetail={() => setGewaehlt(null)}
        list={
          <TodoRegelListe
            regeln={regeln} eigeneRegeln={eigeneRegeln} version={version} satz={satz} api={api}
            platzhalter={platzhalter} onExportieren={onExportieren} wirkung={wirkung} probe={probe}
            termin={termin} zieltageBeantragt={zieltageBeantragt}
            zieltageGepflegt={zieltageGepflegt}
            gewaehlt={auswahl?.regel.id ?? null} onWaehlen={setGewaehlt}
            unbekannteJeRegel={unbekannteJeRegel}
          />
        }
        detail={auswahl && (
          <TodoRegelDetail
            key={auswahl.regel.id}
            r={auswahl.regel} version={version} index={auswahl.index} anzahl={auswahl.anzahl}
            satz={satz} api={api} vorrat={vorrat} pruefeFeld={pruefeFeld}
            unbekannte={unbekannteJeRegel.get(auswahl.regel.id) ?? []}
            wirkung={wirkung.wirkung?.get(auswahl.regel.id)} veraltet={wirkung.veraltet}
            onSchliessen={() => setGewaehlt(null)}
          />
        )}
      />
    </section>
  );
}
