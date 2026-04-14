import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md";
  variant?: "default" | "sidebar";
  className?: string;
}

export const Logo = ({ size = "md", variant = "default", className }: LogoProps) => {
  const width = size === "sm" ? 140 : 180;
  const colorClass = variant === "sidebar" ? "text-sidebar-foreground" : "text-foreground";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 180 42"
      fill="currentColor"
      width={width}
      className={cn("select-none", colorClass, className)}
    >
      <text x="0" y="22" fontFamily="'DM Sans', sans-serif" fontSize="28">
        <tspan fontWeight="800">KI</tspan>
        <tspan fontWeight="300">-Werkstatt</tspan>
      </text>
      <text x="0" y="38" fontFamily="'DM Sans', sans-serif" fontSize="12" fontWeight="400" opacity="0.5">
        Souverän arbeiten mit KI
      </text>
    </svg>
  );
};
