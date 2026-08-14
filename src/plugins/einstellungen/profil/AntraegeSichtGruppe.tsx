/**
 * Gruppe „Welche Anträge du siehst" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 01, rechte Spalte).
 *
 * Fünf Zeilen, die zusammen den Ausschnitt bestimmen: Rolle, Bearbeiter-Kürzel,
 * inaktive Bearbeiter, ZTP-/PFM-Zuständigkeiten und die Anzahl auf der
 * Startseite. Die Erklärungen dazu standen bis v4.27 als Tooltip-Langtexte an
 * den Labels — sie stehen jetzt im Klick-ⓘ, die Zeile trägt nur noch das Nötige.
 */
import { useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { useProfile } from '@/core/hooks/useProfile';
import { useMAIdentity } from '@/core/hooks/useMAIdentity';
import { useKuerzelFilterOptions } from '@/plugins/auslastung/hooks/useKuerzelFilterOptions';
import { useShowInaktiveMasStore } from '@/plugins/antraege/useShowInaktiveMasStore';
import { ROLLEN, ROLLE_LANG, leseStatusRolle, type Rolle } from '@/core/status';
import { isMaLoginEnabled } from '@/config/feature-flags';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { SettingsGruppe, SettingsOption, SettingsStepper } from '@/components/settings';

const HINT_ROLLE =
  'Das Fachsystem vermerkt bei jedem Statuseintrag, wer ihn setzt. Die Auswahl ist eine Vorauswahl: die Statusliste auf der Antragsseite startet darauf gefiltert, alles Übrige bleibt einen Klick entfernt. Einträge, die jeder setzen darf, bleiben immer sichtbar.';
const HINT_KUERZEL_WAHL =
  'Kürzel auswählen, dessen Anträge angezeigt werden. „Alle" zeigt die Anträge aller Bearbeiter (Übersichtsmodus).';
const HINT_KUERZEL_FREI =
  'Mehrere Kürzel komma-separiert für Vertretungen (z.B. MUE, SCH). Der Wert „alle" schaltet den Filter ab (Übersichtsmodus).';
const HINT_KUERZEL_LOGIN =
  'Dein Kürzel wird beim Login aus deinem Passwort ermittelt und kann hier nicht geändert werden.';
const HINT_INAKTIV =
  'Zeigt auch Kürzel von Kolleg:innen, die im Auslastungs-Modul als inaktiv geführt sind. Wirkt zugleich auf die Antragslisten und die Startseite.';
const HINT_ZTP =
  'Mit Schalter gelten Anträge, in denen dein Kürzel in der Begleitung steht (ZTP_KUERZ, PFM_KUERZ), als deine eigenen. Ohne Schalter bleibt der Reiter „Begleitung" sichtbar, zeigt bei aktivem Kürzel-Filter aber nur Anträge, in denen du direkt als Bearbeiter geführt bist (TIB_KUERZ/BIB_KUERZ, bei gesetzter Rolle nur deren Spalte). Frist für VN-Anträge: D_VBE + 6 Monate.';
const HINT_ANZAHL =
  'Anzahl der offenen Anträge, die beim Öffnen der Startseite sichtbar sind. Über „Mehr anzeigen" lassen sich weitere nachladen.';

const SELECT_CLASS =
  'h-[30px] pl-2.5 pr-7 text-[12.5px] text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none cursor-pointer focus:border-[var(--tf-primary)]';
const SELECT_STYLE = { border: '0.5px solid var(--tf-border-hover)' } as const;

export function AntraegeSichtGruppe(): React.ReactElement | null {
  const { profile, updateProfile } = useProfile();
  if (!profile) return null;

  return (
    <SettingsGruppe
      id="sec-filter"
      titel="Welche Anträge du siehst"
      unterzeile="Gilt für Startseite, Listen und Matching."
    >
      <SettingsOption label="Meine Rolle" hint={HINT_ROLLE}>
        <select
          value={leseStatusRolle(profile.status_rolle)}
          onChange={e => updateProfile({ status_rolle: e.target.value as Rolle | 'alle' })}
          aria-label="Meine Rolle in der Antragsbearbeitung"
          className={SELECT_CLASS}
          style={SELECT_STYLE}
        >
          <option value="alle">Alle Rollen</option>
          {ROLLEN.map(r => <option key={r} value={r}>{ROLLE_LANG[r]}</option>)}
        </select>
      </SettingsOption>

      <KuerzelZeile />

      <SettingsOption label="ZTP-/PFM-Zuständigkeiten mitzählen" hint={HINT_ZTP}>
        <Switch
          checked={!!profile.bearbeiter_inkl_begleitung}
          onCheckedChange={v => updateProfile({ bearbeiter_inkl_begleitung: v })}
          aria-label="Meine ZTP-/PFM-Zuständigkeiten mitzählen"
        />
      </SettingsOption>

      <SettingsOption
        id="sec-home"
        label="Anträge auf der Startseite"
        hint={HINT_ANZAHL}
        kurzzeile={'Beim Öffnen sichtbar, vor „Mehr anzeigen"'}
      >
        <SettingsStepper
          value={profile.home_meine_antraege_count ?? 5}
          min={5}
          max={15}
          onChange={v => updateProfile({ home_meine_antraege_count: v })}
          ariaLabel="Anträge auf der Startseite"
        />
      </SettingsOption>
    </SettingsGruppe>
  );
}

/**
 * Bearbeiter-Kürzel: Dropdown, wo das Auslastungs-Modul Kürzel kennt, sonst
 * Freitext — und im MA-Login nur der Wert, weil er aus dem Passwort stammt.
 * Der Schalter „Inaktive Bearbeiter einblenden" steht als eigene Zeile darunter,
 * hängt aber am selben Modul-Prädikat wie die Filterung (sonst verschwänden
 * Anträge ehemaliger Kolleg:innen ohne Weg, sie wieder einzublenden).
 */
function KuerzelZeile(): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const sessionKuerzel = useMAIdentity(s => s.kuerzel);
  const istAngemeldet = useMAIdentity(s => s.istAngemeldet);
  const options = useKuerzelFilterOptions();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const setShowInaktive = useShowInaktiveMasStore(s => s.setShowInaktive);
  const current = profile?.bearbeiter_kuerzel ?? '';

  // Stale-Guard: ist ein inaktives Kürzel gewählt und werden Inaktive wieder
  // ausgeblendet, würde es aus dem Dropdown verschwinden — zurück auf „Alle".
  useEffect(() => {
    if (showInaktive || !options) return;
    const cur = current.trim();
    if (!cur || cur.toLowerCase() === 'alle') return;
    const opt = options.find(o => o.kuerzel === cur.toUpperCase());
    if (opt && !opt.aktiv) void updateProfile({ bearbeiter_kuerzel: 'alle' });
  }, [showInaktive, options, current, updateProfile]);

  if (isMaLoginEnabled() && istAngemeldet) {
    return (
      <SettingsOption label="Angemeldet als" hint={HINT_KUERZEL_LOGIN}>
        <span className="text-[12.5px] font-medium uppercase text-[var(--tf-text)]">
          {sessionKuerzel ?? '—'}
        </span>
      </SettingsOption>
    );
  }

  // `options === null` = Auslastungs-Modul aus (kein Kürzel-Bestand) → Freitext.
  if (options === null) {
    return (
      <SettingsOption label="Bearbeiter-Kürzel" hint={HINT_KUERZEL_FREI}>
        <input
          value={current}
          onChange={e => updateProfile({ bearbeiter_kuerzel: e.target.value })}
          placeholder="z.B. MUE"
          aria-label="Bearbeiter-Kürzel"
          className="h-[30px] w-24 px-2.5 text-[12.5px] uppercase text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)] placeholder:normal-case"
          style={SELECT_STYLE}
        />
      </SettingsOption>
    );
  }

  const sichtbare = showInaktive ? options : options.filter(o => o.aktiv);
  const cur = current.trim();
  const upper = cur.toUpperCase();
  // Ein gewähltes, aber gerade nicht sichtbares Kürzel fällt visuell auf „Alle".
  const wert =
    !cur || cur.toLowerCase() === 'alle' || !sichtbare.some(o => o.kuerzel === upper)
      ? 'alle'
      : upper;

  return (
    <>
      <SettingsOption label="Bearbeiter-Kürzel" hint={HINT_KUERZEL_WAHL}>
        <select
          value={wert}
          onChange={e => updateProfile({ bearbeiter_kuerzel: e.target.value })}
          aria-label="Bearbeiter-Kürzel"
          className={SELECT_CLASS}
          style={SELECT_STYLE}
        >
          <option value="alle">Alle</option>
          {sichtbare.map(o => <option key={o.kuerzel} value={o.kuerzel}>{o.kuerzel}</option>)}
        </select>
      </SettingsOption>
      {isAuslastungFreigeschaltet() && (
        <SettingsOption label="Inaktive Bearbeiter einblenden" hint={HINT_INAKTIV}>
          <Switch
            checked={showInaktive}
            onCheckedChange={setShowInaktive}
            aria-label="Inaktive Bearbeiter einblenden"
          />
        </SettingsOption>
      )}
    </>
  );
}
