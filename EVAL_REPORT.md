# Search Eval Report

**Datum**: 30.3.2026, 08:07:14
**Modell**: Xenova/all-MiniLM-L6-v2
**Chunks**: 460 | **Dokumente**: 100
**Dauer**: 371 ms

## Zusammenfassung

| Metrik | Wert |
|---|---|
| Bestanden | 17/20 (85%) |
| Avg Precision@3 | 50% |
| Avg Precision@5 | 61% |
| Top-1 Accuracy | 75% |

## Nach Kategorie

| Kategorie | Bestanden |
|---|---|
| keyword | 5/5 |
| semantic | 12/15 |

## Nach Schwierigkeit

| Schwierigkeit | Bestanden |
|---|---|
| easy | 7/8 |
| hard | 2/4 |
| medium | 8/8 |

## Einzelergebnisse

| # | Query | Erwartet | Top-1 | Top-1 OK | In Top5 | Pass |
|---|---|---|---|---|---|---|
| K1 | Brandschutz | 5 docs | Brandschutz_BA013.md | - | 3/5 | ja |
| K2 | Tiefgarage | 2 docs | BA-2026-010 | - | 1/2 | ja |
| K3 | Perowskit | 1 docs | FA-2026-002 | nein | 1/1 | ja |
| K4 | Holzrahmenbau | 2 docs | Schallschutz_BA011.md | - | 1/2 | ja |
| K5 | Nachforderung | 2 docs | Nachforderung_BA004.md | - | 2/2 | ja |
| S1 | Wie evakuiert man Kleinkinder? | 2 docs | Compliance_FA011.md | nein | 2/2 | ja |
| S2 | Gebaeude Energie sparen | 3 docs | Energienachweis_BA002.md | - | 2/3 | ja |
| S3 | Nachbar klagt wegen Schatten | 1 docs | Stellungnahme_Nachbar_BA002.md | ja | 1/1 | ja |
| S4 | Gift im Boden | 1 docs | Altlastengutachten_BA006.md | ja | 1/1 | ja |
| S5 | altes Haus renovieren | 2 docs | Review_FA003.md | - | 0/2 | NEIN |
| S6 | Grundwasser Baugrube | 2 docs | Hydrogeologie_BA010.md | ja | 1/2 | ja |
| S7 | Kuenstliche Intelligenz Infrastruktur | 3 docs | BA-2026-020 | - | 1/3 | ja |
| S8 | Tierversuche Ethik | 2 docs | Ethik_FA003.md | ja | 2/2 | ja |
| S9 | Datenschutz bei KI | 2 docs | Datenschutz_FA014.md | ja | 2/2 | ja |
| S10 | Batterie Recycling | 2 docs | Projekt_FA009.md | ja | 1/2 | ja |
| S11 | Bruecke fuer Fahrraeder | 2 docs | Brandschutz_BA018.md | - | 1/2 | ja |
| S12 | Senioren Wohnung barrierefrei | 2 docs | Bauantragsformular_BA018.md | - | 1/2 | ja |
| S13 | Feuerwiderstand Rettungswege | 3 docs | Brandschutz_BA013.md | - | 2/3 | ja |
| S14 | Waermedaemmung Aussenwand | 2 docs | Statik_Tragwerk_BA011.md | - | 0/2 | NEIN |
| S15 | Foerdergelder Nachhaltigkeit | 3 docs | FA-2026-009 | - | 0/3 | NEIN |

## Fehlgeschlagene Tests (Details)

### S5: altes Haus renovieren

**Erwartet**: Stellungnahme_Denkmalschutz_BA005.md, Stellungnahme_Denkmalschutz_BA021.md

**Top-5 Ergebnisse**:

1. Review_FA003.md (score: 0.0164, method: keyword)
2. Hydrogeologie_BA010.md (score: 0.0164, method: vector)
3. Stellungnahme_Umwelt_BA019.md (score: 0.0161, method: keyword)
4. Energienachweis_BA009.md (score: 0.0161, method: vector)
5. Artenschutz_BA019.md (score: 0.0159, method: keyword)

### S14: Waermedaemmung Aussenwand

**Erwartet**: Energienachweis_BA001.md, Energienachweis_BA002.md

**Top-5 Ergebnisse**:

1. Statik_Tragwerk_BA011.md (score: 0.0164, method: keyword)
2. Schallschutz_BA002.md (score: 0.0164, method: vector)
3. Schallschutz_BA002.md (score: 0.0161, method: keyword)
4. Artenschutz_BA019.md (score: 0.0161, method: vector)
5. Bauantragsformular_BA012.md (score: 0.0159, method: keyword)

### S15: Foerdergelder Nachhaltigkeit

**Erwartet**: Projekt_FA009.md, Projekt_FA013.md, Projekt_FA016.md

**Top-5 Ergebnisse**:

1. FA-2026-009 (score: 0.0164, method: keyword)
2. Energienachweis_BA009.md (score: 0.0164, method: vector)
3. Bauantragsformular_BA018.md (score: 0.0161, method: vector)
4. Zwischenbericht_FA004.md (score: 0.0159, method: vector)
5. Review_FA001.md (score: 0.0156, method: vector)
