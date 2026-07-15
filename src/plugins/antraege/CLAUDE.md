# Förderanträge / Gutachten / Aufbereitung — hier zuerst lesen

Docs: [../../../docs/architecture/artefakt-engine.md](../../../docs/architecture/artefakt-engine.md) (GA/NF-Substrat), [../../../docs/architecture/gutachten-kurzfassung.md](../../../docs/architecture/gutachten-kurzfassung.md), [../../../docs/architecture/antrag-aufbereitung.md](../../../docs/architecture/antrag-aufbereitung.md), [../../../docs/architecture/transport-policy.md](../../../docs/architecture/transport-policy.md).

Harte Regeln (Pitfall-Nummern → Root-[CLAUDE.md](../../../CLAUDE.md)):

- **#12** — `Antrag.status`/`Verbund.status` nie gegen ein Literal vergleichen — Kategorie-Helper aus `status-canonical.ts` (`getStatusCategory`/`isTerminalStatus`).
- **#29** — Gutachten-Kurzfassung gilt pro Verbund; Persistenz im `kv`-Store (`gutachten-kurzfassung:<key>`) + Doc-Tag-Relation, kein CSV-Write.
- **#30 / #35** — dokument-tragende Skill-Läufe nur über `bridge.getTransportForSkillRun(skill)`; die DSGVO-Ableitung scannt den `promptTemplate`-Text nach `{{vbMarkdown}}`.
- **#31** — Regel-Kategorie immer über `effektiveKategorie()`; `TYP_ZU_KATEGORIE` lebt nur in `kategorien.ts`.
- **#33** — DOCX-Vorlage je Run FRISCH lesen + SHA-256 in `WorkflowRun.vorlageRef` stempeln.
- **#34** — NF-Bausteine wortgetreu (der Skill-Pfad formuliert nie um, füllt nur Platzhalter).
- **#36** — Streamlit-Skill-Läufe resetten zuerst (`starteFrischenChat` VOR dem Submit).
