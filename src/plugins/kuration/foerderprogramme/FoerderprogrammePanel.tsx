/**
 * Panel „Förderprogramme" — bis v4.35 zwei eigene Seiten (`/kuration/programme`
 * und `/kuration/filter`).
 *
 * Sie gehoeren zusammen, weil sie an derselben Voraussetzung haengen: alle drei
 * Bestaende gelten fuer das AKTIVE Programm. Die Filterseite nannte es
 * ueberhaupt nicht, obwohl ihre Liste daran haengt; jetzt steht es in der
 * Unterzeile jeder Gruppe, die daran haengt.
 *
 * Bis v4.40 hiess das Panel „Verzeichnisse" — ein Wort, das in dieser App die
 * Ordner auf der Platte meint (Dokumentenquellen, verbundene Verzeichnisse).
 * Hier geht es um Foerderprogramme, nicht um Ablage.
 *
 * BEWUSST einspaltig (`SettingsZweiSpalten` ohne `neben`): das Panel besteht aus
 * drei Listen, eine davon eine Tabelle mit sechs Spalten. Die haetten in der
 * 1.32fr-Hauptspalte dauerhaft quer scrollen muessen, damit daneben eine
 * Kennzahlen-Karte steht, die nichts sagt, was die Listen nicht selbst zeigen.
 */
import { SettingsZweiSpalten } from '@/components/settings';
import { useProgrammBestand } from './useProgrammBestand';
import { ProgrammeGruppe } from './programme/ProgrammeGruppe';
import { UnterprogrammeGruppe } from './programme/unterprogramme/UnterprogrammeGruppe';
import { FilterGruppe } from './filter/FilterGruppe';

export function FoerderprogrammePanel(): React.ReactElement {
  const bestand = useProgrammBestand();
  const { aktives, activeProgrammId } = bestand;

  return (
    <SettingsZweiSpalten
      haupt={
        <>
          <ProgrammeGruppe bestand={bestand} />

          {activeProgrammId ? (
            <UnterprogrammeGruppe
              key={activeProgrammId}
              programmId={activeProgrammId}
              programmName={aktives?.name}
            />
          ) : null}

          <FilterGruppe programmName={aktives?.name} />
        </>
      }
    />
  );
}
