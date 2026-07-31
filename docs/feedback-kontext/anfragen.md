# Anfragen

**Zweck:** Kurze E-Mail-Anfragen (Outlook `.msg`) DSGVO-sicher extern per KI beantworten — intern anonymisieren, extern beantworten, Antwort automatisch mit Originaldaten befüllen.

**UI-Elemente & Begriffe:**
- **Fünf-Status-Pipeline:** „aufgenommen → anonymisiert → export_freigegeben → antwort_importiert → finalisiert".
- **Aufnahme-Ansicht:** .msg-Import → automatisches internes KI-Tagging.
- **Tabellenansicht:** sortier-/filterbar; die getaggten Metadaten (Art/Thema/Firma) sind Spalten-Filter.
- **Detail-Kopf:** Metadaten-Streifen (Art/Thema/Firma/Name + Status, „(Erneut) taggen").
- **Anonymisierungs-Ansicht:** Original links editierbar (Anrede/Störtext vorab entfernen), anonymer Text rechts editierbar, Export-Guard, „Kopieren" zum externen ZIM-FAQ-Assistenten. Die Präambel weist an: Team-Anrede ignorieren, nur Fragen beantworten, Antwort-Mail an den Absender, Platzhalter erhalten. Wird das Original nach dem Anonymisieren geändert, veraltet die anonyme Fassung (Export gesperrt bis zur Re-Anonymisierung).
- **Antwort-Ansicht:** externe Antwort einfügen, Live-Vorschau der Wiedereinsetzung, Originalwerte blau.
- **Finalisierung** (ohne KI, deterministisch): „Finale Antwort kopieren" als Rich-Text (Markdown→HTML, Formatierung bleibt in Outlook; Haken bei Erfolg); „Kopieren & Mail öffnen" öffnet zusätzlich einen adressierten Leer-Entwurf (Re: <Betreff>, per Strg+V einfügen).

**Typische Aktionen:**
- .msg importieren
- In der Tabelle nach Art/Thema/Firma/Status filtern/sortieren, im Detail neu taggen
- Original bereinigen, anonymen Text kopieren
- Externe Antwort einfügen, Wiedereinsetzung prüfen
- Finalisieren, formatiert kopieren, in Outlook einfügen

## Technik

**Datenmodell dahinter:** `Anfrage`-Record: `absenderEmail`/`betreff`/`hatAnhaenge`, `originalMd` (editierbar), `anonymisiertMd`, `mapping[]` (Platzhalter↔Original, nie transportiert), `verallgemeinerungen[]`, `externeAntwortAnon`, `finaleAntwort`, `anonBasisHash` (Stale-Erkennung), `metadaten` (`antragsart`/`name`/`firma`/`themengruppe` + `status`; `name`/`firma` Klartext-PII, nur lokal; Themengruppe = festes Vokabular). `PiiTyp`: person/firma/ort/fkz/email/telefon/iban/x500/hostname/sonstiges.

**Code:** `src/plugins/anfragen/` — `AnfragenPage.tsx`, `AnfrageTabelle.tsx`, `AnfrageMetadatenStrip.tsx`, `services/metadaten.ts` (Tagging, intern-only), `services/anrede.ts`, `services/anonymisierung.ts` (intern-only), `AnonymisierungView.tsx`, `AntwortView.tsx`, `services/finalisierung.ts` (kein LLM), `services/clipboard.ts` (Rich-Text-Kopie), `services/mailto.ts` (Leer-Entwurf).
