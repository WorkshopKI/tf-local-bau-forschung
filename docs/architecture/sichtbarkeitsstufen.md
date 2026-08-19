# Beta-Funktionen & Expertenmodus (v4.115)

Die App ist über 19 Plugins, ~75 Reiter, ~68 Abschnitte und 16 Startseiten-Widgets gewachsen.
Vieles davon ist Erprobung oder Tiefenwerkzeug, stand aber gleichberechtigt neben dem
Tagesgeschäft. Diese Achse räumt auf.

## Die vierte Achse

Drei Mechanismen gab es schon — Feature-Flag (Bauzeit), Modul-Schloss (Passwort),
`kuratorOnly` (Rolle). Alle drei beantworten **„darf ich das?"**. Diese beantwortet
**„will ich das sehen?"**. Sie schützt nichts: eine verborgene Route bleibt über ihren
Deep-Link erreichbar, genau wie bei `hideFromNav`.

## Zwei Marken, keine Stufe

Eine einzige Stufe würfe „neue Listenansicht für alle" und „neuer Regel-Editor für Profis" in
denselben Topf: wer Beta einschaltet, um Neues zu probieren, bekäme das Tiefenwerkzeug gleich mit.

| | Zielgruppe: alle | Zielgruppe: Experten |
|---|---|---|
| **stabil** | Standard | `experte` |
| **in Erprobung** | `beta` | `beta` + `experte` |

```ts
sichtbar = (!marken.beta || schalter.beta) && (!marken.experte || schalter.experte)
```

**UND, nicht ODER** — beide Marken sind Einschränkungen. `beta`+`experte` verlangt beide Schalter.

Beide Schalter stehen standardmäßig **aus** und leben im Profil („Mein Profil › Umfang der
Oberfläche", `sec-umfang`). Sie wirken **ohne Neuladen**: die Schalter hängen am
`profile`-Kontext, das Kurator-Overlay an einem zustand-Store.

Ein **„Beta"-Abzeichen** trägt nur die Beta-Marke — sie sagt „kann sich noch ändern", eine
Information, die im Moment des Sehens gebraucht wird. „Experte" bekommt keins; Tiefe ist keine
Warnung. Wer beides trägt, zeigt trotzdem nur „Beta".

## Wo was steht

| Sache | Ort |
|---|---|
| Typen, Id-Bauer | [types.ts](../../src/core/sichtbarkeit/types.ts) |
| Die reinen Funktionen | [regel.ts](../../src/core/sichtbarkeit/regel.ts) |
| **Das Inventar + die Vorbelegung** | [katalog.ts](../../src/core/sichtbarkeit/katalog.ts) |
| Kurator-Sidecar `_intern/sichtbarkeit.json` | [sidecar.ts](../../src/core/sichtbarkeit/sidecar.ts) |
| Laufzeit-Overlay (zustand) | [store.ts](../../src/core/sichtbarkeit/store.ts) |
| Die Frage-Stelle | [useSichtbar.ts](../../src/core/hooks/useSichtbar.ts) |
| Hüllen | [WennSichtbar](../../src/components/sichtbarkeit/WennSichtbar.tsx), [BetaBadge](../../src/components/sichtbarkeit/BetaBadge.tsx) |
| Nutzer-Schalter | [UmfangGruppe.tsx](../../src/plugins/einstellungen/profil/UmfangGruppe.tsx) |
| Kurator-GUI | [SichtbarkeitPanel.tsx](../../src/plugins/kuration/sichtbarkeit/SichtbarkeitPanel.tsx) |

**Ids** sind `<art>:<pfad>` und ein Vertrag: `seite:antraege` · `reiter:antraege/fristen` ·
`abschnitt:einstellungen/sec-provider` · `widget:kanban`. Nie von Hand tippen — `seiteId()`,
`reiterId()`, `abschnittId()`, `widgetId()` bauen sie.

## Fünf Regeln beim Markieren

1. **Marken sind absolut, nicht relativ.** Ein verborgener Wirt rendert seine Kinder ohnehin
   nicht. Markiert wird nur, was **zusätzlich** einschränkt — ein Reiter in einer Beta-Seite
   bekommt kein zweites `beta` (Guard `sichtbarkeit-keine-doppelmarke`).
2. **Keine Marke neben einer gleich engen Sperre.** Was ein dev-Flag oder `kuratorOnly` schon auf
   dieselbe Zielgruppe eingrenzt, bekommt keine zweite Abfrage obendrauf — sonst wären die
   DEV-Panels ausgerechnet im dev-Build standardmäßig weg. Ein Feature-Flag, das im pl-Build AN
   ist (`vorgangssystem`, `statusCockpit`, `anfragen`), grenzt dagegen keine Zielgruppe ein: dort
   trägt die Marke etwas bei.
3. **Unantastbares bleibt unantastbar** — `seite:home`, `seite:einstellungen`,
   `reiter:einstellungen/profil`, `abschnitt:einstellungen/sec-umfang`, `…/sec-kurator`,
   `…/sec-freischaltung`, `seite:kuration`, `reiter:kuration/sichtbarkeit`,
   `abschnitt:kuration/sec-sichtbarkeit`. Über sie erreicht man die Schalter, den Kurator-Zugang
   und die Modul-Freischaltung; eine Marke darauf hätte keinen Rückweg. Der Store ignoriert
   Abweichungen an ihnen auch dann, wenn jemand die Sidecar von Hand editiert.
4. **Jede Seite mit Reitern behält mindestens einen unmarkierten Reiter**, und der gemerkte
   Reiter fällt auf den ersten sichtbaren zurück — `useSichtbareReiter()` macht beides in einem.
   Ohne den Rückfall stünde ein Inhalt ohne zugehörigen Reiter da (dieselbe Klasse wie v4.107.2).
5. **Keine Ableitung aus `category: 'erprobung'`.** Die Beta-Menge deckt sich heute mit dieser
   Sidebar-Gruppe, bleibt aber eine eigene Aussage — sonst wechselte eine Seite ihre Sichtbarkeit
   als Nebenwirkung eines Umsortierens.

## Durchsetzungsstellen

| Ebene | Wo |
|---|---|
| Seite | `visiblePlugins`-Memo in [ShellLayout.tsx](../../src/core/ShellLayout.tsx) — deckt Sidebar, Command-Palette und Shortcuts in einem Zug ab |
| Reiter | `useSichtbareReiter()` an der jeweiligen Tab-Liste |
| Abschnitt in Einstellungen/Datenpflege | [SettingsHubPage](../../src/components/settings/SettingsHubPage.tsx) filtert Panels + Abschnitte (Navigation **und** Suchindex); **alle vier** Layout-Bauteile (`SettingsGruppe`, `SettingsOption`, `SettingsBlock`, `SettingsKlappe`) prüfen sich über `HubPluginContext` selbst — Guard `sichtbarkeit-alle-bauteile` (bis v4.116 taten es nur die ersten beiden, 9 von 16 markierten Abschnitten blieben stehen) |
| Abschnitt der Verbund-Detailseite | `Sektionsrahmen` bzw. `WennDetailSektion` in [detailRahmen.tsx](../../src/plugins/antraege/detailRahmen.tsx) |
| Karte auf einer Fachseite | `<WennSichtbar id={abschnittId('<seite>', 'karte-<name>')}>` — siehe unten |
| Startseiten-Widget | `widgetAnzeigbar()` in [homeWidgetsStore.ts](../../src/plugins/home/widgets/homeWidgetsStore.ts) — die eine Stelle, an der `verfuegbar`, `sichtbarWenn()` und die Marken zusammenkommen |

**Widgets: verborgen heißt nie entfernt.** Eine Instanz bleibt in der persönlichen Config stehen
und wird nur nicht gerendert — sonst verlöre ein Beta-aus/an-Wechsel die Anordnung. Die
Persistenz-Invariante (IDB-primär, nur Personal-Mirror, Guard `home-widgets-local-only`) bleibt
unangetastet; die Marken kommen aus dem team-weiten Sidecar.

**Deep-Link ins Verborgene:** `SettingsHubPage` zeigt bei `?sektion=<verborgen>` eine Zeile mit
dem Weg zu den Schaltern, statt stumm nichts zu tun.

## Karten auf den Fachseiten (v4.114)

Einstellungen und Datenpflege haben eine Abschnitts-Registry, die Verbund-Detailseite eine
`DetailSektionId`-Union — dort entsteht die Id von selbst. Auf den übrigen Fachseiten stehen die
Karten als nacktes JSX; sie tragen ihre Id über eine Hülle. Drei Konventionen dazu:

1. **Eine Karte mit eigener Überschrift = ein Katalog-Eintrag**, Schlüssel `karte-<name>`. Was
   keine Überschrift hat, bleibt Teil seines Wirts.
2. **Die Id steht als Literal im Baum** — `abschnittId('auslastung', 'karte-statistik')`, nie aus
   einem Prop zusammengesetzt. Nur so findet der Guard `sichtbarkeit-ids-existieren` sie, und der
   sichert beide Richtungen: keine Id ohne Katalog-Eintrag, kein Karten-Eintrag ohne Hülle (ein
   Schalter in der Kurator-GUI, der nichts schaltet).
3. **Wo mehrere Karten denselben Rahmen teilen**, steht eine lokale `Karte`-Hülle am Dateiende
   (`CockpitSichten.tsx`, `UebersichtTab.tsx`) und bekommt die fertige Id als Prop — das hält die
   Literale am Aufrufort und den Rahmen an einer Stelle.
4. **Trennstriche zwischen Karten müssen mitverschwinden.** Eine feste Folge
   `Karte · Strich · Karte` wird zum führenden oder doppelten Strich, sobald eine Karte verborgen
   ist. Deshalb rendert `EinstellungenView` (Auslastung) seine vier Sektionen als gefilterte Liste
   und setzt den Strich aus dem Index. Wo der Wirt mit `gap-*` arbeitet, ist nichts zu tun.

**Fast alle 19 Karten stehen ohne Marke** — nicht aus Nachlässigkeit, sondern nach Regel 1: ihre
Wirte sind bereits markiert (Vorgangs-Regeln = `beta`+`experte`; Aufbereitung und Vorgangs-Board
= `beta`; die Reiter „Verwaltung", „Auswertung", „Recherche" = `experte`; Auslastung hängt am
Modul-Schloss). Der Eintrag ist trotzdem da: er ist der Griff, den der Kurator braucht, sobald er
einen Wirt **lockert**. Genau eine Karte trägt selbst eine Marke —
`abschnitt:aufbereitung/karte-externe-recherche` ist `experte`, weil sie ein Wegweiser auf den
Reiter „Recherche" ist und ohne ihn eine Sackgasse wäre.

| Seite | Karten |
|---|---|
| Vorgangs-Regeln | Referenzdaten (Vorgangssystem) · Versionen |
| Auslastung | Statistik-Übersicht · Mitarbeiter & Kapazität · Überkategorien · Import / Export · Konfiguration · Themen-Vektoren |
| Vorgangs-Board | Verteilung über die ZAH-Phasen · Stau je Rolle · Liegezeit je Status · Fristrisiko |
| Antrag-Aufbereitung | **Externe Recherche** ‹exp› · Interne Aufbereitung · Deterministische Aufbereitung · Deep Research starten · Marktzugang des KMU · Ergebnis zurückbringen · Einzel-Suchanfragen |

Nicht katalogisiert sind Karten, die aus Daten entstehen (die To-do-Gruppen des Boards, die
Phasen-Details der Vorgangs-Regeln), Dialoge und die Karten der dev-Panels.

## Kuration

Der Code bringt die Vorbelegung mit; der Kurator überschreibt einzelne Einträge in
`_intern/sichtbarkeit.json`. Gespeichert werden **nur Abweichungen**, je Eintrag der **volle**
Marken-Satz:

```jsonc
{ "version": 1, "updatedAt": "…", "autor": "…",
  "abweichungen": { "reiter:suche/suchsprache": [], "seite:meilensteine": ["beta", "experte"] } }
```

So schlagen spätere Katalog-Änderungen überall dort durch, wo der Kurator nichts entschieden hat.
Schreib-Profil: idempotent-overwrite (Pitfall #23) über `schreibeSidecar`; der schreibende Pfad
liest zuerst die **Lage** und bricht bei `unlesbar` ab (Regel v4.12). **Unbekannte Ids bleiben in
der Datei stehen** und werden nur nicht ausgewertet — ein Rückbau darf keine fremde Kuration
löschen. Audit-Eintrag: `sichtbarkeit_geaendert`.

Geladen wird zweistufig, wie beim Status-Katalog: beim Start aus dem IDB-Cache (gilt sofort, auch
offline und vor dem Ordner-Picker), nach dem Permission-Grant noch einmal vom Share.

### Die Oberfläche: ein Baum, kein Stapel Kästen

192 Zeilen in 21 Kästen hießen, an neunzig Zeilen vorbeizuscrollen, um eine zu finden. Seit v4.115
ist es ein `TfTree` ([sichtbarkeitBaum.ts](../../src/plugins/kuration/sichtbarkeit/sichtbarkeitBaum.ts)) —
**zugeklappt 21 Zeilen auf 490 px, also eine Bildschirmhöhe ohne Seiten-Scroll**. Vier Entscheidungen
dabei:

- **Die Seite ist ihr eigener Ordner.** Sie ist ein Katalog-Eintrag wie jeder andere und trägt
  deshalb Marken in derselben Zeile, in der ihr Chevron sitzt. Eine Seite ohne Reiter oder
  Abschnitte ist **kein** Ordner — ein Chevron, das nichts aufklappt, verspricht etwas.
- **Zugeklappt steht „N markiert" an der Zeile.** Ohne diese Zahl müsste man jede der 21 Seiten
  öffnen, um zu sehen, wo überhaupt etwas steht — und genau das Scrollen sollte der Baum abschaffen.
- **Der An-Zustand trägt Fläche.** `Beta` nimmt die Farbe des Abzeichens, das es erzeugt
  (`Badge variant="info"`, 6,3:1), `Experte` die neutrale Vollfüllung (19,5:1); der Aus-Zustand
  bleibt ein bloßer Umriss (5,3:1). Vorher war der An-Zustand eine `bg-secondary`-Tönung gegen einen
  Hauch kräftigeren Rand — auf dem Schirm kaum zu unterscheiden. Zwei verschiedene An-Bilder sind
  hier richtig, nicht inkonsequent: `Beta` hat ein sichtbares Abzeichen in der App, `Experte` nicht,
  und die Leiste ist damit ihre eigene Legende.
- **Der Rückstell-Weg ist ein Zeichen, kein Satz.** „zurück auf Vorgabe (Standard)" sprengte die
  Zeile; jetzt steht dort ein Pfeil-Knopf, dessen `title` die Vorgabe nennt.

Interaktive Elemente im `trailing`-Slot brauchen `stopPropagation` — sonst klappt der Klick auf
einen Marken-Chip zugleich den Zweig auf (tree-komponenten.md).

## Vorbelegung (Stand v4.117)

**199 Einträge, 46 markiert**: 23 nur `beta`, 18 nur `experte`, 5 beides. 153 bleiben Standard.
Mit beiden Schaltern aus verschwinden 8 der 18 Nav-Einträge samt ihrer Reiter.

| Marken | Seiten |
|---|---|
| `beta` | `meilensteine`, `zu-klaeren`, `vorgangs-board`, `anfragen`, `dokumente`, Route `aufbereitung` |
| `beta`+`experte` | `status-cockpit`, `map-foerderfaehig` |
| `experte` | `skill-verwaltung-kuration` |

Die übrigen Marken sitzen an Reitern („Verwaltung", „Recherche", „Konfiguration", „Auswertung",
„Textbausteine", „Dienste"), an Abschnitten (die Assistent-Gruppe, die „Selten gebraucht"-Karten
der Datenpflege, Rohfeld- und Diagnose-Abschnitte) und an vier Widgets.
Die vollständige Liste steht genau einmal — in [katalog.ts](../../src/core/sichtbarkeit/katalog.ts).

Die Vorbelegung ist **kuratierbar, nicht gesetzt**: Wo das Team im laufenden Betrieb anders
entscheidet, wandert die Entscheidung in den Katalog zurück, statt als Abweichung auf dem Share zu
verharren — sonst erklärt die Sidecar irgendwann die halbe App. So sind mit v4.117 der
Gutachten-Workflow, die Kurzfassung, die Antrags-Meilensteine, „Alle Felder", „Suchsprache" und der
Frage-Reiter der Suche auf Standard gerückt, „Statuseinträge", „Werkbank", „Widerspruch" und die
Seite „Dokumente" auf `beta`, und „Programme" wie „CSV-Datenimport" der Datenpflege auf `experte`.

## Guards

[katalog-konventionen.test.ts](../../src/core/sichtbarkeit/__tests__/katalog-konventionen.test.ts):
`sichtbarkeit-katalog-deckt-plugins` · `sichtbarkeit-deckt-widgets` ·
`sichtbarkeit-deckt-detailsektionen` · `sichtbarkeit-ids-existieren` (beide Richtungen, s. o.) ·
`sichtbarkeit-unantastbar` · `sichtbarkeit-seite-behaelt-reiter` · `sichtbarkeit-keine-doppelmarke` ·
`sichtbarkeit-eine-mechanik` (niemand liest `profile.beta_features`/`experten_modus` selbst).

Der letzte ist ein echter Codebase-Scan mit Inline-Ausnahme
`// allow-sichtbarkeit-eine-mechanik: <grund>`; erlaubt sind nur `useSichtbar.ts`, `config.ts`
und die Schreibstelle `UmfangGruppe.tsx`.

## Ein neues Element markierbar machen

1. Eintrag in `katalog.ts` ergänzen (`seite()` / `reiter()` / `abschnitt()` / `widget()`),
   Vorbelegung nach den fünf Regeln oben.
2. An der Stelle prüfen: Reiter → `useSichtbareReiter()`; Karte → `<WennSichtbar>` mit der Id als
   **Literal**; Abschnitt in einem Hub → nichts zu tun, `SettingsGruppe` prüft sich selbst.
3. `npm run check:docs` — die Guards fangen fehlende und verwaiste Ids sofort.
