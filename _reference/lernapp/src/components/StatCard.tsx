import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
}

export const StatCard = ({ icon: Icon, label, value }: StatCardProps) => (
  <Card className="card-section relative overflow-hidden">
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/30" />
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/8">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  </Card>
);
