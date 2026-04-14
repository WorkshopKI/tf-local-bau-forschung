import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLernpfadProgress } from "@/hooks/useLernpfadProgress";
import { lernpfadStufen } from "@/data/learningPath";
import { collectReportData, downloadReportJSON, printReport } from "@/lib/exportCompliance";
import { toast } from "sonner";

export function ComplianceReport() {
  const { profile } = useAuthContext();
  const stufeProgress = useLernpfadProgress();

  const data = useMemo(
    () => collectReportData(profile?.display_name || "", stufeProgress),
    [profile, stufeProgress]
  );

  const handlePrintPDF = () => {
    printReport(data);
    toast.success("Report wird geöffnet — als PDF drucken.");
  };

  const handleDownloadJSON = () => {
    downloadReportJSON(data);
    toast.success("JSON-Export heruntergeladen.");
  };

  return (
    <div className="space-y-6">
      {/* Export Buttons */}
      <div className="flex items-center gap-3">
        <Button onClick={handlePrintPDF} className="gap-2">
          <Printer className="w-4 h-4" /> Als PDF exportieren
        </Button>
        <Button variant="outline" onClick={handleDownloadJSON} className="gap-2">
          <Download className="w-4 h-4" /> JSON-Daten
        </Button>
      </div>

      {/* Preview */}
      <div className="space-y-5 text-sm">
        {/* Meta */}
        <div>
          <h3 className="text-lg font-bold">KI-Kompetenznachweis</h3>
          <p className="text-xs text-muted-foreground">
            Gemäß EU AI Act Art. 4 — KI-Kompetenzverpflichtung
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{data.meta.name}</span></div>
          <div><span className="text-muted-foreground">Abteilung:</span> <span className="font-medium">{data.meta.abteilung}</span></div>
          <div><span className="text-muted-foreground">Fachgebiet:</span> <span className="font-medium">{data.meta.fachgebiet}</span></div>
          <div><span className="text-muted-foreground">Datum:</span> <span className="font-medium">{data.meta.erstelltAm}</span></div>
        </div>

        {/* Lernpfad */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
            Lernpfad
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            Aktuelle Stufe: <span className="font-semibold text-foreground">{data.lernpfad.aktuelleStufe} — {data.lernpfad.stufenTitel}</span>
          </p>
          <div className="space-y-1">
            {data.lernpfad.stufen.map(s => (
              <div key={s.nr} className="flex items-center gap-3 text-xs py-1">
                <span className="font-semibold w-14">Stufe {s.nr}</span>
                <span className="flex-1">{s.titel} <span className="text-muted-foreground">— {s.untertitel}</span></span>
                <span className="font-semibold w-10 text-right">
                  {s.freigeschaltet ? `${s.fortschritt}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Qualitätsregeln */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
            Qualitätsregeln
          </h4>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xl font-bold">{data.qualitaetsregeln.gesamt}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Gesamt</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xl font-bold">{data.qualitaetsregeln.aktiv}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Aktiv</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xl font-bold">{data.qualitaetsregeln.ausManuell}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Manuell</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xl font-bold">{data.qualitaetsregeln.ausAblehnungen}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Ablehnungen</div>
            </div>
          </div>
          {data.qualitaetsregeln.regeln.length > 0 ? (
            <div className="space-y-1.5">
              {data.qualitaetsregeln.regeln.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="font-medium flex-1">{r.titel}</span>
                  <span className="text-muted-foreground shrink-0">{r.domaene}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{r.quelle}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Noch keine Qualitätsregeln erstellt.</p>
          )}
        </div>

        {/* Arbeitsregeln */}
        {data.arbeitsregeln.gesamt > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
              Arbeitsregeln
            </h4>
            <div className="space-y-1.5">
              {data.arbeitsregeln.regeln.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="flex-1">{r.text}</span>
                  <span className="text-muted-foreground shrink-0">{r.domaene}</span>
                  <span className="shrink-0">{r.aktiv ? "✓" : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EU AI Act Hinweis */}
        <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">EU AI Act — Artikel 4: KI-Kompetenzverpflichtung</strong><br />
          Anbieter und Betreiber von KI-Systemen treffen Maßnahmen, um nach besten Kräften sicherzustellen,
          dass ihr Personal über ein ausreichendes Maß an KI-Kompetenz verfügt. Dieser Nachweis dokumentiert
          die aufgebauten Kompetenzen und etablierten Qualitätsstandards.
        </div>
      </div>
    </div>
  );
}
