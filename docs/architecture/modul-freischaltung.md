# Modul-Freischaltung per Zusatzpasswort (v3.0)

Einzelne Module lassen sich zur **Laufzeit** per Passwort freischalten, statt für jede Zielgruppe
einen eigenen Build zu pflegen. Zwei Slots gibt es: `auslastung` und `kurator`.

Vorher trennten Varianten die Zielgruppen (`pl` / `as` / `kurator`) — bei byte-gleichem Code, nur
mit anderen Flags. Das sparte kein Byte und kostete Pflege: `as` fiel über zwölf Flags hinter
`pl` zurück, ohne dass es auffiel. Siehe [build-varianten.md](build-varianten.md).

## Die eine Regel

> **Vorhandener Slot = gesperrt. Fehlender Slot = offen.**

Kein `required` je Slot, kein Default „zu". Das hält `dev` und `local` unangetastet: sie führen
keinen `moduleAuth`-Block, also ist dort nichts gesperrt — sonst wäre das Modul ausgerechnet in
der Umgebung unsichtbar, in der `npm run dev:local` die Abnahme fährt.

## Die zweite Regel (v3.27)

> **Die Anmeldung legt den Freischalt-Zustand fest — sie ergänzt ihn nicht.**

Steht beim Start eine Anmeldung an, wird jedes Modul mit Schloss zuerst **geschlossen**
(`schliesseGesperrteModule`, [modul-freischaltung.ts](../../src/core/modul-freischaltung.ts)).
Erst danach öffnet die Wall genau den Slot, dessen Passwort getroffen hat:

| Passwort an der Wall | Auslastung | Kuration |
| --- | --- | --- |
| Basis (`auth`) | zu | zu |
| `moduleAuth.auslastung` | **offen** | zu |
| `moduleAuth.kurator` | zu | **offen** |

Ohne diesen Schnitt zeigte eine Anmeldung mit dem Basis-Passwort weiter, was eine frühere Sitzung
mit einem Modul-Passwort geöffnet hatte: in `zah-pl` v3.25 erschienen beide Menüs, unabhängig vom
getippten Passwort, weil beide 12-h-Einträge aus früheren Tests noch gültig waren.

Der Schnitt sitzt in [App.tsx](../../src/core/App.tsx) an derselben Stelle wie der `rehydrate` —
**vor** den `onInit`-Hooks und vor der Gate-Entscheidung. Später wäre zu spät: Plugin-Registrierung,
Warmup und modul-globale Konstanten hätten den alten Zustand längst aufgelöst.

Die Profil-Flagge `is_kurator` folgt derselben Regel, aber im Gate
([AppPasswordGate.tsx](../../src/core/AppPasswordGate.tsx)) statt beim Init — sie überlebt
Neustarts und öffnet im `StartupScreen` den Daten-Share mit Schreibrecht.

Module **ohne** Schloss bleiben unberührt: in `dev`/`local` gibt es nichts zu schützen, und ein
Rücksetzen würfe nur die laufende Kurator-Session der Abnahme-Umgebung weg.

## Konfiguration

```jsonc
"moduleAuth": {
  "auslastung": { "salt": "…", "verifier": "…", "hint": "Zugang: Projektleitung." },
  "kurator":    { "salt": "…", "verifier": "…", "hint": "Zugang: IT-Koordination." }
}
```

Erzeugt via `npm run set-password -- pl --modul <slot> "<pw>"`. Dieselbe Krypto wie die App-Wall
(PBKDF2-SHA256, 200k Iterationen, AES-GCM-256). Nur der Verifier wird committet.

`validateConfig` bricht hart ab bei: unbekanntem Slot-Namen (ein Tippfehler hieße sonst **gar
keine Sperre** — ein stiller Rückbau des Schutzes), fehlendem Salt/Verifier, und einem Schloss
vor einem Modul, dessen Flag gar nicht an ist. Geteilte Salts geben eine Warnung.

## Die zwei Ebenen im Code

| Frage | Wo | Beispiel |
| --- | --- | --- |
| Ist das Modul **einkompiliert**? (Bauzeit) | `@/config/feature-flags` | `isAuslastungEnabled()`, `isKuratorMenusEnabled()` |
| Darf der Mensch davor es **sehen**? (Bau- **und** Laufzeit) | `@/core/modul-freischaltung` | `isAuslastungFreigeschaltet()`, `isKuratorFreigeschaltet()` |

Fast jede Sichtbarkeits-Abfrage meint die zweite. Die reine Wahrheitstabelle steht in
[modul-schloss.ts](../../src/config/modul-schloss.ts) und ist ohne `runtimeConfig` testbar.

**Warum ein eigenes Modul statt `feature-flags.ts`?** Ein Store-Import dort schlösse den Zyklus
`feature-flags → useKuratorSession → kurator-config → smb-handle → feature-flags`;
`npm run cycles` hat eine leere Allowlist. Willkommener Nebeneffekt: jede umgestellte
Aufrufstelle wird als Import-Änderung im Diff sichtbar.

**Roh bleiben müssen** Stellen, die sich nicht mitten in der Sitzung ändern dürfen — vor allem
modul-globale Konstanten (`SEMANTIC_SOURCES_ENABLED` in
[antraege-search-service.ts](../../src/plugins/antraege/services/antraege-search-service.ts)) und
der Bearbeiter-Filter (`isKuerzelDropdownEnabled`), der auch bei gesperrtem Modul nutzbar bleibt.

## Wo freigeschaltet wird

- **An der Start-Wall** ([AppPasswordGate.tsx](../../src/core/AppPasswordGate.tsx)): ein Feld,
  drei mögliche Passwörter (`verifyAnyPassword`) — Basis-Passwort öffnet die App, ein
  Modul-Passwort öffnet App **und** Modul. Wer nur für sein Modul eins bekommen hat, tippt eines
  statt zweier.
- **In den Einstellungen** (`ModulFreischaltungSection`, Abschnitt `sec-freischaltung`): Status,
  Restlaufzeit, Passwortfeld, „Sperren".

Beide laden nach dem Schalten **neu**. Das ist kein Schönheitsfehler, sondern der Grund, warum
alle Prädikate schlichte Konstanten bleiben dürfen: Plugin-Registrierung, `onInit`-Hooks und
modul-globale Konstanten werden beim Start **einmal** aufgelöst. Der Reload kostet keinen zweiten
Login (Gate-Merker im sessionStorage) und keine Freischaltung (die liegt in der IndexedDB).

## Gültigkeit

12 Stunden **innerhalb der Browser-Sitzung**. Sie überlebt jeden Reload (der Gate-Merker liegt im
sessionStorage, die Freischaltung in der IndexedDB) — aber keine neue Anmeldung: die legt den
Zustand neu fest (zweite Regel oben). In Builds ohne Wall (`dev`, `local`, `prod`) gilt sie
unverändert über Neustarts hinweg, weil es dort nichts zu entscheiden gibt.

Die Freischaltung ist **gerätelokal** — sie gehört nie in Snapshot, Share oder Personal-Mirror,
denn sie ist eine Aussage über dieses Gerät.

- `auslastung` → [useModulFreischaltung.ts](../../src/core/hooks/useModulFreischaltung.ts),
  IDB-Key `modul-freischaltung`
- `kurator` → die bestehende [useKuratorSession](../../src/core/hooks/useKuratorSession.ts).
  Bewusst kein zweiter Zeitgeber: sie ist bereits eine 12-h-, IDB-persistierte, rehydrierende
  Session, und ~35 Aufrufstellen lesen ihr `isActive` für Schreib-Buttons.

Beide `rehydrate` laufen in [App.tsx](../../src/core/App.tsx) **vor** den Plugin-`onInit`-Hooks
und vor der Gate-Entscheidung — und werden dort durch den Schnitt ersetzt, wenn eine Anmeldung
ansteht. Steht der Rehydrate später, sieht das Auslastungs-`onInit` fälschlich „gesperrt" und der
Warmup unterbleibt trotz gültiger Freischaltung.

## Sichtbarkeit der Plugins

Ein Plugin trägt `modulSchloss?: ModulSlot` in seinem Manifest. Der Filter sitzt **an einer
Stelle** — im `visiblePlugins`-Memo in [ShellLayout.tsx](../../src/core/ShellLayout.tsx), neben
dem bestehenden `kuratorOnly`-Check. Das deckt Sidebar, Command-Palette und Shortcuts zugleich
ab, weil alle drei von `visiblePlugins` abgeleitet sind.

Deep-Links schützt `ModulSchlossGate` in [Router.tsx](../../src/core/Router.tsx): gesperrt zeigt
es ein „… ist gesperrt"-Panel mit Weg zur Freischaltung — **keine** stille Umleitung auf `/`, die
liest sich aus einem Lesezeichen heraus wie ein Fehler. Damit ist nebenbei das bestehende Loch
für die sieben `kuratorOnly`-Plugins zu.

## Sicherheitsmodell

Ein **Casual-Access-Gate**, offline brute-forcebar mit PBKDF2-200k pro Versuch — bewusst
akzeptiert unter dem Single-Team-Trust-Modell (CLAUDE.md). Es ist eine **Sichtbarkeitssperre,
keine Verschlüsselung**: der Modul-Code liegt weiter im Bundle, und `_intern/auslastung.json`
bleibt für jeden mit SMB-Zugriff lesbar. Zweck ist, dass die falsche Zielgruppe die Oberfläche
nicht versehentlich benutzt — nicht, Böswilligkeit zu verhindern.

Der Kurator-Zugang existierte bis v3.0 **doppelt**: als Passwortdatei
`_intern/kurator-config.enc` auf dem Share und als build-eingebackenes Passwort der Start-Wall.
Geblieben ist der Build-Weg — er greift schon vor der Ordner-Freigabe und nutzt dieselbe Krypto
wie das App-Passwort. Preis: ein Passwortwechsel erfordert einen Rebuild, konsistent mit
Pitfall #28.

## Fallstricke

- Die Auto-Eskalation an der Wall darf **nicht** allein an `kuratorMenus` hängen. Im
  zusammengelegten pl-Build muss das Flag an sein (sonst wirft `plugins.config.ts` die
  Kuration-Plugins schon zur Bauzeit raus) — ohne die zweite Bedingung
  `!hatModulSchloss('kurator')` machte jedes gültige Basis-Passwort seinen Inhaber zum Kurator.
- Der freie `is_kurator`-Schalter im Profil erscheint nur in Builds **ohne** Kurator-Schloss; wo
  eines existiert, wäre er die offene Hintertür daneben.
- „Inaktive einblenden" (ProfilTab) und `useInaktiveKuerzelSet` müssen am **selben** Prädikat
  hängen. Filterte die Liste, während das Häkchen fehlt, verschwänden die Anträge ehemaliger
  Kolleg:innen ohne Weg, sie wieder einzublenden.
- **Ein Passwort nie zweimal vergeben.** `verifyGegenEbenen` prüft Basis → `auslastung` →
  `kurator` und nimmt den **ersten** Treffer. Wer denselben String für zwei Ebenen einsetzt,
  bekommt still nur die vordere — ohne Meldung, warum das Modul zubleibt.
  ([Test](../../src/core/services/infrastructure/__tests__/app-password-slots.test.ts))
- Abschnitte, die nur unter Schloss existieren, gehören **auch in die Registry**
  ([settingsPanels.tsx](../../src/plugins/einstellungen/settingsPanels.tsx)) und mit derselben
  Bedingung wie die Sektion selbst — sonst zeigt die Navigation einen Abschnitt, den es auf der
  Seite nicht gibt (`sec-kurator`), oder verschweigt den einzigen Weg zur Freischaltung
  (`sec-freischaltung`).
