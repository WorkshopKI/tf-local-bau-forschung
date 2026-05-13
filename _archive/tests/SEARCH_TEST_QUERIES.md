# Semantische Such-Test-Queries

Nach dem Indexieren (Admin → Index erstellen) diese Queries testen:

| Query | Erwartete Top-Ergebnisse | Test-Typ |
|---|---|---|
| "Brandschutz" | Brandschutz_*.md | Keyword (einfach) |
| "Feuerwiderstand Rettungswege" | Brandschutz_*.md | Keyword + Semantik |
| "Wie evakuiert man Kleinkinder?" | Brandschutz_BA012.md (Kita) | Rein semantisch |
| "Gebäude Energie sparen" | Energienachweis_*.md | Semantisch (Paraphrase) |
| "Wärmedämmung Außenwand" | Energienachweis_BA001.md | Fachbegriff |
| "Nachbar klagt wegen Schatten" | Stellungnahme_Nachbar_BA002.md | Umgangssprache |
| "altes Haus renovieren" | Stellungnahme_Denkmalschutz_*.md | Umgangssprache |
| "Gift im Boden" | Altlastengutachten_BA006.md | Umgangssprache → Fachtext |
| "Grundwasser Baugrube" | Hydrogeologie_BA010.md | Fachlich |
| "Künstliche Intelligenz Infrastruktur" | Projekt_FA001.md, Projekt_FA011.md | Semantisch |
| "Tierversuche Ethik" | Ethik_FA003.md | Semantisch |
| "Datenschutz bei KI" | Datenschutz_FA014.md | Semantisch |
| "Brücke für Fahrräder" | Statik_BA024.md, BA-2026-024 | Umgangssprache |
| "Batterie Recycling" | Projekt_FA009.md | Synonym |
| "Senioren Wohnung barrierefrei" | BA-2026-018, Brandschutz_BA018.md | Kombination |
