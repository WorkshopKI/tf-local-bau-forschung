/**
 * „Beta & Expertenmodus" — hier legt die Kuration fest, was nur mit
 * eingeschaltetem Schalter erscheint.
 *
 * **Ein Baum, keine Liste** (v4.115): 192 Zeilen in 21 Kästen hießen, an
 * neunzig Zeilen vorbeizuscrollen, um eine zu finden. Zugeklappt sind es 21
 * Zeilen; die Seite trägt ihre eigenen Marken und ist zugleich der Ordner ihrer
 * Reiter, Abschnitte und Karten. An einer zugeklappten Seite steht, wie viel
 * darunter markiert ist — sonst müsste man jede öffnen, um das zu sehen.
 *
 * Zwei Marken je Zeile statt eines Vierfach-Wählers: Reife (`Beta`) und
 * Zielgruppe (`Experte`) sind zwei Aussagen, keine vier Zustände.
 *
 * Gespeichert werden nur ABWEICHUNGEN von der Code-Vorbelegung
 * (`_intern/sichtbarkeit.json`); deshalb hat jede geänderte Zeile ein
 * Rückstell-Zeichen und die Nebenspalte ein globales Zurücksetzen. Geschrieben
 * wird auf den Daten-Share, also gated über `canWriteDatenShare()`
 * (Pitfall #25) und `requireOnline()`.
 */
import { useMemo, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Lock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { TfTree, type TfTreeNodeRenderProps } from '@/components/tree';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { canWriteDatenShare } from '@/config/feature-flags';
import {
  SICHTBARKEITS_KATALOG, baueIndex, bilanziere, effektiveMarken, istMarkiert, markenGleich,
  useSichtbarkeitStore, type KatalogEintrag, type Marken,
} from '@/core/sichtbarkeit';
import { SettingsGruppe, SettingsKlappe, SettingsOption, SettingsZweiSpalten } from '@/components/settings';
import {
  baueSichtbarkeitsBaum, kinderEintraege, type SichtbarkeitsKnoten,
} from './sichtbarkeitBaum';

const INDEX = baueIndex(SICHTBARKEITS_KATALOG);
const BAUM = baueSichtbarkeitsBaum(SICHTBARKEITS_KATALOG);

const ART_WORT: Record<KatalogEintrag['art'], string> = {
  seite: 'Seite',
  reiter: 'Reiter',
  abschnitt: 'Abschnitt',
  widget: 'Widget',
};

/**
 * Der An-Zustand trägt Fläche, nicht nur einen etwas kräftigeren Rand.
 *
 * **Beta** nimmt die Farbe des Abzeichens, das es erzeugt (`Badge variant="info"`
 * in `BetaBadge`) — die Leiste ist damit ihre eigene Legende. **Experte** erzeugt
 * kein Abzeichen und hat deshalb keine Farbe zu borgen; es nimmt die neutrale
 * Vollfüllung. Der Aus-Zustand bleibt in beiden Fällen ein bloßer Umriss, und
 * genau dieser Sprung fehlte vorher: getönte Fläche gegen `bg-secondary` war auf
 * dem Schirm kaum zu unterscheiden.
 */
const BETA_TONUNG = { text: 'var(--tf-info-text)', flaeche: 'var(--tf-info-bg)' } as const;

export function SichtbarkeitPanel(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const session = useKuratorSession();
  const { requireOnline } = useSmbStatus();
  const overlay = useSichtbarkeitStore(s => s.overlay);
  const setzeMarken = useSichtbarkeitStore(s => s.setzeMarken);
  const zuruecksetzen = useSichtbarkeitStore(s => s.zuruecksetzen);
  const alleZuruecksetzen = useSichtbarkeitStore(s => s.alleZuruecksetzen);

  const isKurator = !!(profile?.is_kurator ?? profile?.is_admin);
  /**
   * Warum gerade nicht geschrieben werden kann — oder `null`, wenn es geht.
   *
   * Die SITZUNG gehört mit in die Bedingung: `canWriteDatenShare()` fragt nur
   * nach Kurator-Recht bzw. `datenShareSchreibrecht`, und `schreibeSidecar`
   * prüft nur Handle + Berechtigung. Bis v4.119 blieben die Marken deshalb bei
   * gesperrter Sitzung bedienbar und schrieben weiter team-weit nach
   * `_intern/sichtbarkeit.json` — während der Seitenkopf „nur lesbar"
   * versprach und der Tooltip einen Grund nannte, den der Code nie abfragte.
   */
  const schreibSperre: string | null = !canWriteDatenShare(isKurator)
    ? 'Nur mit Kurator-Schreibrecht änderbar.'
    : !session.isActive
      ? 'Nur mit aktiver Kurator-Sitzung änderbar.'
      : null;
  const canWrite = schreibSperre === null;
  const autor = profile?.name;

  // Zugeklappt starten: der Überblick ist der Zweck der Seite, nicht die
  // einzelne Zeile.
  const [offen, setOffen] = useState<string[]>([]);
  const alleOffen = offen.length >= BAUM.ordnerIds.length;

  const bilanz = useMemo(() => bilanziere(SICHTBARKEITS_KATALOG, overlay), [overlay]);

  const schreiben = useAsyncAction(async (fn: () => Promise<boolean>) => {
    requireOnline();
    const ok = await fn();
    if (!ok) throw new Error('Konnte nicht auf den Daten-Share schreiben — Berechtigung oder Verbindung prüfen.');
  });

  const setze = (id: string, marken: Marken): void => {
    schreiben.run(() => setzeMarken(storage.idb, id, marken, autor));
  };

  return (
    <SettingsZweiSpalten
      haupt={
        <SettingsGruppe
          titel="Katalog"
          unterzeile="Eine Seite nimmt ihre Reiter, Abschnitte und Karten mit — die brauchen dann keine eigene Marke."
          aktion={
            <Button
              variant="ghost"
              size="sm"
              icon={alleOffen ? ChevronsDownUp : ChevronsUpDown}
              onClick={() => setOffen(alleOffen ? [] : [...BAUM.ordnerIds])}
            >
              {alleOffen ? 'Alles zuklappen' : 'Alles aufklappen'}
            </Button>
          }
        >
          <TfTree<SichtbarkeitsKnoten>
            items={BAUM.items}
            rootId={BAUM.rootId}
            label="Sichtbarkeits-Katalog"
            className="max-h-[68vh] overflow-y-auto pr-1"
            expandedItems={offen}
            onExpandedChange={setOffen}
            slots={{
              label: p => <Beschriftung p={p} />,
              trailing: p => (
                <Rechts
                  p={p}
                  offen={offen.includes(p.id)}
                  overlay={overlay}
                  schreibSperre={schreibSperre}
                  busy={schreiben.busy}
                  onSetze={setze}
                  onVorgabe={id => schreiben.run(() => zuruecksetzen(storage.idb, id, autor))}
                />
              ),
            }}
          />
        </SettingsGruppe>
      }
      neben={
        <>
          <SettingsGruppe
            id="sec-sichtbarkeit"
            titel="Beta & Expertenmodus"
            unterzeile="Gilt team-weit. Jeder entscheidet selbst, ob er die Schalter umlegt."
          >
            <SettingsOption
              label="Standard"
              kurzzeile="Sieht jeder, ohne einen Schalter umzulegen"
            >
              <Zahl wert={bilanz.standard} />
            </SettingsOption>
            {/* Die Kurzzeilen stehen als Ausdruck, nicht als Attribut-Literal:
                das deutsche Schlusszeichen beendet sonst das JSX-Attribut. */}
            <SettingsOption label="Nur Beta" kurzzeile={'Braucht „Beta-Funktionen“'}>
              <Zahl wert={bilanz.nurBeta} />
            </SettingsOption>
            <SettingsOption label="Nur Experte" kurzzeile={'Braucht „Expertenmodus“'}>
              <Zahl wert={bilanz.nurExperte} />
            </SettingsOption>
            <SettingsOption label="Beides" kurzzeile="Braucht beide Schalter">
              <Zahl wert={bilanz.beides} />
            </SettingsOption>
          </SettingsGruppe>

          <SettingsGruppe titel="Zurücksetzen">
            <SettingsOption
              label="Alles auf Vorgabe"
              kurzzeile={
                anzahlAbweichungen(overlay) === 0
                  ? 'Zurzeit weicht nichts von der Vorgabe ab'
                  : `${anzahlAbweichungen(overlay)} Abweichung(en) verwerfen`
              }
            >
              <Button
                variant="secondary"
                size="sm"
                icon={RotateCcw}
                disabled={!canWrite || schreiben.busy || anzahlAbweichungen(overlay) === 0}
                onClick={() => schreiben.run(() => alleZuruecksetzen(storage.idb, autor))}
              >
                Zurücksetzen
              </Button>
            </SettingsOption>
            {schreiben.error != null && (
              <SettingsOption label="Fehler" kurzzeile={String(schreiben.error)}>
                <span />
              </SettingsOption>
            )}
          </SettingsGruppe>

          <SettingsKlappe
            id="sec-sichtbarkeit-hilfe"
            label="Wie das gemeint ist"
            storageKey="kuration_sichtbarkeit_hilfe"
          >
            <p className="text-[12.5px] leading-[1.55] text-[var(--tf-text-secondary)]">
              <strong>Beta</strong> heißt: funktioniert, kann sich aber noch ändern.
              <strong> Experte</strong> heißt: ausgereift, aber selten gebraucht.
              Beides angehakt heißt <em>neu und tief</em> — dann müssen auch beide
              Schalter im Profil an sein.
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--tf-text-secondary)]">
              Eine markierte Seite nimmt ihre Reiter und Abschnitte mit; die brauchen
              dann keine eigene Marke. Zeilen mit Schloss sind die Wege zu den Schaltern
              selbst — wären sie ausblendbar, gäbe es keinen Rückweg.
            </p>
          </SettingsKlappe>
        </>
      }
    />
  );
}

function Zahl({ wert }: { wert: number }): React.ReactElement {
  return (
    <span className="text-[13.5px] tabular-nums text-[var(--tf-text)]">{wert}</span>
  );
}

function anzahlAbweichungen(overlay: ReadonlyMap<string, Marken>): number {
  let n = 0;
  for (const [id, marken] of overlay) {
    const eintrag = INDEX.get(id);
    if (eintrag && !markenGleich(marken, eintrag.marken)) n++;
  }
  return n;
}

/** Beschriftung + Art als leiser Zusatz — der Einzug allein sagt nicht, WAS die Zeile ist. */
function Beschriftung({ p }: { p: TfTreeNodeRenderProps<SichtbarkeitsKnoten> }): React.ReactElement {
  const daten = p.data;
  if (daten.art !== 'eintrag') {
    return <span className="min-w-0 truncate text-[12.5px] font-medium text-[var(--tf-text)]">{p.name}</span>;
  }
  const e = daten.eintrag;
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span
        className={`min-w-0 truncate text-[12.5px] ${
          e.art === 'seite' ? 'font-medium text-[var(--tf-text)]' : 'text-[var(--tf-text)]'
        }`}
      >
        {e.label}
      </span>
      <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">{ART_WORT[e.art]}</span>
      {e.unantastbar === true && (
        <Lock
          size={11}
          className="shrink-0 text-[var(--tf-text-tertiary)]"
          aria-label="Immer sichtbar"
        />
      )}
    </span>
  );
}

/**
 * Rechte Seite der Zeile: die beiden Marken, das Rückstell-Zeichen — und an
 * einem ZUGEKLAPPTEN Ordner, wie viel darunter markiert ist.
 *
 * Interaktive Elemente hier brauchen `stopPropagation`, sonst klappt der
 * Zeilen-Klick den Zweig auf (tree-komponenten.md).
 */
function Rechts({
  p, offen, overlay, schreibSperre, busy, onSetze, onVorgabe,
}: {
  p: TfTreeNodeRenderProps<SichtbarkeitsKnoten>;
  offen: boolean;
  overlay: ReadonlyMap<string, Marken>;
  /** Warum gerade nicht geschrieben werden kann — `null`, wenn es geht. */
  schreibSperre: string | null;
  /**
   * Läuft gerade ein Schreibvorgang? ALLE Zeilen teilen sich eine
   * `useAsyncAction`, und deren `run()` verwirft einen zweiten Lauf stumm
   * (`if (busyRef.current) return;`). Ohne diese Sperre verschwand der zweite
   * Klick ohne Fehler, ohne Busy-Zeichen und ohne Marken-Wechsel (v4.119).
   */
  busy: boolean;
  onSetze: (id: string, marken: Marken) => void;
  onVorgabe: (id: string) => void;
}): React.ReactElement | null {
  const daten = p.data;
  const zusammenfassung = p.isFolder && !offen
    ? markiertDarunter(p.id, overlay)
    : null;

  if (daten.art !== 'eintrag') {
    return zusammenfassung;
  }

  const e = daten.eintrag;
  const gilt = effektiveMarken(e.id, INDEX, overlay);
  const abweichend = !markenGleich(gilt, e.marken);
  const gesperrt = e.unantastbar === true || schreibSperre !== null || busy;
  const grund = e.unantastbar
    ? 'Über diesen Weg erreicht man die Schalter selbst — er bleibt immer sichtbar.'
    : schreibSperre !== null
      ? schreibSperre
      : busy
        ? 'Wird gespeichert …'
        : undefined;

  return (
    <span
      className="flex shrink-0 items-center gap-1.5"
      onClick={ev => ev.stopPropagation()}
      role="presentation"
    >
      {zusammenfassung}
      {abweichend && (
        <button
          type="button"
          disabled={gesperrt}
          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[5px]
            text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] cursor-pointer
            disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
          onClick={() => onVorgabe(e.id)}
          title={grund ?? `Zurück auf die Vorgabe: ${beschreibe(e.marken)}`}
          aria-label={`Zurück auf die Vorgabe: ${beschreibe(e.marken)}`}
        >
          <RotateCcw size={12} />
        </button>
      )}
      <ToggleChip
        form="marke"
        label="Beta"
        selected={gilt.beta === true}
        disabled={gesperrt}
        tonung={BETA_TONUNG}
        title={grund ?? 'In Erprobung — kann sich noch ändern'}
        onToggle={() => onSetze(e.id, umschalten(gilt, 'beta'))}
      />
      <ToggleChip
        form="marke"
        label="Experte"
        variant="dark"
        selected={gilt.experte === true}
        disabled={gesperrt}
        title={grund ?? 'Selten gebrauchtes Tiefen-Werkzeug'}
        onToggle={() => onSetze(e.id, umschalten(gilt, 'experte'))}
      />
    </span>
  );
}

/**
 * „3 markiert" an der zugeklappten Seite. Ohne sie müsste man jede der 21
 * Seiten öffnen, um zu sehen, wo überhaupt etwas steht — und genau das Scrollen
 * sollte der Baum abschaffen.
 */
function markiertDarunter(
  ordnerId: string, overlay: ReadonlyMap<string, Marken>,
): React.ReactElement | null {
  const kinder = kinderEintraege(BAUM, ordnerId);
  const n = kinder.filter(k => istMarkiert(effektiveMarken(k.id, INDEX, overlay))).length;
  if (n === 0) return null;
  return (
    <span
      className="shrink-0 text-[11px] tabular-nums text-[var(--tf-text-tertiary)]"
      title={`${n} von ${kinder.length} Einträgen darunter tragen eine Marke`}
    >
      {n} markiert
    </span>
  );
}

function umschalten(marken: Marken, welche: 'beta' | 'experte'): Marken {
  const neu: Marken = { ...marken };
  if (neu[welche]) delete neu[welche];
  else neu[welche] = true;
  return neu;
}

function beschreibe(marken: Marken): string {
  if (marken.beta && marken.experte) return 'Beta + Experte';
  if (marken.beta) return 'Beta';
  if (marken.experte) return 'Experte';
  return 'Standard';
}
