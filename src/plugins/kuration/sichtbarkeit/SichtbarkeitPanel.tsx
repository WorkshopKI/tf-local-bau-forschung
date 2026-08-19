/**
 * „Beta & Expertenmodus" — hier legt die Kuration fest, was nur mit
 * eingeschaltetem Schalter erscheint.
 *
 * Zwei Marken je Zeile statt eines Vierfach-Wählers: Reife (`Beta`) und
 * Zielgruppe (`Experte`) sind zwei Aussagen, keine vier Zustände. Die
 * Kombination liest sich dann von selbst — „neu und für Profis" ist beides
 * angehakt, nicht ein eigener Eintrag in einer Liste.
 *
 * Gespeichert werden nur ABWEICHUNGEN von der Code-Vorbelegung
 * (`_intern/sichtbarkeit.json`); deshalb hat jede geänderte Zeile ein „Vorgabe"
 * daneben und die Kopfzeile ein globales Zurücksetzen. Geschrieben wird auf den
 * Daten-Share, also gated über `canWriteDatenShare()` (Pitfall #25) und
 * `requireOnline()`.
 */
import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { canWriteDatenShare } from '@/config/feature-flags';
import {
  SICHTBARKEITS_KATALOG, baueIndex, bilanziere, effektiveMarken, markenGleich,
  useSichtbarkeitStore, type KatalogEintrag, type Marken,
} from '@/core/sichtbarkeit';
import { SettingsGruppe, SettingsKlappe, SettingsOption, SettingsZweiSpalten } from '@/components/settings';

const INDEX = baueIndex(SICHTBARKEITS_KATALOG);

const ART_WORT: Record<KatalogEintrag['art'], string> = {
  seite: 'Seite',
  reiter: 'Reiter',
  abschnitt: 'Abschnitt',
  widget: 'Widget',
};

/** Reiter vor Abschnitten, Seite immer zuerst — die Zeile liest sich als Weg. */
const ART_RANG: Record<KatalogEintrag['art'], number> = {
  seite: 0, reiter: 1, abschnitt: 2, widget: 3,
};

interface Gruppe {
  key: string;
  titel: string;
  eintraege: KatalogEintrag[];
}

/**
 * Ein Kasten je Seite, plus einer für die Startseiten-Widgets.
 *
 * Die Widgets tragen `seite: 'home'`, stehen aber bewusst getrennt: sie haben
 * eine eigene Verwaltung und eine persönliche Anordnung, und in der Home-Gruppe
 * verschwänden sechzehn Zeilen hinter zwei.
 */
function baueGruppen(): Gruppe[] {
  const seiten = SICHTBARKEITS_KATALOG.filter(e => e.art === 'seite');
  const gruppen: Gruppe[] = seiten.map(s => ({
    key: s.seite,
    titel: s.label,
    eintraege: SICHTBARKEITS_KATALOG
      .filter(e => e.seite === s.seite && e.art !== 'widget')
      .sort((a, b) => ART_RANG[a.art] - ART_RANG[b.art]),
  }));
  const widgets = SICHTBARKEITS_KATALOG.filter(e => e.art === 'widget');
  if (widgets.length > 0) {
    gruppen.push({ key: '__widgets', titel: 'Startseiten-Widgets', eintraege: widgets });
  }
  return gruppen;
}

export function SichtbarkeitPanel(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const { requireOnline } = useSmbStatus();
  const overlay = useSichtbarkeitStore(s => s.overlay);
  const setzeMarken = useSichtbarkeitStore(s => s.setzeMarken);
  const zuruecksetzen = useSichtbarkeitStore(s => s.zuruecksetzen);
  const alleZuruecksetzen = useSichtbarkeitStore(s => s.alleZuruecksetzen);

  const isKurator = !!(profile?.is_kurator ?? profile?.is_admin);
  const canWrite = canWriteDatenShare(isKurator);
  const autor = profile?.name;

  const gruppen = useMemo(baueGruppen, []);
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
        <>
          {gruppen.map(g => (
            <SettingsGruppe key={g.key} titel={g.titel}>
              {g.eintraege.map(e => (
                <Zeile
                  key={e.id}
                  eintrag={e}
                  gilt={effektiveMarken(e.id, INDEX, overlay)}
                  canWrite={canWrite}
                  onSetze={marken => setze(e.id, marken)}
                  onVorgabe={() => schreiben.run(() => zuruecksetzen(storage.idb, e.id, autor))}
                />
              ))}
            </SettingsGruppe>
          ))}
        </>
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
              dann keine eigene Marke. Gesperrte Zeilen sind die Wege zu den Schaltern
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

function Zeile({
  eintrag, gilt, canWrite, onSetze, onVorgabe,
}: {
  eintrag: KatalogEintrag;
  gilt: Marken;
  canWrite: boolean;
  onSetze: (marken: Marken) => void;
  onVorgabe: () => void;
}): React.ReactElement {
  const abweichend = !markenGleich(gilt, eintrag.marken);
  const gesperrt = eintrag.unantastbar === true || !canWrite;
  const grund = eintrag.unantastbar
    ? 'Über diesen Weg erreicht man die Schalter selbst — er bleibt immer sichtbar.'
    : !canWrite
      ? 'Nur mit aktiver Kurator-Sitzung änderbar.'
      : undefined;

  return (
    <SettingsOption
      label={eintrag.label}
      gesperrt={eintrag.unantastbar === true}
      kurzzeile={
        <span className="inline-flex items-center gap-2">
          <span>{ART_WORT[eintrag.art]}</span>
          {abweichend && (
            <button
              type="button"
              className="text-[var(--tf-primary)] hover:underline cursor-pointer"
              onClick={onVorgabe}
              title={`Vorgabe: ${beschreibe(eintrag.marken)}`}
            >
              zurück auf Vorgabe ({beschreibe(eintrag.marken)})
            </button>
          )}
        </span>
      }
    >
      <span className="inline-flex items-center gap-1.5">
        <ToggleChip
          form="marke"
          label="Beta"
          selected={gilt.beta === true}
          disabled={gesperrt}
          title={grund ?? 'In Erprobung — kann sich noch ändern'}
          onToggle={() => onSetze(umschalten(gilt, 'beta'))}
        />
        <ToggleChip
          form="marke"
          label="Experte"
          selected={gilt.experte === true}
          disabled={gesperrt}
          title={grund ?? 'Selten gebrauchtes Tiefen-Werkzeug'}
          onToggle={() => onSetze(umschalten(gilt, 'experte'))}
        />
      </span>
    </SettingsOption>
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
