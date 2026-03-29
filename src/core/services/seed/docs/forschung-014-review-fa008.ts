import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-049',
  filename: 'Review_FA008.md',
  format: 'md',
  tags: ['Review', 'Quanten', 'Reproduzierbarkeit'],
  created: '2026-03-05T10:00:00Z',
  vorgangId: 'FA-2026-008',
  markdown: `---
titel: Peer Review FA-2026-008 Fehlertolerante Quantenalgorithmen für kombinatorische Optimierung
aktenzeichen: FA-2026-008
datum: 2026-03-05
gutachter: Anonymisiert (Reviewer 2)
---

# Peer Review — FA-2026-008 Quantenalgorithmen

## 1. Gesamtbewertung

Der Antrag FA-2026-008 adressiert eine hochrelevante und aktuelle Fragestellung der Quanteninformatik: die Bestimmung der Schwelle, ab der fehlerkorrigierte Quantenalgorithmen einen Vorteil gegenüber klassischen Solvern für kombinatorische Optimierungsprobleme bieten. Die Forschungsfrage ist klar formuliert, die Methodik ist anspruchsvoll und die geplanten Benchmarking-Probleme (TSP, MaxCut, Job Shop Scheduling) sind praxisrelevant und gut gewählt. Das Team um Prof. Qubit hat in den letzten 5 Jahren 12 hochrangige Publikationen im Bereich Quantenalgorithmen vorgelegt (darunter 3 in Physical Review X und 2 in Nature Physics), was die Expertise überzeugend belegt. Der Zugang zum IBM Quantum Network über die DFG-Großgeräteinitiative ist ein wichtiger Pluspunkt, da Hardware-Experimente die Simulationsergebnisse validieren können.

Die Gesamtbewertung ist positiv, aber es bestehen methodische Bedenken, die eine Major Revision des Antrags erforderlich machen. Insbesondere betreffen die Bedenken die Qubit-Overhead-Abschätzung, die Reproduzierbarkeit der Simulationsergebnisse und die fehlende Einbeziehung neuerer klassischer Solver.

## 2. Kritische Anmerkungen

### 2.1 Qubit-Overhead optimistisch geschätzt

Der Antrag schätzt den Qubit-Overhead für Surface Codes auf 1.000:1 (physische zu logische Qubits) bei einer physischen Fehlerrate von 0,1 Prozent und einem Code-Abstand d = 7. Diese Schätzung basiert auf der theoretischen Formel p_L ≈ 0,1 × (p/p_th)^((d+1)/2) mit einer Schwellenfehlerate von p_th = 1 Prozent. Aktuelle experimentelle Ergebnisse (Google Quantum AI, Nature 2023, Suppression of error scaling with surface codes) zeigen jedoch, dass die effektive Schwellenfehlerate in der Praxis bei 0,5–0,8 Prozent liegt (nicht 1,0 Prozent wie im Antrag angenommen), da korrelierte Fehler (Crosstalk zwischen benachbarten Qubits, kosmische Strahlung) die theoretische Schwelle reduzieren. Bei p_th = 0,6 Prozent und p = 0,1 Prozent verdoppelt sich der erforderliche Code-Abstand auf d = 11, und der Overhead steigt auf 2d² - 1 = 241 physische Qubits pro logischem Qubit — bei 2.500 logischen Qubits für TSP-50 wären das 602.500 physische Qubits, nicht 242.500 wie im Antrag angegeben.

Die Diskrepanz zwischen theoretischem und experimentellem Overhead ist ein zentrales Thema der aktuellen Fehlerkorrektur-Forschung und sollte im Antrag ausführlicher diskutiert werden. Empfehlung: Durchführung einer Sensitivitätsanalyse für verschiedene p_th-Werte (0,5, 0,6, 0,8, 1,0 Prozent) und deren Auswirkung auf den Overhead und die Quantenvorteil-Schwelle. Die Ergebnisse sollten als Unsicherheitsband dargestellt werden, nicht als Punktschätzung.

### 2.2 Reproduzierbarkeit und Code-Verfügbarkeit

Der Antrag plant die Veröffentlichung des Benchmarking-Datensatzes (Probleminstanzen) als Open Data, was positiv ist. Allerdings fehlt eine explizite Zusage zur Veröffentlichung des Codes: Die Implementierungen der Quantenalgorithmen (QAOA, VQE mit Surface-Code-Simulation), die Noise-Modelle und die Auswertungs-Skripte sollten als Open-Source-Repositorium (z.B. GitHub, MIT-Lizenz) veröffentlicht werden, um die vollständige Reproduzierbarkeit der Ergebnisse durch andere Forschungsgruppen zu ermöglichen. Im Bereich Quantencomputing, wo die Ergebnisse stark von Implementierungsdetails (Schaltkreis-Transpilation, Fehlermodell-Parameter, Optimierer-Konfiguration) abhängen, ist die Code-Verfügbarkeit essentiell für die wissenschaftliche Glaubwürdigkeit.

Empfehlung: Verpflichtung zur Veröffentlichung des gesamten Codes unter einer Open-Source-Lizenz spätestens mit der ersten Journalpublikation. Die Qiskit-Implementierung sollte als reproduzierbares Jupyter-Notebook mit allen Hyperparametern und Zufallsseeds bereitgestellt werden.

### 2.3 Klassische Solver-Vergleich unvollständig

Der Antrag vergleicht die Quantenalgorithmen mit Gurobi, CPLEX und Simulated Annealing. Es fehlen jedoch neuere klassische Methoden, die für kombinatorische Optimierung State-of-the-Art sind: Tensor-Network-basierte Solver (z.B. DMRG für MaxCut auf planaren Graphen, Pan & Zhang 2022), die für Instanzen mit spezieller Struktur exponentielle Beschleunigung gegenüber Branch-and-Bound bieten. Differentiable Programming Ansätze (Karalias & Loukas 2020, Erdos Goes Neural), die mit Gradientenabstieg auf relaxierten kombinatorischen Problemen arbeiten und bei MaxCut die GW-Approximation übertreffen. Quantum-Inspired Classical Algorithms (Tang 2019, Dequantization), die die Quantenvorteil-Claims für bestimmte Problemklassen widerlegt haben. Der Vergleich mit diesen Methoden ist wichtig, um sicherzustellen, dass ein behaupteter Quantenvorteil nicht auf einem unvollständigen klassischen Benchmark basiert. Die Frage ist nicht nur ob Quantenalgorithmen besser sind als Gurobi, sondern ob sie besser sind als die besten bekannten klassischen Methoden.

### 2.4 Hardware-Zugang nicht vertraglich gesichert

Der Antrag erwähnt den Zugang zum IBM Eagle-Prozessor über das IBM Quantum Network und den Zugang zu Google Sycamore. Für IBM ist der Zugang über die DFG-Großgeräteinitiative dokumentiert (Quotenzusage 100 Stunden/Quartal), aber der Zugang zu Google Sycamore ist nur als Absichtserklärung formuliert (im Antrag: Wir planen Kontaktaufnahme mit Google Quantum AI). Für ein Projekt, das Benchmarking auf verschiedenen Hardware-Plattformen als zentrales Element hat, ist ein ungesicherter Hardware-Zugang ein erhebliches Risiko. Empfehlung: Vor Projektstart eine schriftliche Zusage von Google Quantum AI einholen, oder alternativ: den Fokus auf IBM-Hardware beschränken und Google als Nice-to-have kennzeichnen, nicht als Kernelement.

## 3. Bewertung der Arbeitspakete

Die Arbeitspakete sind logisch aufgebaut und die Zeitplanung ist realistisch. Positiv hervorzuheben ist AP 5 (Quantenvorteil-Schwelle), das die zentrale Forschungsfrage direkt adressiert. Die Methodik der Extrapolation (Skalierungsgesetze der Simulationsergebnisse auf große Problemgrößen) ist jedoch inhärent unsicher, da das Skalierungsverhalten oberhalb der simulierbaren Problemgröße (40–100 Qubits) nicht experimentell verifiziert werden kann. Der Antrag sollte die Unsicherheit der Extrapolation explizit diskutieren und Szenarien für verschiedene Skalierungsannahmen (polynomial, exponentiell, konstanter Overhead) darstellen.

## 4. Empfehlung

Der Antrag wird zur **Major Revision** empfohlen mit folgenden Auflagen: (1) Sensitivitätsanalyse des Qubit-Overheads für realistische p_th-Werte (0,5–1,0 Prozent). (2) Explizite Open-Source-Verpflichtung für Code und Daten. (3) Erweiterung des klassischen Benchmarks um Tensor-Network-Solver und Quantum-Inspired Algorithms. (4) Sicherung des Hardware-Zugangs (mindestens IBM vertraglich, Google als optionale Erweiterung). (5) Diskussion der Extrapolations-Unsicherheit in AP 5. Nach Berücksichtigung dieser Punkte wird der Antrag als förderwürdig eingeschätzt.

Gesamtnote: **2,3 (gut)**. Empfehlung: **Major Revision**, danach voraussichtlich Förderempfehlung.

_Reviewer 2 (anonymisiert)_`,
};
