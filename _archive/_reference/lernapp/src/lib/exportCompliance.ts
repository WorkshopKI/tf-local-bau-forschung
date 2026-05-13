import { loadConstraints } from "@/services/constraintService";
import { loadKIContext } from "@/services/kiContextService";
import { lernpfadStufen } from "@/data/learningPath";
import type { StufeProgress } from "@/hooks/useLernpfadProgress";

export interface ComplianceReportData {
  meta: {
    name: string;
    abteilung: string;
    fachgebiet: string;
    erstelltAm: string;
    appVersion: string;
  };
  lernpfad: {
    aktuelleStufe: number;
    stufenTitel: string;
    stufen: {
      nr: number;
      titel: string;
      untertitel: string;
      fortschritt: number;
      freigeschaltet: boolean;
    }[];
  };
  qualitaetsregeln: {
    gesamt: number;
    aktiv: number;
    ausManuell: number;
    ausAblehnungen: number;
    domaenen: string[];
    regeln: {
      titel: string;
      regel: string;
      domaene: string;
      quelle: string;
      aktiv: boolean;
    }[];
  };
  arbeitsregeln: {
    gesamt: number;
    aktiv: number;
    regeln: {
      text: string;
      domaene: string;
      aktiv: boolean;
    }[];
  };
  kiKontext: {
    abteilung: string;
    fachgebiet: string;
    aufgaben: string;
    stil: string;
    hatProfil: boolean;
  };
}

export function collectReportData(
  displayName: string,
  stufeProgress: StufeProgress[]
): ComplianceReportData {
  const ctx = loadKIContext();
  const constraints = loadConstraints();
  const currentStufe = stufeProgress.find(s => s.isCurrent) || stufeProgress[0];

  const domaenen = [...new Set(constraints.map(c => c.domain))].sort();

  return {
    meta: {
      name: displayName || "—",
      abteilung: ctx.profile.abteilung || "—",
      fachgebiet: ctx.profile.fachgebiet || "—",
      erstelltAm: new Date().toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      appVersion: "KI-Werkstatt 1.0",
    },
    lernpfad: {
      aktuelleStufe: currentStufe?.nr ?? 1,
      stufenTitel: lernpfadStufen[(currentStufe?.nr ?? 1) - 1]?.title || "",
      stufen: lernpfadStufen.map((s, i) => ({
        nr: s.nr,
        titel: s.title,
        untertitel: s.subtitle,
        fortschritt: stufeProgress[i]?.progress || 0,
        freigeschaltet: stufeProgress[i]?.unlocked || false,
      })),
    },
    qualitaetsregeln: {
      gesamt: constraints.length,
      aktiv: constraints.filter(c => c.active).length,
      ausManuell: constraints.filter(c => c.source === "manual").length,
      ausAblehnungen: constraints.filter(c => c.source === "rejection").length,
      domaenen,
      regeln: constraints.map(c => ({
        titel: c.title,
        regel: c.rule,
        domaene: c.domain,
        quelle: c.source === "rejection" ? "Aus Ablehnung gelernt" : "Manuell erstellt",
        aktiv: c.active,
      })),
    },
    arbeitsregeln: {
      gesamt: ctx.workRules.length,
      aktiv: ctx.workRules.filter(r => r.active).length,
      regeln: ctx.workRules.map(r => ({
        text: r.text,
        domaene: r.domain,
        aktiv: r.active,
      })),
    },
    kiKontext: {
      abteilung: ctx.profile.abteilung,
      fachgebiet: ctx.profile.fachgebiet,
      aufgaben: ctx.profile.aufgaben,
      stil: ctx.profile.stil,
      hatProfil: !!(ctx.profile.abteilung || ctx.profile.fachgebiet),
    },
  };
}

export function downloadReportJSON(data: ComplianceReportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ki-kompetenznachweis-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printReport(data: ComplianceReportData): void {
  const html = buildPrintHTML(data);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 300);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintHTML(data: ComplianceReportData): string {
  const stufenRows = data.lernpfad.stufen.map(s => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
        <strong>Stufe ${s.nr}</strong> — ${escapeHtml(s.titel)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">
        ${escapeHtml(s.untertitel)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">
        ${s.freigeschaltet ? `${s.fortschritt}%` : "—"}
      </td>
    </tr>
  `).join("");

  const constraintRows = data.qualitaetsregeln.regeln.map(r => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 500;">
        ${escapeHtml(r.titel)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">
        ${escapeHtml(r.domaene)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #888; font-size: 12px;">
        ${escapeHtml(r.quelle)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">
        ${r.aktiv ? "✓" : "—"}
      </td>
    </tr>
  `).join("");

  const workRuleRows = data.arbeitsregeln.regeln.map(r => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
        ${escapeHtml(r.text)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">
        ${escapeHtml(r.domaene)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">
        ${r.aktiv ? "✓" : "—"}
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>KI-Kompetenznachweis — ${escapeHtml(data.meta.name)}</title>
  <style>
    @page { margin: 2cm; size: A4; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #1a1a1a;
      font-size: 14px;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #888;
      margin: 32px 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #ddd;
    }
    .subtitle { color: #666; font-size: 13px; margin: 0 0 24px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
      margin-bottom: 24px;
      font-size: 13px;
    }
    .meta-label { color: #888; }
    .meta-value { font-weight: 500; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 8px;
    }
    th {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #ddd;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat-box {
      background: #f8f8f6;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .stat-value { font-size: 24px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f0f0ec;
      color: #666;
    }
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #aaa;
      display: flex;
      justify-content: space-between;
    }
    .legal {
      margin-top: 32px;
      padding: 16px;
      background: #f8f8f6;
      border-radius: 8px;
      font-size: 12px;
      color: #666;
      line-height: 1.55;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>KI-Kompetenznachweis</h1>
  <p class="subtitle">Gemäß EU AI Act Art. 4 — KI-Kompetenzverpflichtung</p>

  <div class="meta-grid">
    <div><span class="meta-label">Name:</span> <span class="meta-value">${escapeHtml(data.meta.name)}</span></div>
    <div><span class="meta-label">Abteilung:</span> <span class="meta-value">${escapeHtml(data.meta.abteilung)}</span></div>
    <div><span class="meta-label">Fachgebiet:</span> <span class="meta-value">${escapeHtml(data.meta.fachgebiet)}</span></div>
    <div><span class="meta-label">Erstellt am:</span> <span class="meta-value">${escapeHtml(data.meta.erstelltAm)}</span></div>
  </div>

  <h2>Lernpfad</h2>
  <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
    Aktuelle Stufe: <strong>${data.lernpfad.aktuelleStufe} — ${escapeHtml(data.lernpfad.stufenTitel)}</strong>
  </p>
  <table>
    <thead>
      <tr>
        <th>Stufe</th>
        <th>Beschreibung</th>
        <th style="text-align: right;">Fortschritt</th>
      </tr>
    </thead>
    <tbody>${stufenRows}</tbody>
  </table>

  <h2>Qualitätsregeln</h2>
  <div class="stat-grid">
    <div class="stat-box">
      <div class="stat-value">${data.qualitaetsregeln.gesamt}</div>
      <div class="stat-label">Gesamt</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${data.qualitaetsregeln.aktiv}</div>
      <div class="stat-label">Aktiv</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${data.qualitaetsregeln.ausManuell}</div>
      <div class="stat-label">Manuell</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${data.qualitaetsregeln.ausAblehnungen}</div>
      <div class="stat-label">Aus Ablehnungen</div>
    </div>
  </div>
  ${data.qualitaetsregeln.domaenen.length > 0 ? `
    <p style="font-size: 12px; color: #888; margin-bottom: 12px;">
      Abgedeckte Domänen: ${data.qualitaetsregeln.domaenen.map(d => `<span class="badge">${escapeHtml(d)}</span>`).join(" ")}
    </p>
  ` : ""}
  ${data.qualitaetsregeln.regeln.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Regel</th>
          <th>Domäne</th>
          <th>Quelle</th>
          <th style="text-align: center;">Aktiv</th>
        </tr>
      </thead>
      <tbody>${constraintRows}</tbody>
    </table>
  ` : `<p style="font-size: 13px; color: #999;">Noch keine Qualitätsregeln erstellt.</p>`}

  ${data.arbeitsregeln.gesamt > 0 ? `
    <h2>Arbeitsregeln</h2>
    <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
      ${data.arbeitsregeln.aktiv} von ${data.arbeitsregeln.gesamt} Regeln aktiv
    </p>
    <table>
      <thead>
        <tr>
          <th>Regel</th>
          <th>Domäne</th>
          <th style="text-align: center;">Aktiv</th>
        </tr>
      </thead>
      <tbody>${workRuleRows}</tbody>
    </table>
  ` : ""}

  <h2>KI-Kontext</h2>
  ${data.kiKontext.hatProfil ? `
    <div class="meta-grid">
      <div><span class="meta-label">Abteilung:</span> <span class="meta-value">${escapeHtml(data.kiKontext.abteilung || "—")}</span></div>
      <div><span class="meta-label">Fachgebiet:</span> <span class="meta-value">${escapeHtml(data.kiKontext.fachgebiet || "—")}</span></div>
      <div><span class="meta-label">Typische Aufgaben:</span> <span class="meta-value">${escapeHtml(data.kiKontext.aufgaben || "—")}</span></div>
      <div><span class="meta-label">Bevorzugter Stil:</span> <span class="meta-value">${escapeHtml(data.kiKontext.stil || "—")}</span></div>
    </div>
  ` : `<p style="font-size: 13px; color: #999;">KI-Kontext noch nicht eingerichtet.</p>`}

  <div class="legal">
    <strong>EU AI Act — Artikel 4: KI-Kompetenzverpflichtung</strong><br>
    Anbieter und Betreiber von KI-Systemen treffen Maßnahmen, um nach besten Kräften sicherzustellen,
    dass ihr Personal und andere Personen, die in ihrem Auftrag mit KI-Systemen arbeiten,
    über ein ausreichendes Maß an KI-Kompetenz verfügen. Dieser Nachweis dokumentiert die
    aufgebauten Kompetenzen und etablierten Qualitätsstandards.
  </div>

  <div class="footer">
    <span>Generiert mit ${escapeHtml(data.meta.appVersion)}</span>
    <span>${escapeHtml(data.meta.erstelltAm)}</span>
  </div>
</body>
</html>`;
}
