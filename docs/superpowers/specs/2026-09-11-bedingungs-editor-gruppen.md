# Bedingungs-Editor: benannte Gruppen, Übersicht, Probe am Bestand

## 0. Anlass

> „die Gruppennamen sollten änderbar sein. bei der ersten Nutzung der Seite und dem Anlegen von
> Bedingungen war das Feedback der pl nutzer das es noch nicht inuitiv und übersichtliche genug ist,
> gerade bei komplexeren und verschachtelten gruppen und bedingungen. die Auswahl der Kürzel (drop
> down mit suchfunktion wurde gelobt)" — und zur Probe: „nur für die aktuelle richtlinie, dann
> sind es weniger daten zu laden … Würde man dann beim Bauen der Meilensteine sehen welche
> Auswirkungen diese haben?"

## 1. Befund

- Der `BedingungEditor` ist geteilt: Meilensteine, To-do-Regeln (`TodoRegelDetail.tsx`), Eigene Spalte (`SpaltenDialog.tsx`).
- Gruppen hatten weder Namen noch Id; „GRUPPE n" war die Position.
- Ein Name wäre an drei Stellen still verloren gegangen: beim Umschalten der Verknüpfung (Gruppe von Hand neu gebaut), in `mitGruppenKindern` und in `normalisiereBedingung` beim Laden.
- Die Übersicht fehlte:
  - Es gab zwei Vokabulare, ALLE/EINE im Kopf und UND/ODER in der Rinne.
  - Jede Zeile trug sieben Icons, per `ml-auto` an den rechten Rand geschoben.
  - Gruppen ließen sich nicht zuklappen.
  - Die Verknüpfung war ein Dropdown mit zwei Werten.

## 2. Entscheidungen (Grill-Runden)

- **Entwurf A „Benannte Kästen":** Der Name steht im Gruppenkopf, dazu der Schalter „alle | eine", feste Spalten für Feld und Operator, Griff plus ⋯-Menü und zuklappbare Gruppen mit Kurzsatz.
- **Name im Kurzsatz vor dem Inhalt** („PreCheck AB: (…)"), nie statt des Inhalts. Der Name hat keine Wirkung auf die Auswertung.
- **Probe am Bestand**, nur im Meilenstein-Modul:
  - Grundmenge ist die **aktuelle Richtlinie**, offene und abgeschlossene Verbünde getrennt gezählt.
  - Einmal laden, danach live.
  - Treffer plus Differenz zur freigegebenen Fassung.
- Kein neues Flag: Das Modul liegt hinter `meilensteinMonitoring` (dev + pl).

## 3. Umsetzung

- **Datenmodell:**
  - `Bedingung`-Gruppen tragen `name?: string` ([typen.ts](../../../src/core/status/typen.ts)).
  - Jede Gruppe entsteht über `baueGruppe` in [bedingung-baum.ts](../../../src/core/status/bedingung-baum.ts). `mitVerknuepfung` und `benenneBedingungsGruppe` sind neu, `MAX_GRUPPENNAME` = 80 ist die eine Obergrenze.
  - `normalisiereBedingung` lässt den Namen durch, auch im Sicherheits-Rückfall.
  - `bedingung-text.ts` schreibt den Namen vor den Inhalt.
- **Editor:** Die Umsetzung verteilt sich auf [BedingungEditor.tsx](../../../src/plugins/meilensteine/BedingungEditor.tsx), [ZeilenAktionen.tsx](../../../src/plugins/meilensteine/ZeilenAktionen.tsx), [BlattZeile.tsx](../../../src/plugins/meilensteine/BlattZeile.tsx) und [BedingungsFugen.tsx](../../../src/plugins/meilensteine/BedingungsFugen.tsx).
  - Die Klappen hängen am Pfad und werden nach jedem Struktur-Umbau zurückgesetzt.
  - `SegmentedToggle` hat die zusätzliche Prop `dicht` bekommen.
- **Probe:**
  - Die Rechnung steht rein in [probe.ts](../../../src/core/meilensteine/probe.ts). Sie nutzt `pruefeBedingung`, `bewerteVerbund` und den neu exportierten `giltFuerTyp`.
  - Geladen wird in [useMeilensteinProbe.ts](../../../src/plugins/meilensteine/useMeilensteinProbe.ts), angezeigt in [ProbeAnzeige.tsx](../../../src/plugins/meilensteine/ProbeAnzeige.tsx).
  - Inaktive Knoten zählen in je einem eigenen Lauf, damit sich die Eltern-ODER-Regel ihrer Eltern nicht verschiebt.

## 4. Abweichungen beim Bau (belegt)

- **Lesepfad:** Der Plan sah einen Lesevorgang je Programm vor. Im Bestand gibt es aber **ein** Programm („default-programm") mit allen 14 225 Anträgen, und der Store hat keinen Index auf `unterprogramm_id`. Gelesen wird deshalb so:
  1. Die Listen-Projektion filtern (24 Felder, 222 ms).
  2. Nur die 2 537 Schlüssel der Richtlinie 2025 (1 793 Verbünde) mit `getAntraegeByKeys` voll lesen, in Blöcken zu 500.
  3. Die Datensätze sofort auf den Spalten-Katalog projizieren.
  - Gemessen: **0,8 s** Ladezeit.
- **Editor-Prop:** `probe` ist eine Render-Funktion (`(gruppe) => ReactNode`) statt `ProbeZahlen`. Der Editor bleibt damit frei von „offen/abgeschlossen".
- **Menü:** Die generierte shadcn-`dropdown-menu.tsx` hat zwei Probleme mitgebracht und wurde nach dem Muster von `context-menu.tsx` umgestellt:
  - Sie hatte ein fremdes npm-Paket `cn` installiert und von dort importiert. Das Paket ist wieder deinstalliert.
  - Ihre Ausblend-Animation hielt das geschlossene Menü über eine Sekunde klickbar im DOM.

## 5. Verifikation

- **Tests:** `bedingung-baum.test.ts` prüft, dass der Name jeden Umbau übersteht und dass Evaluator und Formatierer richtig mit ihm umgehen. `plan-storage.test.ts` prüft den Roundtrip des Namens. `probe.test.ts` prüft Nenner, Trennung, inaktive Knoten und die Eltern-ODER-Regel.
- **Abnahme in `dev:local`**, auf echtem Bestand:
  - Die Probe zeigt an Meilenstein 3 „988 von 1 094 offenen · 347 von 429 abgeschlossenen".
  - Nach dem Umschalten von Gruppe 1 auf „alle" zeigt sie live −985.
  - Der Offen-Nenner 1 317 stimmt exakt mit den offenen Verbünden der Projektion in der Richtlinie 2025 überein. Nach FuE und DS gefiltert sind es beidseitig 1 094.
  - Name, Esc, das Umschalten der Verknüpfung, das ⋯-Menü per Tastatur und das Zuklappen sind geprüft. Der Regel-Bereich bleibt bei Menü-Klicks offen.
  - Der geteilte Editor ist im To-do-Regel-Detail geprüft. `window.__tf.fehler()` meldet 0.
- **Nicht in `dev:local` geprüft:**
  - Speichern und Neuladen auf dem Share. Der lokale Share ist mit einer parallelen Sitzung geteilt; den Roundtrip belegt der Test.
  - Der `file://`-Build.
