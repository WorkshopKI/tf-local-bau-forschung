# Interne KI von der Dev-Maschine aus erreichen (Tunnel)

Die interne KI (`gpt.vdivde-it.de`) liegt hinter dem VPN, und das VPN hat nur der Firmenlaptop.
Damit war jeder Use-Case, der sie braucht — Gutachten-Abschnitte, Aufbereitung, Nachforderungen,
Assistent —, von der Dev-Maschine aus **gar nicht** prüfbar und blieb Handarbeit auf dem zweiten
Rechner. Dieses Dokument beschreibt den Weg, der ihn hierher holt.

## Was hier NICHT gebaut wurde — und warum das der Kern ist

Es entsteht **keine zweite Bridge**. Die [KI-Bridge](ki-bridge.md) ist bereits eine
Zwei-Tab-Konstruktion:

```
App-Tab  ⟷  postMessage  ⟷  KI-Tab (Lesezeichen)  ⟷  HTTP/SSE  ⟷  interne KI
```

Tab eins liefert [`npm run dev:local`](local-variante.md) längst. Tab zwei fehlte allein deshalb,
weil der Host von hier aus nicht auflösbar ist. Gebraucht wird also ein **Netzweg**, kein Protokoll —
und der kostet **keine Zeile Produktivcode**.

Möglich wird das durch den Zugangsweg der internen KI: sie fragt nicht nach einer Anmeldung. Wer im
Netz ist, ist drin (belegt im Inkognito-Fenster: der Chat kommt sofort). Damit reicht eine reine
TCP-Weiterleitung; der Umweg über den Browser des Laptops — Relais im Lesezeichen, neues Protokoll,
neues Lesezeichen für das ganze Team — entfällt ersatzlos.

## Der Aufbau

```
Firmenlaptop (VPN aktiv)                    Dev-Maschine WIN11CORE6
  laptop-tunnel.cmd
  ssh -N -R 443:gpt.vdivde-it.de:443 ──┐
        ausgehend, Port 22             │
                                       ▼
                              sshd bindet 127.0.0.1:443
                                       ▲
                              hosts: 127.0.0.1 gpt.vdivde-it.de
                                       │
                              Chrome / Browser-Pane
                                Tab 1  App   localhost:5175
                                Tab 2  KI    https://gpt.vdivde-it.de/
```

Vier Eigenschaften, die diesen Zuschnitt tragen:

- **Nichts zu konfigurieren.** Die App behält ihren Vorgabewert `https://gpt.vdivde-it.de/`
  ([connect-ki.ts](../../src/core/services/ai/connect-ki.ts)). Origin-Pinning, `classifyProvider`
  (→ `intern`) und das Lesezeichen bleiben unangetastet. Ein Tunnel auf einen Loopback-Port wäre
  auch gegangen — der Endpunkt ist im Dev-Kontext editierbar —, hätte aber einen lokalen Proxy
  gebraucht und die Origin gegenüber der Produktion verschoben.
- **TLS bleibt Ende-zu-Ende.** Der Browser handelt direkt mit dem echten Server; die Dev-Maschine
  terminiert nichts und sieht keinen Klartext. Ein Proxy täte genau das.
- **Produktionsgleich.** Dieselbe Adresse, dieselbe Origin, dasselbe Zertifikat.
- **Ein Host, ein Port.** `-R 443:gpt.vdivde-it.de:443` führt genau ein Ziel. Kein `-D`, kein SOCKS,
  kein allgemeiner Weg ins Firmennetz.

> Der Laptop braucht **keine** Admin-Rechte und bekommt nichts installiert: `ssh.exe` ist Teil von
> Windows, und die Verbindung ist ausgehend — es lauscht dort kein Port, also fragt auch keine
> Firewall. Die erhöhten Rechte fallen alle auf der Dev-Maschine an, einmalig.

## Einrichtung

### 1 · SSH-Server auf der Dev-Maschine

Einmalig, in einer **PowerShell als Administrator**:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0; Set-Service sshd -StartupType Manual; Start-Service sshd
```

`StartupType Manual` ist Absicht: der Dienst läuft, wenn er gebraucht wird, nicht dauerhaft.
Die Installation legt die Firewall-Regel `OpenSSH-Server-In-TCP` gleich mit an — das ist der Grund,
diesen Schritt **vor** die Messung zu ziehen: sonst wäre ein fehlgeschlagener Verbindungstest nicht
zuzuordnen (VPN oder eigene Firewall?).

Nachgemessen, damit das kein Argument bleibt: ein Verbindungsversuch auf `192.168.2.125:22` läuft
vor der Installation in einen **Timeout**. Ein geschlossener Port antwortet mit RST („Connection
refused"); ein Timeout heißt, die Firewall verwirft die Pakete still. Eine Messung vom Laptop aus
hätte vorher also in jedem Fall `False` geliefert — unabhängig davon, was das VPN tut.

### 2 · Netzweg messen

Auf dem **Firmenlaptop, bei aufgebautem VPN**:

```powershell
Test-NetConnection 192.168.2.125 -Port 22
```

- `TcpTestSucceeded : True` → weiter mit Schritt 3.
- `False` → denselben Test **ohne** VPN wiederholen. Klappt er dann, kappt der VPN-Client das
  lokale Netz; viele Clients haben dafür einen Schalter in der Art „local LAN access". Klappt er
  auch ohne VPN nicht, liegt es am Netz zwischen den Geräten.

`ping` ist als Gegenprobe untauglich — ICMP wird oft geblockt, während TCP durchgeht (und
umgekehrt).

### 3 · Öffentlichen Schlüssel hinterlegen

Auf dem Laptop, falls noch kein Schlüssel existiert:

```powershell
ssh-keygen -t ed25519
```

Der **öffentliche** Teil (`%USERPROFILE%\.ssh\id_ed25519.pub`) gehört auf die Dev-Maschine.

> **Der Fallstrick, der hier zuverlässig zuschlägt:** `tom` ist auf `WIN11CORE6` Mitglied der
> Administratoren. Für solche Konten liest Windows-OpenSSH **nicht** `~/.ssh/authorized_keys`,
> sondern `C:\ProgramData\ssh\administrators_authorized_keys` (die `Match Group administrators`-Regel
> am Ende von `sshd_config`). Der falsche Ort ist die häufigste Ursache für „der Schlüssel wird
> ignoriert, es fragt weiter nach dem Passwort". Zusätzlich verweigert sshd die Datei
> **kommentarlos**, wenn ihre Rechte zu weit sind — nur `SYSTEM` und `Administratoren` dürfen darauf.

In einer PowerShell als Administrator auf der Dev-Maschine (Schlüsseltext vorher einfügen):

```powershell
$k = 'ssh-ed25519 AAAA... laptop'; $f = "$env:ProgramData\ssh\administrators_authorized_keys"; Add-Content $f $k; icacls $f /inheritance:r /grant 'SYSTEM:F' /grant 'Administratoren:F'
```

Danach in `C:\ProgramData\ssh\sshd_config` `PasswordAuthentication no` setzen und
`Restart-Service sshd`.

### 4 · hosts-Eintrag auf der Dev-Maschine

Eine Zeile in `C:\Windows\System32\drivers\etc\hosts` (Editor als Administrator):

```
127.0.0.1 gpt.vdivde-it.de
```

Solange die Zeile steht und der Tunnel **nicht** läuft, ist die Adresse von hier aus tot statt
unauflösbar. Das sieht anders aus als vorher, ist aber derselbe Zustand: erreichbar war sie hier nie.

### 5 · Tunnel starten

[`scripts/ki-tunnel/laptop-tunnel.cmd`](../../scripts/ki-tunnel/laptop-tunnel.cmd) auf den Laptop
kopieren und per Doppelklick starten, solange das VPN steht. Das Fenster bleibt offen; `Strg+C`
beendet den Tunnel. Bricht die Verbindung ab (VPN-Neuaufbau, Standby), baut die Schleife sie neu auf.

## Abnahme

Aufsteigend. Jeder Schritt schließt eine Fehlerursache aus, bevor der nächste sie verdecken kann.

**1 · Der ganze Netzweg, ohne Browser** — auf der Dev-Maschine:

```
curl.exe -sS -o NUL -w "%{http_code}\n" https://gpt.vdivde-it.de/
```

`200` belegt in einem Kommando vier Dinge auf einmal: der hosts-Eintrag greift, sshd leitet weiter,
der Laptop erreicht die interne KI, und das Zertifikat validiert gegen den **echten** Namen. Ein
Zertifikatsfehler an dieser Stelle hieße, dass etwas dazwischen TLS terminiert — dann stimmt der
Aufbau nicht.

**2 · Auflösung im Browser** — die Adresse aufrufen, die Seite muss laden. Chromium bringt einen
eigenen Resolver mit und je nach Einstellung Secure DNS (DoH); dass er die hosts-Datei
berücksichtigt, ist der eine Punkt, den kein Vorab-Test klärt. Lädt sie nicht, ist Secure DNS der
erste Verdacht (in den Chrome-Einstellungen abschaltbar).

**3 · Bridge** — in der App: Einstellungen → KI → „Verbindung testen". Im KI-Tab prüft
`pruefeAnschluss()` die sechs Voraussetzungen einzeln (Sitzungs-Id, Chat-Formular, Sende-Adresse,
Modell-Auswahl, Reset-Weg, Kontextleiste) und benennt die erste fehlende.

**4 · Ein echter Lauf** — einen Gutachten-Abschnitt erzeugen. Er belegt in einem Durchgang genau
die drei Dinge, die laut [ki-bridge.md](ki-bridge.md) **kein** lokaler Test abdecken kann: dass die
aus der Seite abgelesenen Endpunkte stimmen, dass der Modellwechsel durchschlägt und dass `done`
den Lauf beendet.

## Eine Abnahme-Sitzung automatisiert fahren

Die Lesezeichenleiste ist im Browser-Pane nicht bedienbar — gebraucht wird sie auch nicht. Das
Lesezeichen ist reines JavaScript, und es anzuklicken heißt nichts anderes, als diesen Text im
KI-Tab auszuführen.

1. `npm run dev:local` → App auf 5175, `await window.__tf.bereit()`.
2. Einstellungen → KI → Klappe „Verbindung einrichten" **aufklappen**. Der `javascript:`-Anker wird
   erst dabei montiert (Callback-Ref statt Mount-Effekt, siehe [ki-bridge.md](ki-bridge.md)); bei
   geschlossener Klappe steht er nicht im DOM. Dann seinen `href` auslesen.
3. **„Interne KI öffnen" klicken** — nicht per `navigate` auf die Adresse gehen. Das Snippet meldet
   sich über `window.opener` an die App; ein ohne Opener geöffneter Tab bleibt für die Bridge stumm
   (Invariante „Fenster-Handle aus `event.source`").
4. Den Snippet-Text (`href` ohne das `javascript:`-Präfix, `decodeURIComponent`) im KI-Tab
   ausführen. Das ist exakt der Lesezeichen-Klick.
5. Danach normale Bedienung. Nach jedem **Neuladen** des KI-Tabs Schritt 4 wiederholen — das gilt
   heute genauso, das Bookmarklet überlebt kein Reload.

## Fehlersuche

| Bild | Ursache zuerst prüfen |
|---|---|
| `ssh` bricht sofort ab, „remote port forwarding failed" | Auf der Dev-Maschine belegt etwas Port 443 (`Get-NetTCPConnection -State Listen`). Genau dafür steht `ExitOnForwardFailure=yes` in der `.cmd`: **ohne** den Schalter käme die Sitzung zustande und der Tunnel wäre trotzdem tot — eine lebende Verbindung, die nichts weiterleitet. |
| `ssh` läuft, aber `curl` meldet „Connection refused" | Der Dienst `sshd` läuft nicht (`Get-Service sshd`), oder die Weiterleitung bindet nicht auf Loopback. |
| „Connection timed out" beim Verbinden | Die IP der Dev-Maschine hat sich geändert (DHCP) — im Router reservieren oder in der `.cmd` nachziehen. Oder das VPN kappt das lokale Netz (Schritt 2). |
| Schlüssel wird ignoriert, es fragt nach dem Passwort | `administrators_authorized_keys` statt `~/.ssh/authorized_keys`, oder die Rechte an der Datei sind zu weit (Schritt 3). |
| Port lässt sich nicht binden, obwohl frei | Windows reserviert Portbereiche vorab (Hyper-V/WSL): `netsh interface ipv4 show excludedportrange protocol=tcp`. Für 443 und 22 auf dieser Maschine geprüft — beide liegen außerhalb. |
| Browser lädt die Seite nicht, `curl` schon | Secure DNS (DoH) im Browser umgeht die hosts-Datei — abschalten. |

## Was das nicht ersetzt

- **Den `file://`-Smoke.** Der Dev-Server ist permissiver als ein Single-File-Build; die
  `file://`-Constraints fallen hier nicht auf. Nach jedem `BRIDGE_REV`-Bump bleibt der Handtest
  gegen `dist-single/` Pflicht — mit dem Unterschied, dass er jetzt **hier** stattfinden kann und
  nicht auf dem zweiten Rechner.
- **Das Team.** Der Tunnel ist ein Werkzeug dieser einen Maschine. Am Weg der Nutzer zur internen
  KI ändert sich nichts.
- **Pitfall #36.** Der Chat bleibt zustandsbehaftet; jeder Einzel-Lauf resettet weiterhin zuerst.

## Stand

Aufbau und Anleitung sind fertig, die Einrichtungsschritte brauchen erhöhte Rechte bzw. den Laptop
und sind damit Handarbeit. Auf der Dev-Maschine nachgemessen und in dieses Dokument eingeflossen:
LAN-Adresse `192.168.2.125`, `tom` in der Administratoren-Gruppe (Schritt 3), `sshd` nicht
installiert, die Ports 22/443/8443/8788 frei und außerhalb der reservierten Bereiche, kein
bestehender hosts-Eintrag. **Ob der VPN-Client den Weg vom Laptop hierher zulässt, ist offen** — das
klärt Schritt 2 und nichts davor.
