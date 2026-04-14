import { Logo } from "./Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Footer = () => (
  <footer className="border-t border-border bg-card/50 mt-16">
    <div className="container mx-auto px-4 max-w-7xl py-10 flex flex-col items-center gap-3 text-center">
      <Logo size="sm" />
      <p className="text-sm text-muted-foreground">
        Ein interaktiver Kurs von KiLab · Für Workshops und Selbstlerner
      </p>
      <div className="flex items-center gap-4">
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} · Erstellt mit React, Tailwind und viel ☕
        </p>
        <ThemeToggle />
      </div>
    </div>
  </footer>
);
