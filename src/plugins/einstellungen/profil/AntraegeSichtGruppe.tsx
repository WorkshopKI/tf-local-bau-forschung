/**
 * Gruppe „Welche Anträge du siehst" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 01, rechte Spalte).
 *
 * Fünf Zeilen, die zusammen den Ausschnitt bestimmen: Rolle, Bearbeiter-Kürzel,
 * inaktive Bearbeiter, ZTP-/PFM-Zuständigkeiten und die Anzahl auf der
 * Startseite. Die Erklärungen dazu standen bis v4.27 als Tooltip-Langtexte an
 * den Labels — sie stehen jetzt im Klick-ⓘ, die Zeile trägt nur noch das Nötige.
 */
import { Switch } from '@/components/ui/switch';
import { useProfile } from '@/core/hooks/useProfile';
import { useMAIdentity } from '@/core/hooks/useMAIdentity';
import { useKuerzelFilterOptions } from '@/plugins/auslastung/hooks/useKuerzelFilterOptions';
import { useShowInaktiveMasStore } from '@/plugins/antraege/useShowInaktiveMasStore';
import { useMemo } from 'react';
import { ROLLEN, ROLLE_LABEL, ROLLE_LANG, leseStatusRolle, type Rolle } from '@/core/status';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { parseBearbeiterFilter, rollenBefundFuerKuerzel } from '@/plugins/antraege/bearbeiterFilter';
import { isAssistentPanelEnabled, isMaLoginEnabled } from '@/config/feature-flags';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { SettingsGruppe, SettingsOption, SettingsStepper } from '@/components/settings';
import {
  HOME_ANTRAEGE_MAX,
  HOME_ANTRAEGE_MIN,
  HOME_ANTRAEGE_STANDARD,
} from '@/core/types/config';

const HINT_ROLLE =
  'Das Fachsystem vermerkt bei jedem Statuseintrag, wer ihn setzt. Die Auswahl ist eine Vorauswahl: die Statusliste auf der Antragsseite startet darauf gefiltert, alles Übrige bleibt einen Klick entfernt. Einträge, die jeder setzen darf, bleiben immer sichtbar.';
const HINT_PL =
  'Für Projektleitungen. Der Assistent bietet dann auch Fragen aus Sicht der Projektleitung an — etwa, ob ein Vorgang gefährdet ist und ob AB und FB zugewiesen sind. Wer nebenbei noch bearbeitet, wählt oben zusätzlich seine Rolle. Wer nur noch Projektleitung ist, stellt die Rolle auf „Keine eigene" und das Bearbeiter-Kürzel auf „Alle".';
const HINT_KUERZEL_WAHL =
  'Ihr eigenes Kürzel — es bestimmt, welche Anträge als „Ihre" gelten. Die Liste führt die Kürzel beider Bearbeiter-Spalten (fachlich und administrativ) und auch ehemalige Kolleg:innen (als „ehem." markiert), weil viele PL früher selbst bearbeitet haben. Zwischen Ihren Anträgen und allen wechseln Sie über den Chip im Seitenkopf.';
const HINT_KUERZEL_FREI =
  'Mehrere Kürzel komma-separiert für Vertretungen (z.B. MUE, SCH). Der Wert „alle" schaltet den Filter ab (Übersichtsmodus).';
const HINT_KUERZEL_LOGIN =
  'Dein Kürzel wird beim Login aus deinem Passwort ermittelt und kann hier nicht geändert werden.';
const HINT_INAKTIV =
  'Zeigt in den Antragslisten und auf der Startseite auch die Anträge von Kolleg:innen, die im Auslastungs-Modul als inaktiv geführt sind. Wirkt nur im Übersichtsmodus „Alle Bearbeiter" — die Auswahl darüber führt ehemalige Kürzel unabhängig davon.';
// Kein Rollen-Zuschnitt in diesem Satz: `useBearbeiterSicht` ruft
// `parseBearbeiterFilter` OHNE `rolle` auf — Liste und Startseite matchen immer
// gegen beide Bearbeiter-Spalten. Nur das Vorgangs-Board schneidet nach Rolle
// zu. Der Satz behauptete das Gegenteil (v4.116).
const HINT_ZTP =
  'Mit Schalter gelten Anträge, in denen dein Kürzel in der Begleitung steht (ZTP_KUERZ, PFM_KUERZ), als deine eigenen. Ohne Schalter bleibt der Reiter „Begleitung" sichtbar, zeigt bei aktivem Kürzel-Filter aber nur Anträge, in denen du direkt als Bearbeiter geführt bist (TIB_KUERZ/BIB_KUERZ — beide Spalten, unabhängig von deiner Rolle). Frist für VN-Anträge: D_VBE + 6 Monate.';
const HINT_ANZAHL =
  'Anzahl der offenen Anträge, die beim Öffnen der Startseite sichtbar sind. Über „Mehr anzeigen" lassen sich weitere nachladen.';

/** Wert des Platzhalter-Eintrags für ein gesetztes, aber unbekanntes Kürzel. */
const EIGEN_WERT = '__eigener_wert__';

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
      <SettingsOption
        label="Meine Rolle"
        hint={HINT_ROLLE}
        kurzzeile={(
          <RollenBefundZeile
            gewaehlt={leseStatusRolle(profile.status_rolle)}
            nurProjektleitung={!!profile.projektleitung}
          />
        )}
      >
        <select
          value={leseStatusRolle(profile.status_rolle)}
          onChange={e => updateProfile({ status_rolle: e.target.value as Rolle | 'alle' })}
          aria-label="Meine Rolle in der Antragsbearbeitung"
          className={SELECT_CLASS}
          style={SELECT_STYLE}
        >
          {/* Derselbe Wert „alle", zwei Lesarten: ohne PL-Schalter „ich wähle
              keine Vorauswahl", mit ihm „ich setze selbst keine Kürzel". */}
          <option value="alle">{profile.projektleitung ? 'Keine eigene – nur Projektleitung' : 'Alle Rollen'}</option>
          {ROLLEN.map(r => <option key={r} value={r}>{ROLLE_LANG[r]}</option>)}
        </select>
      </SettingsOption>

      {isAssistentPanelEnabled() && (
        <SettingsOption label="Projektleitung" hint={HINT_PL}>
          <Switch
            checked={!!profile.projektleitung}
            onCheckedChange={v => updateProfile({ projektleitung: v })}
            aria-label="Ich bin Projektleitung"
          />
        </SettingsOption>
      )}

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
          value={profile.home_meine_antraege_count ?? HOME_ANTRAEGE_STANDARD}
          min={HOME_ANTRAEGE_MIN}
          max={HOME_ANTRAEGE_MAX}
          onChange={v => updateProfile({ home_meine_antraege_count: v })}
          ariaLabel="Anträge auf der Startseite"
        />
      </SettingsOption>
    </SettingsGruppe>
  );
}

/**
 * **Wo das eigene Kürzel wirklich steht** — gemessen, nicht geraten.
 *
 * Die Rollenwahl war bis v4.132 eine leere Vorauswahl, und wer sie nie traf,
 * las im Vorgangs-Board den AB-Regelsatz: 17 „Meine Aufgaben", von denen 16 dem
 * AB gehörten. Die Antwort steht in den Daten — das Legacy führt den FB in
 * `TIB_KUERZ`, den AB in `BIB_KUERZ`. Ein **Vorschlag**, keine Setzung: bei
 * Vertretungen und PL mit Doppelrolle ist die Zahl mehrdeutig, und dann sagt die
 * Zeile das auch.
 */
function RollenBefundZeile({ gewaehlt, nurProjektleitung }: {
  gewaehlt: Rolle | 'alle';
  /** PL-Schalter an — dann heißt „alle" hier „setzt selbst keine Kürzel". */
  nurProjektleitung: boolean;
}): React.ReactElement | null {
  const antraege = useAntraegeStore(s => s.antraege);
  const meinKuerzel = useMeinKuerzel();
  const befund = useMemo(() => {
    const tokens = parseBearbeiterFilter(meinKuerzel ?? undefined, false).tokens;
    return rollenBefundFuerKuerzel(antraege, tokens);
  }, [antraege, meinKuerzel]);

  // Eine PL, die früher bearbeitet hat, steht noch in alten Fällen — die Zählung
  // schlüge ihr sonst die Rolle von damals vor.
  if (nurProjektleitung && gewaehlt === 'alle') {
    return <>Als Projektleitung ohne eigene Vorgänge passt „Keine eigene“.</>;
  }

  const mitTreffern = befund.proRolle.filter(t => t.anzahl > 0);
  if (mitTreffern.length === 0) return null;

  const zaehlung = befund.proRolle
    .map(t => `${t.anzahl.toLocaleString('de-DE')}× ${ROLLE_LABEL[t.rolle]}`)
    .join(' · ');
  if (befund.vorschlag === null) {
    return <>Ihr Kürzel steht in beiden Bearbeiter-Spalten ({zaehlung}) — die Wahl bleibt bei Ihnen.</>;
  }
  if (gewaehlt === befund.vorschlag) {
    return <>Passt zu den Daten: Ihr Kürzel steht {zaehlung}.</>;
  }
  return (
    <>
      Ihr Kürzel steht {zaehlung} — den Daten nach sind Sie{' '}
      <strong className="font-medium">{ROLLE_LANG[befund.vorschlag]}</strong>.
    </>
  );
}

/**
 * Bearbeiter-Kürzel: Dropdown, wo das Auslastungs-Modul Kürzel kennt, sonst
 * Freitext — und im MA-Login nur der Wert, weil er aus dem Passwort stammt.
 *
 * Die Auswahl **verschweigt niemanden** (v4.47): sie führt ehemalige
 * Bearbeiter:innen als „ehem." mit, weil PL-Leute früher fast alle selbst
 * bearbeitet haben und ihr eigenes Kürzel sonst schlicht fehlt. Der Schalter
 * „Inaktive Bearbeiter einblenden" darunter wirkt seither nur noch auf die
 * Listen und die Startseite — bis v4.46 hing die Auswahl mit daran und versteckte
 * genau die Person, die hier gerade nach sich selbst sucht.
 */
function KuerzelZeile(): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const sessionKuerzel = useMAIdentity(s => s.kuerzel);
  const istAngemeldet = useMAIdentity(s => s.istAngemeldet);
  const options = useKuerzelFilterOptions();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const setShowInaktive = useShowInaktiveMasStore(s => s.setShowInaktive);
  const current = profile?.bearbeiter_kuerzel ?? '';

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

  const cur = current.trim();
  // NFC vor dem Vergleich (Pitfall #22): „THÜ" kann als ein Zeichen oder als
  // U + Kombinierendes Trema in den Daten stehen; ohne Normalisierung fand der
  // Vergleich das eigene Kürzel nicht wieder.
  const norm = (s: string): string => s.trim().normalize('NFC').toUpperCase();
  const upper = norm(cur);
  const istAlle = !cur || cur.toLowerCase() === 'alle';
  const treffer = options.find(o => norm(o.kuerzel) === upper);
  /**
   * Gesetzt, aber nicht in der Liste — ein kommagetrenntes Vertretungs-Kürzel
   * („MUE, SCH") oder eines aus einer Quelle, die gerade nicht geladen ist.
   *
   * Bis v4.116 fiel das still auf „Alle" zurück: die Auswahl behauptete, es
   * gebe keinen Filter, während er weiterlief und die Liste kürzte. Jetzt steht
   * der Wert als eigener Eintrag drin und sagt, was gilt.
   */
  const eigenerWert = !istAlle && !treffer ? cur : null;
  const wert = istAlle ? 'alle' : (treffer?.kuerzel ?? EIGEN_WERT);

  return (
    <>
      <SettingsOption label="Bearbeiter-Kürzel" hint={HINT_KUERZEL_WAHL}>
        <select
          value={wert}
          // Der Platzhalter-Eintrag ist nur Anzeige — er darf sich nicht
          // versehentlich ins Profil schreiben.
          onChange={e => { if (e.target.value !== EIGEN_WERT) updateProfile({ bearbeiter_kuerzel: e.target.value }); }}
          aria-label="Bearbeiter-Kürzel"
          className={SELECT_CLASS}
          style={SELECT_STYLE}
        >
          <option value="alle">Alle</option>
          {eigenerWert != null && (
            <option value={EIGEN_WERT}>{eigenerWert} · eigener Eintrag</option>
          )}
          {/* Angezeigt wird die Schreibweise der Quelle („THü"), gespeichert die
              Normalform — wer sein Kürzel sucht, sucht es so, wie er es schreibt. */}
          {options.map(o => (
            <option key={o.kuerzel} value={o.kuerzel}>
              {o.aktiv ? o.anzeige : `${o.anzeige} · ehem.`}
            </option>
          ))}
        </select>
      </SettingsOption>
      {isAuslastungFreigeschaltet() && (
        <SettingsOption label="Anträge inaktiver Bearbeiter einblenden" hint={HINT_INAKTIV}>
          <Switch
            checked={showInaktive}
            onCheckedChange={setShowInaktive}
            aria-label="Anträge inaktiver Bearbeiter einblenden"
          />
        </SettingsOption>
      )}
    </>
  );
}
