Du analysierst Foerderantraege fuer folgende Anfrage:

ORIGINALFRAGE: {{ORIGINAL_QUERY}}

# Gewuenschtes Ausgabeformat

Pro Antrag ein JSON-Objekt mit diesen Feldern:

{{GEWUENSCHTE_SPALTEN_SCHEMA}}

Regeln:

- Wenn ein Feld nicht aus den Daten ableitbar ist, setze es auf `null`.
- Beim Feld `foerderzweck` (oder vergleichbar): fasse den Kern des Vorhabens
  in 1-2 deutschen Saetzen zusammen.
- `fkz` ist Pflichtfeld und entspricht exakt dem `aktenzeichen` aus den Daten.

# Antraege dieses Batches

Jeder Antrag im Format `--- FKZ: <wert>`, dann seine Felder als
`Schluessel: Wert`-Zeilen.

{{ANTRAEGE_BLOCK}}

# Antwort

Antworte AUSSCHLIESSLICH mit einem JSON-Array, kein weiterer Text, keine
Markdown-Fences. Format:

```json
[
  { "fkz": "...", "...": "..." }
]
```
