/**
 * Gruppe „Mein Fachprofil" — bis v4.27 die eigene Seite „Meine Technologien"
 * (Design-Handoff `_design/handoff/einstellungen-zweispaltig`, Screenshot 01/03).
 *
 * Drei Auswahl-Blöcke offen (Hauptkategorie, Ergänzende Erfahrungen,
 * Antragstypen), das Seltene eingeklappt mit Zähler: „Themen aus deinen
 * Anträgen · 8 von 28 aktiv" und „Eigene Kompetenzen · 3 Begriffe".
 *
 * Zustand + Speichern liegen in `useFachprofil` — hier steht nur Darstellung.
 */
import { useState } from 'react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { TechChipInput } from '@/plugins/auslastung/components/TechChipInput';
import { truncateWZ } from '@/plugins/auslastung/components/AutoTagToggleWand';
import { hasPlOverride } from '@/plugins/auslastung/services/kapazitaet';
import { ALL_ANTRAGSTYP_BUCKETS } from '@/plugins/auslastung/types';
import { computeAutoTagVisibility } from '../autoTagVisibility';
import {
  SettingsBlock,
  SettingsGruppe,
  SettingsKlappe,
  SettingsLeer,
} from '@/components/settings';
import type { Fachprofil } from './useFachprofil';

const TOOLTIP_GRUPPE =
  'Steuert, welche Anträge dir auf der Startseite und im Matching vorgeschlagen werden. Die Angaben sind im Team-Auslastungs-Profil sichtbar — unter deiner anonymen Programm-Id, nicht unter deinem Namen.';
const TOOLTIP_HAUPT =
  'Bestimmt, in welchem Pool du für die Selbsteintragung und die Top-3-Vorschläge landest. Genau eine Kategorie — das Kernthema deiner Antragsbearbeitung.';
const TOOLTIP_NEBEN =
  'Bei Anträgen mit diesen Aspekten als Querschnittstechnologie wirst du bevorzugt vorgeschlagen. Mehrere möglich.';
const TOOLTIP_ANTRAGSTYP =
  'Welche Antragstypen bearbeitest du grundsätzlich? Nichts ausgewählt = alle. Sonst zeigen Startseite und Matching nur Anträge dieser Typen.';
const TOOLTIP_AUTO =
  'Automatisch aus deinen bisherigen Anträgen abgeleitet (TECHN_*-Spalten und Zukunftstechnologien). Nicht zutreffende Themen kannst du per Klick ausblenden — sie verschwinden dann aus deinem Team-Profil. Aktualisiert sich beim nächsten Import.';
const TOOLTIP_MANUAL =
  'Frei eingegebene Stichworte ergänzen die automatische Erkennung. Sichtbar im Team-Auslastungs-Profil.';

const MAX_CHIPS = 20;
const MAX_CHIP_LEN = 60;
/** Ungewählte Themen werden auf diese Gesamtzahl gekürzt, Rest hinter „+ N weitere". */
const AUTO_TAG_CAP = 10;

export function FachprofilGruppe({ fp }: { fp: Fachprofil }): React.ReactElement {
  const aktiveThemen = fp.autoTags.filter(t => !fp.ausgeblendeteAutoTags.includes(t)).length;

  return (
    <SettingsGruppe
      titel="Mein Fachprofil"
      hint={TOOLTIP_GRUPPE}
      unterzeile="Bestimmt, welche Anträge dir vorgeschlagen werden."
      rechts="team-weit sichtbar"
    >
      {!fp.anonId ? (
        <SettingsLeer>
          Bearbeiter-Kürzel rechts unter „Welche Anträge du siehst" hinterlegen — dann erscheint
          hier dein Fachprofil.
        </SettingsLeer>
      ) : (
        <>
          <SettingsBlock
            id="sec-kategorien"
            label="Hauptkategorie"
            zusatz="ein Bereich"
            hint={TOOLTIP_HAUPT}
          >
            <div className="flex flex-wrap gap-1.5">
              {fp.kategorien.map(k => {
                const istHaupt = fp.hauptKategorie === k.id;
                return (
                  <ToggleChip
                    key={k.id}
                    label={k.id}
                    selected={istHaupt}
                    variant="dark"
                    onToggle={() => { if (!istHaupt) fp.setzeHaupt(k.id); }}
                    title={istHaupt ? `${k.name} (aktuelle Hauptkategorie)` : `${k.name} als Hauptkategorie wählen`}
                  />
                );
              })}
            </div>
            {!fp.hauptKategorie && (
              <p className="text-[11.5px] text-[var(--tf-warning-text)] mt-1.5">
                Noch keine Hauptkategorie gesetzt — bis dahin erscheinen keine neuen Anträge auf
                deiner Startseite.
              </p>
            )}
          </SettingsBlock>

          <SettingsBlock label="Ergänzende Erfahrungen" zusatz="mehrere möglich" hint={TOOLTIP_NEBEN}>
            <div className="flex flex-wrap gap-1.5">
              {fp.kategorien.map(k => {
                const istHaupt = fp.hauptKategorie === k.id;
                const istNeben = fp.nebenKategorien.includes(k.id);
                return (
                  <ToggleChip
                    key={k.id}
                    label={k.id}
                    selected={istNeben}
                    disabled={istHaupt}
                    onToggle={() => fp.toggleNeben(k.id)}
                    title={
                      istHaupt
                        ? `${k.name} ist deine Hauptkategorie — kann nicht zusätzlich als Aspekt gesetzt werden.`
                        : istNeben ? `${k.name} als Aspekt entfernen` : `${k.name} als Aspekt hinzufügen`
                    }
                  />
                );
              })}
            </div>
          </SettingsBlock>

          <SettingsBlock id="sec-antragstypen" label="Antragstypen" hint={TOOLTIP_ANTRAGSTYP}>
            {fp.eigenerMa && hasPlOverride(fp.eigenerMa) && (
              <div
                className="text-[12px] px-3 py-2 mb-2 rounded-[var(--tf-radius)]"
                style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}
              >
                <p className="font-medium mb-0.5">Aktuell vom PL eingeschränkt</p>
                <p className="leading-[1.5]">
                  Du bekommst zur Zeit nur {(fp.eigenerMa.antragstypUeberschreibung ?? []).join(', ')}-Anträge
                  zugewiesen. Deine Auswahl hier ({fp.antragstypBevorzugt.length > 0 ? fp.antragstypBevorzugt.join(', ') : 'keine'})
                  greift wieder, sobald der PL die Einschränkung aufhebt.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {ALL_ANTRAGSTYP_BUCKETS.map(bucket => {
                const gewaehlt = fp.antragstypBevorzugt.includes(bucket);
                return (
                  <ToggleChip
                    key={bucket}
                    label={bucket}
                    selected={gewaehlt}
                    onToggle={() => fp.toggleAntragstyp(bucket)}
                    title={gewaehlt ? `${bucket}-Anträge nicht mehr bevorzugen` : `${bucket}-Anträge bevorzugen`}
                  />
                );
              })}
            </div>
            {fp.antragstypBevorzugt.length === 0 && (
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5">
                Nichts ausgewählt — du siehst alle Antragstypen deiner Hauptkategorie.
              </p>
            )}
          </SettingsBlock>

          <SettingsKlappe
            id="sec-themen"
            label="Themen aus deinen Anträgen"
            storageKey="teamflow_settings_themen_collapsed"
            zaehler={fp.autoTags.length > 0 ? `${aktiveThemen} von ${fp.autoTags.length} aktiv` : '0'}
          >
            <div className="flex items-start gap-2 mb-2">
              <p className="text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] flex-1">
                Angeklickte Themen zählen für dich; abgewählte verschwinden aus dem Team-Profil.
              </p>
            </div>
            {fp.autoTags.length > 0 ? (
              <ThemenWand
                tags={fp.autoTags}
                ausgeblendet={fp.ausgeblendeteAutoTags}
                onToggle={fp.toggleAutoTag}
                hint={TOOLTIP_AUTO}
              />
            ) : (
              <SettingsLeer>Keine Anträge mit Technologie-Spalten gefunden.</SettingsLeer>
            )}
          </SettingsKlappe>

          <SettingsKlappe
            id="sec-kompetenzen"
            label="Eigene Kompetenzen"
            storageKey="teamflow_settings_kompetenzen_collapsed"
            zaehler={`${fp.manuelleTags.length} ${fp.manuelleTags.length === 1 ? 'Begriff' : 'Begriffe'}`}
          >
            <p className="text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] mb-2">
              {TOOLTIP_MANUAL}
            </p>
            <TechChipInput
              tags={fp.manuelleTags}
              onChange={fp.setzeManuelleTags}
              maxChips={MAX_CHIPS}
              maxChipLen={MAX_CHIP_LEN}
              placeholder="Stichwort eintippen, Enter zum Hinzufügen…"
            />
          </SettingsKlappe>
        </>
      )}
    </SettingsGruppe>
  );
}

/**
 * Themen-Chipwand: gewählte Themen sind IMMER sichtbar, ungewählte werden auf
 * `AUTO_TAG_CAP` gekürzt — der Rest steht hinter „+ N weitere".
 */
function ThemenWand({
  tags,
  ausgeblendet,
  onToggle,
  hint,
}: {
  tags: readonly string[];
  ausgeblendet: readonly string[];
  onToggle: (tag: string) => void;
  hint: string;
}): React.ReactElement {
  const [alle, setAlle] = useState(false);
  const ausgeblendetSet = new Set(ausgeblendet);
  const { sichtbar, versteckt } = computeAutoTagVisibility(
    [...tags],
    ausgeblendetSet,
    AUTO_TAG_CAP,
    alle,
  );

  return (
    <div className="flex flex-wrap gap-1.5" title={hint}>
      {sichtbar.map(tag => {
        const { short } = truncateWZ(tag);
        return (
          <ToggleChip
            key={tag}
            label={short}
            selected={!ausgeblendetSet.has(tag)}
            onToggle={() => onToggle(tag)}
            title={tag}
          />
        );
      })}
      {(versteckt > 0 || alle) && (
        <button
          type="button"
          onClick={() => setAlle(v => !v)}
          className="inline-flex items-center px-3 h-[27px] rounded-full text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40"
          style={{ background: 'transparent', border: '0.5px dashed var(--tf-border-hover)' }}
        >
          {alle ? 'weniger anzeigen' : `+ ${versteckt} weitere`}
        </button>
      )}
    </div>
  );
}
