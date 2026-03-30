import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-040',
  filename: 'Projekt_FA008.md',
  format: 'md',
  tags: ['Quanten', 'Algorithmen', 'Optimierung'],
  created: '2026-01-20T10:00:00Z',
  vorgangId: 'FA-2026-008',
  markdown: `---
titel: Fehlertolerante Quantenalgorithmen für kombinatorische Optimierung
aktenzeichen: FA-2026-008
datum: 2026-01-20
antragsteller: Prof. Dr. rer. nat. Michael Qubit, Institut für Quanteninformatik, TU Musterstadt
---

# Fehlertolerante Quantenalgorithmen für kombinatorische Optimierung

## 1. Wissenschaftliche Fragestellung

Quantencomputer versprechen exponentielle Beschleunigung gegenüber klassischen Computern für bestimmte Problemklassen. Für kombinatorische Optimierungsprobleme — eine der wichtigsten Anwendungsdomänen in Industrie und Logistik — ist die Frage des Quantenvorteils jedoch ungeklärt. Die beiden vielversprechendsten Quantenalgorithmen für Optimierung sind der Quantum Approximate Optimization Algorithm (QAOA, Farhi et al. 2014) und der Variational Quantum Eigensolver (VQE, Peruzzo et al. 2014). Beide gehören zur Klasse der variationellen Quantenalgorithmen (VQA), die einen parametrisierten Quantenschaltkreis mit einem klassischen Optimierer kombinieren und damit besonders geeignet für die heutige NISQ-Ära (Noisy Intermediate-Scale Quantum) sind.

Die zentrale Forschungsfrage dieses Projekts lautet: Ab welcher Problemgröße bieten fehlerkorrigierte Quantenalgorithmen einen nachweisbaren Vorteil gegenüber den besten klassischen Solvern (Gurobi, CPLEX, lokale Suchheuristiken) für praxisrelevante kombinatorische Optimierungsprobleme? Bisherige experimentelle Demonstrationen auf NISQ-Hardware (IBM Eagle 127 Qubits, Google Sycamore 72 Qubits) zeigen keinen Quantenvorteil bei den getesteten Problemgrößen (n ≤ 30 Variablen) — klassische Solver lösen diese Instanzen in Millisekunden, während der Quantenalgorithmus Stunden für die Parametrisierung benötigt und durch Rauschen limitiert ist. Die hypothetische Schwelle für einen Quantenvorteil liegt bei n > 100–1000 Variablen, erfordert aber fehlerkorrigierte logische Qubits, deren Realisierung einen enormen Overhead an physischen Qubits voraussetzt (geschätzt 1.000–10.000 physische Qubits pro logischem Qubit mit Surface Codes).

## 2. Methodik

### 2.1 Benchmarking-Probleme

Das Projekt untersucht drei NP-schwere kombinatorische Optimierungsprobleme mit hoher Praxisrelevanz: Travelling Salesman Problem (TSP): Finde die kürzeste Rundreise durch n Städte. Praxisanwendung: Tourenplanung in der Logistik (DHL, Amazon), Leiterplattenverdrahtung. Problemgrößen: n = 10, 20, 50, 100, 200 Städte. MaxCut: Finde die maximale Schnittmenge eines gewichteten Graphen. Praxisanwendung: Netzwerkpartitionierung, VLSI-Design, soziale Netzwerkanalyse. Problemgrößen: n = 20, 50, 100, 200, 500 Knoten. Job Shop Scheduling: Optimiere die Reihenfolge von Aufträgen auf Maschinen zur Minimierung der Gesamtdurchlaufzeit. Praxisanwendung: Produktionsplanung in der Fertigungsindustrie. Problemgrößen: 5×5, 10×10, 15×15, 20×20 (Aufträge × Maschinen).

Für jede Problemgröße werden 100 zufällige Instanzen generiert (kontrollierte Schwierigkeit: Varianz der Kantengewichte, Dichte des Graphen). Die Instanzen werden auf der Projektwebseite veröffentlicht, um Reproduzierbarkeit durch andere Forschungsgruppen zu ermöglichen.

### 2.2 Quantenalgorithmen

**QAOA:** Der QAOA-Schaltkreis besteht aus p Schichten (Tiefe), wobei jede Schicht einen Problem-Hamiltonoperator Hp (kodiert die Zielfunktion als Ising-Modell) und einen Mixer-Hamiltonoperator Hm (erzeugt Übergänge zwischen Lösungen) enthält. Die 2p Parameter (γ₁...γp, β₁...βp) werden durch einen klassischen Optimierer (COBYLA, L-BFGS-B) variationell optimiert. Die Approximationsqualität steigt mit der Schaltkreistiefe p, aber auch die Fehlerakkumulation auf realer Hardware. Das Projekt untersucht QAOA mit p = 1, 2, 4, 8, 16 und den Effekt der Fehlerkorrektur auf die erreichbare Schaltkreistiefe.

**VQE:** Der VQE verwendet einen Hardware-effizienten Ansatz (HEA) mit Ry-Rz-Einzelqubit-Gattern und CNOT-Entangling-Gattern in einer Brick-Layer-Architektur. Die Anzahl der Parameter skaliert linear mit der Qubit-Anzahl und der Schaltkreistiefe. Die Kostenfunktion wird über den Erwartungswert des Problem-Hamiltonoperators gemessen (Pauli-Zerlegung, Shotweise Messung mit 1.000–10.000 Shots je Pauli-String). Der klassische Optimierer ist SPSA (Simultaneous Perturbation Stochastic Approximation), der für verrauschte Kostenfunktionen geeignet ist.

### 2.3 Fehlerkorrektur mit Surface Codes

Der Surface Code ist der am besten geeignete Fehlerkorrekturcode für supraleitende Quantenprozessoren (planare Qubit-Konnektivität, hohe Schwellenfehlerate p_th ≈ 1 Prozent). Ein logisches Qubit im Surface Code besteht aus d² + (d-1)² physischen Qubits bei einem Code-Abstand d (d = 3, 5, 7, 9, 11 werden untersucht). Die logische Fehlerrate skaliert als p_L ≈ 0,1 × (p/p_th)^((d+1)/2), wobei p die physische Fehlerrate ist. Für p = 0,1 Prozent (aktueller Stand bei IBM Eagle) und d = 7: p_L ≈ 10⁻⁸ je Zyklus — ausreichend für Schaltkreise mit 10⁵ Gatter-Operationen.

Der Qubit-Overhead wird wie folgt abgeschätzt: Für n logische Qubits mit Code-Abstand d werden n × (2d² - 1) physische Qubits benötigt. Für TSP mit n = 50 Städten werden n² = 2.500 logische Qubits benötigt (Binärkodierung der Permutationsmatrix). Bei d = 7: 2.500 × 97 = 242.500 physische Qubits. Aktuelle Hardware: IBM Eagle 127, Google Sycamore 72 physische Qubits. Die Lücke zwischen dem Bedarf (>100.000 physische Qubits) und der verfügbaren Hardware (<200 Qubits) beträgt drei Größenordnungen. Das Projekt untersucht, ob Qubit-sparende Kodierungen (Qubit-Recycling, Syndrome-Messung mit mittelfristiger Speicherung) den Overhead auf realistischere Werte reduzieren können.

### 2.4 Noise-Modell und Simulation

Da die aktuelle Hardware für fehlerkorrigierte Algorithmen mit >100 logischen Qubits nicht ausreicht, werden die Quantenalgorithmen auf einem klassischen Simulator mit realistischem Rauschmodell untersucht. Das Rauschmodell basiert auf den kalibrierten Fehlerparametern des IBM Eagle-Prozessors: Einzelqubit-Gatter-Fehlerrate: 2,5 × 10⁻⁴, Zweiqubit-Gatter-Fehlerrate (CNOT): 8,0 × 10⁻³, Auslesefehlerrate: 1,2 × 10⁻², T1-Relaxationszeit: 120 µs, T2-Dephasierungszeit: 80 µs, Gatter-Dauer (Einzelqubit): 40 ns, Gatter-Dauer (CNOT): 380 ns. Der Simulator (IBM Qiskit Aer, GPU-beschleunigt mit cuStateVec auf NVIDIA A100) simuliert bis zu 40 Qubits mit vollem Dichtematrix-Formalismus und bis zu 100 Qubits mit Matrix Product State (MPS)-Approximation.

### 2.5 Klassische Referenz-Solver

Die klassische Referenz wird durch folgende Solver hergestellt: Gurobi 11.0 (Branch-and-Bound, Integer Linear Programming, Laufzeitbegrenzung 3.600 Sekunden), CPLEX 22.1 (vergleichbare Methodik, unabhängige Implementierung), Simulated Annealing (SA, 10⁶ Schritte, geometrisches Abkühlungsschema), und für MaxCut: SDP-Relaxation nach Goemans-Williamson (Approximationsgarantie 0,878). Die klassischen Solver werden auf einem 32-Kern-Server (AMD EPYC 7513, 256 GB RAM) ausgeführt. Die Vergleichsmetrik ist die Approximationsgüte (Verhältnis der gefundenen Lösung zum Optimum) bei gleicher Laufzeit (Wall-Clock-Time) und die Skalierung der Laufzeit mit der Problemgröße.

## 3. Arbeitspakete

AP 1 (Monat 1–8): Implementierung der Quantenalgorithmen (QAOA, VQE) auf Qiskit und der Surface-Code-Simulation. Benchmarking-Instanzen generieren und veröffentlichen. AP 2 (Monat 6–16): Noise-Simulation — systematische Untersuchung des Einflusses von Rauschen auf die Approximationsgüte als Funktion von Problemgröße und Schaltkreistiefe. AP 3 (Monat 10–20): Fehlerkorrektur-Analyse — Qubit-Overhead als Funktion der Ziel-Fehlerrate, Vergleich verschiedener Kodierungen (Surface Code, Bacon-Shor Code, Color Code). AP 4 (Monat 14–24): Hardware-Experimente — Ausführung von QAOA/VQE für kleine Instanzen (n ≤ 20) auf IBM Eagle über IBM Quantum Network (Zugang über DFG-Großgeräteinitiative). AP 5 (Monat 20–30): Quantenvorteil-Schwelle — Extrapolation der Simulationsergebnisse auf große Problemgrößen, Bestimmung der Schwelle n*, ab der der Quantenalgorithmus den klassischen Solver übertrifft (falls eine solche Schwelle existiert). AP 6 (Monat 26–36): Publikation, Open-Source-Code, Abschlussbericht.

## 4. Personal und Ressourcen

1 Postdoc Quanteninformatik (TV-L E14), 2 Doktorand/innen (TV-L E13, je 100 Prozent), GPU-Rechenzeit auf dem NHR-Cluster der TU Musterstadt (geschätzt 500.000 GPU-Stunden NVIDIA A100), IBM Quantum Network Zugang (100 Stunden Eagle-Prozessor je Quartal). Gesamtkosten: 920.000 Euro (36 Monate). Die Ergebnisse werden als Open-Source-Softwarepaket (GitHub, MIT-Lizenz) und als Benchmarking-Datensatz veröffentlicht, um die Reproduzierbarkeit durch andere Gruppen zu gewährleisten. Ziel-Publikationen: Nature Physics, Physical Review X, Quantum Science and Technology.

## Zusammenfassung in einfacher Sprache

Quantencomputer gelten als besonders leistungsfaehig fuer bestimmte Rechenaufgaben, aber ob sie tatsaechlich schneller sind als normale Computer, ist bei vielen Problemen noch nicht bewiesen. Dieses Projekt untersucht, ab welcher Problemgroesse Quantencomputer einen echten Vorteil bringen, zum Beispiel bei der Planung von Lieferwegen oder der Fabriksteuerung. Da heutige Quantencomputer noch zu klein und fehleranfaellig sind, werden die Berechnungen zunaechst am normalen Computer nachgebildet. Die Ergebnisse sollen als frei verfuegbare Software veroeffentlicht werden, damit andere Forschungsgruppen sie nachpruefen koennen.

Musterstadt, den 20.01.2026

_Prof. Dr. rer. nat. Michael Qubit, TU Musterstadt_`,
};
