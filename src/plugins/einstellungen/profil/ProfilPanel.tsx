/**
 * Seite „Mein Profil" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshots 01/03/04).
 *
 * Links, was du über dich pflegst (Account, Fachprofil), rechts, was daraus
 * folgt (welche Anträge du siehst, welche Module offen sind, was der Assistent
 * mitschreibt). Seit v4.28 ist „Meine Technologien" keine eigene Seite mehr,
 * sondern die Gruppe „Mein Fachprofil" links.
 *
 * Der Zustand des Fachprofils liegt in `useFachprofil` und wird hier EINMAL
 * geholt: „Account" zeigt daraus seine Zusammenfassungszeile, ohne dieselben
 * Daten ein zweites Mal zu laden.
 */
import { Check } from 'lucide-react';
import { isAssistentProtokollEnabled } from '@/config/feature-flags';
import { SettingsKopfStatus, SettingsZweiSpalten } from '@/components/settings';
import { AccountGruppe } from './AccountGruppe';
import { FachprofilGruppe } from './FachprofilGruppe';
import { AntraegeSichtGruppe } from './AntraegeSichtGruppe';
import { ZusatzModuleGruppe } from './ZusatzModuleGruppe';
import { AssistentGruppe } from './AssistentGruppe';
import { useFachprofil } from './useFachprofil';

export function ProfilPanel(): React.ReactElement {
  const fp = useFachprofil();

  return (
    <>
      <SettingsKopfStatus>
        <SpeicherStatus
          speichert={fp.speichert}
          fehler={fp.speicherFehler}
          gespeichertUm={fp.gespeichertUm}
        />
      </SettingsKopfStatus>

      <SettingsZweiSpalten
        haupt={
          <>
            <AccountGruppe
              anonId={fp.anonId}
              hauptKategorie={fp.hauptKategorie}
              antragstypen={fp.antragstypBevorzugt}
            />
            <FachprofilGruppe fp={fp} />
          </>
        }
        neben={
          <>
            <AntraegeSichtGruppe />
            <ZusatzModuleGruppe />
            {isAssistentProtokollEnabled() && <AssistentGruppe />}
          </>
        }
      />
    </>
  );
}

/**
 * Speicher-Zustand rechts im Seitenkopf. Zeigt den ECHTEN Zustand des
 * Fachprofil-Auto-Saves: läuft er, ist er gescheitert, wann lief er zuletzt.
 * Vor dem ersten Schreiben steht dort die Zusage „Automatisch gespeichert" —
 * sie beschreibt dann das Verhalten, nicht ein Ergebnis.
 */
function SpeicherStatus({
  speichert,
  fehler,
  gespeichertUm,
}: {
  speichert: boolean;
  fehler: string | null;
  gespeichertUm: string | null;
}): React.ReactElement {
  if (speichert) {
    return <span className="text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap">Speichert…</span>;
  }
  if (fehler) {
    return (
      <span
        className="inline-block rounded-[var(--tf-radius)] px-2.5 py-1.5 text-[12px] leading-[1.5] max-w-[24rem]"
        style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}
      >
        {fehler}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
      <Check size={12} strokeWidth={2} />
      {gespeichertUm
        ? `Gespeichert ${new Date(gespeichertUm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
        : 'Automatisch gespeichert'}
    </span>
  );
}
