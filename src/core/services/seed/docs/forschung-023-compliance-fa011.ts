import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-058',
  filename: 'Compliance_FA011.md',
  format: 'md',
  tags: ['IT-Sicherheit', 'KRITIS', 'BSI'],
  created: '2026-03-08T10:00:00Z',
  vorgangId: 'FA-2026-011',
  markdown: `---
titel: IT-Sicherheitskonzept Digitale Zwillinge für kommunale Wassernetze FA-2026-011
aktenzeichen: FA-2026-011
datum: 2026-03-08
ersteller: IT-Sicherheitsbeauftragter der Stadtwerke Musterstadt
---

# IT-Sicherheitskonzept — Digitale Zwillinge Wassernetze FA-2026-011

## 1. KRITIS-Einordnung und regulatorischer Rahmen

Die kommunale Trinkwasserversorgung der Stadtwerke Musterstadt (180.000 versorgte Einwohner, 4 Wasserwerke, 12 Hochbehälter, 850 km Leitungsnetz) ist als Kritische Infrastruktur (KRITIS) gemäß BSI-Kritisverordnung (BSI-KritisV) eingestuft. Der Schwellenwert für die Einstufung als KRITIS im Sektor Wasser beträgt 500.000 versorgte Einwohner pro Anlage — die Stadtwerke Musterstadt liegen mit 180.000 Einwohnern unterhalb des bundesrechtlichen Schwellenwerts. Jedoch unterliegen sie nach dem NRW-Wassergesetz und der IT-Sicherheitsrichtlinie des DVGW (W 1060) den gleichen IT-Sicherheitsanforderungen. Seit dem IT-Sicherheitsgesetz 2.0 (Mai 2021) und der NIS-2-Richtlinie (EU 2022/2555, nationale Umsetzung voraussichtlich 2025/2026) sind auch kleinere Wasserversorger als wesentliche Einrichtung zu behandeln und müssen ein Mindestniveau an Cybersicherheit gewährleisten.

Das IT-Sicherheitskonzept für den Digitalen Zwilling des Wassernetzes muss die Anforderungen des BSI IT-Grundschutz-Kompendiums (Edition 2024), der DVGW W 1060 (IT-Sicherheit in der Wasserversorgung) und der IEC 62443 (Industrielle Kommunikationsnetze — IT-Sicherheit für Netze und Systeme) erfüllen. Das Konzept adressiert die besonderen Herausforderungen der Konvergenz von IT (Informationstechnologie — Server, Dashboard, ML-Modell) und OT (Operational Technology — Sensoren, SCADA, Pumpensteuerung) im Kontext des Digitalen Zwillings.

## 2. Netzwerksegmentierung IT/OT

### 2.1 Architektur

Die Netzwerkarchitektur folgt dem Purdue Enterprise Reference Architecture (PERA) Modell mit physischer Trennung von OT- und IT-Netzwerk. Das OT-Netzwerk umfasst: Level 0 — Feldgeräte (200 Drucksensoren, 50 Durchflussmesser, 30 Wasserqualitätssensoren, 15 akustische Sensoren), Level 1 — Steuerungsebene (SPS-Controller für Pumpen und Ventile, ABB AC500, RTU an Hochbehältern und Wasserwerken), Level 2 — SCADA-System (Siemens WinCC OA, 2 redundante Server im OT-Netzwerk). Das IT-Netzwerk umfasst: Level 3 — Digitaler Zwilling (Applikationsserver, GPU-Server, PostgreSQL/TimescaleDB, ChromaDB), Level 4 — Enterprise-Netzwerk (E-Mail, ERP, GIS, Dashboard-Zugriff für Mitarbeiter), Level 5 — Internet (nur über Proxy, kein direkter Zugang vom Level 3/4).

Die Trennung zwischen OT (Level 0–2) und IT (Level 3–5) erfolgt über eine Datendrehscheibe (Data Diode oder Industrial Demilitarized Zone, IDMZ). Die IDMZ besteht aus: Einem Einweg-Gateway (Waterfall Security Solutions UniDirectional Gateway, Hardware-basierte Datendiode — physisch nur Datenfluss von OT nach IT möglich, keine Rückkanal-Möglichkeit) für die Übertragung der Sensordaten von SCADA (Level 2) an den Digitalen Zwilling (Level 3). Einem separaten, bidirektionalen Gateway mit Firewall (Fortinet FortiGate 600E, IPS/IDS aktiviert) für die Rückschreibung von Steuerbefehlen vom Digitalen Zwilling an SCADA — dieser Kanal ist standardmäßig gesperrt und wird nur für den Feuerwehrbetrieb (manuell durch den Netzleitstand-Mitarbeiter freigeschaltet, 4-Augen-Prinzip) aktiviert.

### 2.2 Sensor-Kommunikation

Die 295 IoT-Sensoren kommunizieren über LoRaWAN (Long Range Wide Area Network) mit 12 Gateways. LoRaWAN verwendet AES-128-Verschlüsselung auf der Netzwerk- und Applikationsschicht (NwkSKey und AppSKey). Die Schlüssel werden über eine OTAA-Aktivierung (Over The Air Activation) mit dem LoRaWAN-Netzwerkserver (ChirpStack, selbst-gehostet im OT-Netzwerk) ausgetauscht. Die Gateways sind über VPN-Tunnel (IPsec, AES-256, IKEv2) mit dem OT-Netzwerk verbunden. Die Gateways stehen in abgeschlossenen Verteilerschränken (Schließsystem gleich wie Wassernetzzugang, Schlüssel nur bei autorisiertem Personal). Manipulationsschutz: Die Gateways verfügen über einen Tamper-Switch (Alarmierung bei Öffnung des Gehäuses).

## 3. Zugriffskontrolle

### 3.1 Rollenbasierte Zugriffskontrolle (RBAC)

Das RBAC-Konzept definiert folgende Rollen: **Netzleitstand-Mitarbeiter** (Schichtbetrieb 24/7): Lesezugriff auf Dashboard und Alarmmanagement, Quittierung von Alarmen, keine Zugriffsberechtigung auf ML-Modell oder Datenbank. **Netzplaner**: Lesezugriff auf Dashboard, Schreibzugriff auf hydraulisches Modell (EPANET-Parameter), Export von Simulationsergebnissen, kein Zugriff auf Sensordaten im Rohformat. **Data Scientist** (Projektmitarbeiter TU Musterstadt): Zugriff auf ML-Modell (Training, Inferenz), Lesezugriff auf pseudonymisierte Sensordaten (Standort-IDs statt Straßennamen), kein Zugriff auf SCADA. **System-Administrator**: Vollzugriff auf IT-Infrastruktur (Server, Netzwerk, Backup), kein Zugriff auf Antragsdaten oder SCADA-Steuerbefehle. **IT-Sicherheitsbeauftragter**: Lesezugriff auf alle Audit-Logs, kein Schreibzugriff auf operative Systeme.

### 3.2 Multi-Faktor-Authentifizierung

Alle Fernzugriffe (von außerhalb des Stadtwerke-Gebäudes) erfordern eine Multi-Faktor-Authentifizierung (MFA): Faktor 1 — Benutzername und Passwort (Mindestlänge 12 Zeichen, Komplexitätsanforderung nach BSI, Passwortrotation alle 90 Tage). Faktor 2 — Hardware-Token (YubiKey 5 NFC, FIDO2/WebAuthn) oder Software-Token (Microsoft Authenticator, TOTP). Der VPN-Zugang (WireGuard, AES-256-GCM) zum Stadtwerke-Netzwerk ist auf autorisierte Geräte beschränkt (Gerätezertifikate, ausgestellt durch die interne PKI der Stadtwerke). Nicht autorisierte Geräte (BYOD) haben keinen Zugang zum IT- oder OT-Netzwerk.

## 4. Patch-Management und Schwachstellenmanagement

### 4.1 IT-Systeme

Die IT-Server (Linux-basiert: Ubuntu 22.04 LTS für Applikationsserver, PostgreSQL, ML-Inferenz) werden monatlich mit Sicherheitsupdates versorgt (Automatisches Update über apt, nach Test in der Staging-Umgebung). Der GPU-Server (NVIDIA A100, CUDA-Treiber) wird vierteljährlich aktualisiert (NVIDIA Security Bulletins). Die Schwachstellen-Scans erfolgen wöchentlich mit OpenVAS (Greenbone Vulnerability Manager, CVE-Datenbank aktuell).

### 4.2 OT-Systeme und Sensoren

Das Patch-Management im OT-Bereich ist besonders kritisch, da Updates die Verfügbarkeit der Wasserversorgung gefährden können. Die Patch-Strategie folgt der IEC 62443 und dem BSI-Grundschutz-Baustein IND.2.7 (Safety Instrumented Systems): Sicherheitsupdates für SCADA-Server (Siemens WinCC OA): nach Freigabe durch den Hersteller (Siemens ProductCERT), Installation während geplanter Wartungsfenster (quartalsweise, Nachtschicht), Test in der Offline-Testumgebung (Mirror-SCADA) vor der Installation im Produktivsystem. Firmware-Updates für IoT-Sensoren (Endress+Hauser): Over-the-Air-Update über LoRaWAN (FUOTA — Firmware Update Over The Air, LoRaWAN 1.1), nur nach Test an 5 Sensoren (Pilotgruppe) und 7-tägiger Beobachtung. SPS-Firmware (ABB AC500): Update nur durch den Hersteller-Service-Techniker vor Ort, mit Backup der aktuellen Konfiguration und Rollback-Plan.

## 5. Incident Response Plan

### 5.1 Meldepflichten

Bei einem IT-Sicherheitsvorfall (Cyberangriff, Datenverlust, Ransomware, unbefugter Zugriff) gelten folgende Meldepflichten: Meldung an das BSI innerhalb von 24 Stunden (§8b BSI-Gesetz, NIS-2-Umsetzungsgesetz §33, für wesentliche Einrichtungen im Sektor Wasser). Meldung an die Datenschutzaufsichtsbehörde (LfDI NRW) innerhalb von 72 Stunden, sofern personenbezogene Daten betroffen sind (Art. 33 DSGVO). Meldung an die Geschäftsführung der Stadtwerke Musterstadt sofort (telefonisch). Information der betroffenen Kommunen und des Gesundheitsamts, sofern die Wasserversorgung gefährdet ist.

### 5.2 Incident-Response-Prozess

Der Incident-Response-Plan folgt dem NIST-Framework (SP 800-61 Rev. 2): (1) Vorbereitung — Incident-Response-Team (IRT, 5 Personen: IT-Leiter, IT-Sicherheitsbeauftragter, OT-Leiter, Jurist, Pressesprecher), Kontaktlisten aktuell gehalten, jährliche Tabletop-Übung mit Ransomware-Szenario. (2) Erkennung und Analyse — SIEM-System (Wazuh, Open Source, Logaggregation von IT- und OT-Systemen, Korrelationsregeln für bekannte Angriffsmuster), Alarme werden vom IT-Sicherheitsbeauftragten bewertet (Schweregrad: niedrig/mittel/hoch/kritisch). (3) Eindämmung — Bei kritischem Vorfall: sofortige Isolierung des betroffenen Netzwerksegments (automatisch durch Firewall-Regeln oder manuell durch Netzwerk-Administrator), SCADA-Systeme werden in den manuellen Betrieb geschaltet (Feuerwehr-Modus: Pumpensteuerung vor Ort durch Leitstandpersonal). (4) Wiederherstellung — Bereinigung der kompromittierten Systeme, Wiederherstellung aus Backup (tägliches inkrementelles Backup auf NAS im separaten Brandabschnitt, wöchentliches Vollbackup auf Band, offline gelagert), Reintegration der Systeme nach Freigabe durch den IT-Sicherheitsbeauftragten. (5) Lessons Learned — Post-Incident-Review innerhalb von 2 Wochen, Bericht an die Geschäftsführung und das BSI, Anpassung der Sicherheitsmaßnahmen.

## 6. Penetrationstests und Audits

Penetrationstests werden jährlich durch ein BSI-zertifiziertes Unternehmen (BSI-Zertifizierung nach ISO 27001 auf Basis von IT-Grundschutz) durchgeführt. Scope: IT-Netzwerk (Level 3–5): externer Pentest (Angriff von außen über Internet) und interner Pentest (Angriff von einem kompromittierten Arbeitsplatz im Enterprise-Netzwerk). OT-Netzwerk (Level 0–2): passiver Pentest (nur Analyse des Netzwerkverkehrs, keine aktiven Angriffe auf SCADA oder Sensoren — aktive Tests könnten die Wasserversorgung gefährden). IDMZ: Test der Datendiode (Versuch der Rückkommunikation von IT nach OT — muss fehlschlagen).

Die Ergebnisse des Pentests werden in einem Bericht mit Risikobewertung (CVSS v3.1 Score) und Maßnahmenempfehlung dokumentiert. Kritische Schwachstellen (CVSS ≥ 9,0) müssen innerhalb von 48 Stunden mitigiert werden (Workaround oder Patch). Hohe Schwachstellen (CVSS 7,0–8,9) innerhalb von 2 Wochen. Mittlere und niedrige innerhalb von 90 Tagen. Das IT-Sicherheitsaudit nach ISO 27001 wird alle 3 Jahre durch eine akkreditierte Stelle durchgeführt.

## 7. Backup und Disaster Recovery

Die Backup-Strategie folgt der 3-2-1-Regel: 3 Kopien aller Daten, auf 2 verschiedenen Medientypen, davon 1 Kopie offline (air-gapped). Tägliches inkrementelles Backup der IT-Server auf NAS (Netzwerkspeicher, RAID-6, im separaten Brandabschnitt des Rechenzentrums). Wöchentliches Vollbackup auf LTO-8-Band (offline, im feuersicheren Tresor, Rotation: 4 Wochen). Monatliches Backup der OT-Konfigurationen (SCADA-Projektdateien, SPS-Programme, Sensor-Konfigurationen) auf verschlüsseltem USB-Stick (im Tresor). Recovery Time Objective (RTO): IT-Systeme (Dashboard, ML-Modell) — 4 Stunden. OT-Systeme (SCADA) — 1 Stunde (Umschaltung auf Redundanz-Server). Sensornetzwerk — 24 Stunden (Einzelsensoren können ausfallen, ohne die Gesamtfunktion zu beeinträchtigen). Recovery Point Objective (RPO): IT — 24 Stunden (tägliches Backup). OT — 1 Stunde (Echtzeit-Replikation auf Redundanz-Server). Disaster-Recovery-Test: jährlich (Wiederherstellung des gesamten IT-Systems aus dem Band-Backup auf einem Test-Server, Messung der tatsächlichen Recovery-Zeit).

Musterstadt, den 08.03.2026

_Dipl.-Inform. Klaus Firewall, IT-Sicherheitsbeauftragter, Stadtwerke Musterstadt_`,
};
