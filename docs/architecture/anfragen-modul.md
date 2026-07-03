# Modul „Anfragen" — E-Mail-Kurzanfrage → anonymisierte externe Antwort

Ist-Zustand des Plugins `src/plugins/anfragen/` (eingeführt v2.129.0, Varianten-Rollout bis v2.153).
Ziel: Eine kurze E-Mail-Anfrage (Outlook-`.msg`) wird **intern** anonymisiert, die anonyme Fassung
in einem **externen** Claude-Artifact („ZIM-FAQ-Assistent") beantwortet, und die Antwort **deterministisch**
wieder mit den Originaldaten befüllt — mail-fertig an den Original-Absender. Kein Byte echter PII verlässt
je den internen Perimeter automatisch; die einzige technische Grenze nach außen ist die Zwischenablage,
und die ist per Guard abgesichert.

> **DSGVO-Einordnung:** Der Anonymisierungs- und der Polish-Lauf sind dokument-tragende Skill-Läufe und
> laufen ausschließlich über die interne Bridge — Detail + Begründung in Pitfall #30 /
> [transport-policy.md](transport-policy.md). Dieses Doc verlinkt nur darauf, dupliziert es nicht.

## Pipeline (fünf Status)

`Anfrage.status` durchläuft (`types.ts`):

`aufgenommen` → `anonymisiert` → `export_freigegeben` → `antwort_importiert` → `finalisiert`

1. **Aufnahme** ([aufnahme.ts](../../src/plugins/anfragen/aufnahme.ts) → [parse-msg.ts](../../src/core/services/msg/parse-msg.ts)):
   `.msg`-Datei wird body-only geparst — **CFB + TextDecoder + Turndown**, bewusst **nicht** `msgreader`
   (dessen `iconv-lite`/`Buffer`-Abhängigkeit crasht unter `file://`; `cfb` ist ohnehin via `xlsx` gebündelt).
   Extrahiert wird nur: Betreff, Absender (SMTP bevorzugt, Exchange-X.500-DN als Fallback), Body
   (Plain → HTML→MD → RTF-Hinweis) und die **Anzahl** der Anhänge. Anhänge werden **nie** geöffnet
   (sie tragen nicht weganonymisierbare IP/Properties). Ergebnis: `AnfrageInit` → `createAnfrage()` im Status `aufgenommen`.
2. **Anonymisierung** ([services/anonymisierung.ts](../../src/plugins/anfragen/services/anonymisierung.ts)):
   Der **Original-Mailtext ist vorab editierbar** — die linke Spalte in
   [AnonymisierungView.tsx](../../src/plugins/anfragen/AnonymisierungView.tsx) ist ein Inline-Editor (Textarea +
   PII-Highlight-Backdrop, dasselbe Muster wie das anonyme Pane), auto-persistiert on-blur nach `originalMd`.
   Zweck: Anrede/Signatur oder Text entfernen, der die KI irritiert. `runAnonymisierung()` läuft gegen den
   (ggf. editierten) Text und fährt den `anfrage-anonymisieren`-Skill über `bridge.getTransportForSkillRun(skill)`
   (interner Transport erzwungen). **Zwei Stufen in einem Lauf**:
   - **Pseudonymisierung** harter Identifier → Platzhalter `[TYP_N]` + `mapping[]` (Platzhalter↔Original).
   - **Verallgemeinerung** identifizierenden Freitexts → `verallgemeinerungen[]` (`original`→`verallgemeinert`);
     **kein** Platzhalter, **keine** Wiedereinsetzung — der Freitext wird weg-generalisiert, nicht zurückgeholt.
   Tolerantes Parsing (`parseAnonymisierung`) holt das `{anonymisiert, mapping, verallgemeinerungen}`-Objekt
   auch aus verrauschtem/getrunkatem Output (balanciertes Objekt + `"anonymisiert"`-Anker gegen Reasoning-Reste).
   **Bounded Retry** (3×, 700 ms): die Streamlit-Bridge finalisiert unter Last gelegentlich zu früh mit einer
   Teil-Antwort → ein frischer `tf-request` liefert quasi sicher die volle Antwort. Status → `anonymisiert`.
3. **Export** ([AnonymisierungView.tsx](../../src/plugins/anfragen/AnonymisierungView.tsx)):
   Der anonyme Text bleibt **editierbar** mit **live** `pruefeExportSicher` (Export-Guard, s. u.). Beim
   Kopieren wird gegen den **tatsächlich zu kopierenden** (ggf. editierten) Text geprüft; die externe
   ZIM-FAQ-Assistent-URL kommt aus `resolveAnfragenDashboardUrl()`. Status → `export_freigegeben`.
4. **Import** ([AntwortView.tsx](../../src/plugins/anfragen/AntwortView.tsx)):
   Die anonyme externe Antwort wird eingefügt (`externeAntwortAnon`), mit **live** `wiedereinsetzenSegmente`
   als Vorschau (eingesetzte Originale blau markiert). Status → `antwort_importiert`.
5. **Finalisierung** ([services/finalisierung.ts](../../src/plugins/anfragen/services/finalisierung.ts)):
   `finalisiere()` = (optional interner Polish auf der **anonymen** Antwort →) **deterministisches**
   `wiedereinsetzen()` (reines Find-Replace `platzhalter → original`, **nie** LLM — kein Halluzinationsrisiko).
   Der optionale Polish läuft strikt **vor** der Wiedereinsetzung (Anti-Pattern: Polish nach Wiedereinsetzung
   könnte echte Werte verändern) und muss alle `[TYP_N]` unverändert lassen. Ausgabe: Copy oder `mailto:` an
   den Original-Absender (`Re: <Betreff>`). Status → `finalisiert`.

## Datenmodell (`types.ts`)

`Anfrage` hält den ganzen Lebenszyklus in einem Record:

| Feld | Zweck | Sensibilität |
|---|---|---|
| `absenderEmail`, `betreff`, `hatAnhaenge` | Aufnahme-Metadaten (für mailto/Anzeige) | – |
| `originalMd` | Body als Markdown — **vor dem Anonymisieren editierbar** | **echt — nur lokal/intern** |
| `anonymisiertMd` | anonyme, editierbare Fassung | export-fähig (nach Guard) |
| `mapping: Mapping[]` | `{platzhalter, original, typ}` | **SENSIBELSTE Struktur — nie serialisieren/transportieren** |
| `verallgemeinerungen: Verallgemeinerung[]` | `{original, verallgemeinert}` | `original` **nur lokal**; `verallgemeinert` exportiert |
| `anonBasisHash?` | Non-Crypto-Hash des `originalMd` zum Anon-Zeitpunkt (Stale-Erkennung) | opak — nur lokal |
| `externeAntwortAnon` | eingefügte anonyme Antwort | anonym |
| `finaleAntwort` | wiedereingesetzt, mail-fertig | echt — an Original-Absender |

`PiiTyp`: `person | firma | ort | fkz | email | telefon | iban | x500 | hostname | sonstiges`.

**Guard `anfrage-no-mapping-in-transport`** ([codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts)):
`mapping`, `originalMd` und `verallgemeinerungen[].original` dürfen nie an Transporte/Serialisierung gelangen.

## Persistenz (`persistence.ts`, `store.ts`)

- Generischer **`kv`-Store**, Key `anfrage:<id>` — dasselbe Profil wie WorkflowRun/Dokumente: Exact-Key-Lookup,
  **kein** dedizierter Object-Store/Version-Bump (ein Bump triggert unter `file://` mit parallel offenen
  Varianten ein `onblocked`-Upgrade — [recurring-bug-classes.md](recurring-bug-classes.md) §3).
- Rein **additive** Felder; `normalizeAnfrage()` defaultet `mapping`/`verallgemeinerungen` beim Lesen auf `[]`
  (Alt-Records ohne diese Felder crashen nicht). `anonBasisHash` bleibt optional (`undefined` bei Alt-Records).
- **Stale-Gate nach Original-Edit** ([original-hash.ts](../../src/plugins/anfragen/original-hash.ts)): Beim
  Anonymisieren wird `hashText(originalMd)` als `anonBasisHash` gestempelt. Editiert der User den Originaltext
  danach, meldet `istOriginalStale()` die anonyme Fassung als veraltet → Badge/Hinweis „Originaltext geändert",
  **Export gesperrt** bis zur Re-Anonymisierung (orthogonal zum PII-Export-Guard). Rück-Edit auf den identischen
  Text löst das Gate wieder (Hash-Vergleich). Bestandsschutz: Alt-Records ohne `anonBasisHash` gelten nie als
  veraltet. `hashText` ist ein synchroner **Non-Crypto**-Hash (FNV-1a, nur Änderungserkennung).
- Zustand-Store (`useAnfragenStore`): jede Mutation = ein `put`/`delete` + ein finales `set`
  (Save-Lock-Disziplin, Pitfall #16/#20). View-Modus als reine UI-Präferenz in `localStorage`
  (`teamflow_anfragen_view_mode`).

## Export-Guard (`services/export-guard.ts`)

Da die App **nichts** automatisch sendet, ist der Guard die einzige technische Grenze zwischen echter PII
und Zwischenablage — bewusst **over-detecting** (Over-Blocking ist der sichere Fehler). `pruefeExportSicher()`
läuft bei **jedem** Kopier-Klick auf dem tatsächlichen Text, in zwei Stufen:

1. **Mapping-Gegenscan** — taucht irgendein `mapping[].original` (case-insensitiv, whitespace-tolerant)
   noch im Text auf → Leak.
2. **Pattern-Scan** residualer PII: **E-Mail**, **FKZ** (`\d{2}[A-Z]{2}\d{4,}`), **IBAN** (DE + generisch),
   **X.500-DN** (`/O=…/OU=…/CN=…`), **Hostnames/FQDNs** (≥3 Labels), **Telefon** (+49 / 0-Vorwahl mit
   Trenner, `minDigits`-Schwelle schließt Datumsangaben aus).

## Externe URL-Auflösung (`settings.ts`)

`resolveAnfragenDashboardUrl()` mit **3 Stufen**: **Share-Override** (`_intern/anfragen-settings.json`,
Schreib-Profil idempotent-overwrite + Audit) → **IDB-Cache** (Offline-Mirror) → **Code-Default**
`DEFAULT_ANFRAGEN_DASHBOARD_URL` ([feature-flags.ts](../../src/config/feature-flags.ts), einzige Code-Quelle).
Der Sidecar ist Mirror, nicht Master — fehlt er / ist der Share offline, bleibt die App über den Fallback
funktional. Team-weite Änderung: Kuration-Plugin `anfragen-kuration` (kuratorOnly).

## Varianten-Verfügbarkeit & Skill-Gate

- **Modul-Flag `features.anfragen`**: aktiv in **dev + pl + as + kurator**; aus in **prod**
  ([configs/](../../configs/)). Plugin gegated über `featureFlag: 'anfragen'` ([index.ts](../../src/plugins/anfragen/index.ts)):
  Workflow-Plugin `anfragen` (order 6) + Kuration-Plugin `anfragen-kuration` (kuratorOnly). In **kurator**
  ist das Modul aktiv, damit der Kurator die team-weite ZIM-FAQ-Assistent-URL setzen kann
  ([AnfragenEinstellungenPage](../../src/plugins/anfragen/AnfragenEinstellungenPage.tsx) → `_intern/anfragen-settings.json`);
  die Kuration-Seite erscheint nur bei aktiven Kuration-Menüs (dev + kurator nach Login).
- **Skill-Gate (orthogonal zum Modul-Flag)**: Der `anfrage-anonymisieren`-Skill ist `aktiv: false` **geseedet**
  (Recall-Gate; Produktiv-Freischaltung ist eine bewusste Kurator-Entscheidung). In **dev** überschreibt
  `istAnonymisiererFreigeschaltet()` das per Runtime immer auf freigeschaltet (Entwickler testet ohne den
  geteilten Seed zu berühren); in allen **Produktions-Varianten** (prod/pl/kurator/as) gilt `aktiv: true` als
  Voraussetzung. Der Seed bleibt `aktiv: false` — die Registry wird von diesem Modul **nicht** verändert.
