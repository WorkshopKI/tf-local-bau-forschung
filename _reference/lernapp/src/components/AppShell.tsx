import { type ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { useOrgContext } from "@/contexts/OrgContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Onboarding", icon: GraduationCap, path: "/onboarding" },
  { label: "Prompt Sammlung", icon: BookOpen, path: "/library" },
  { label: "Prompt Werkstatt", icon: Sparkles, path: "/playground" },
];

function getPageTitle(pathname: string): string {
  const match = navItems.find((item) => item.path === pathname);
  if (match) return match.label;
  if (pathname === "/settings") return "Einstellungen";
  if (pathname === "/admin/teilnehmer") return "Teilnehmer-Verwaltung";
  if (pathname === "/team") return "Team";
  if (pathname === "/reviews") return "Reviews";
  return "Seite";
}

function AppHeader({ title }: { title: string }) {
  const { state } = useSidebar();
  return (
    <header className="flex h-14 items-center gap-2 border-b border-border px-4">
      {state === "expanded" && <SidebarTrigger />}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

export const AppShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { scopeLabel, isDepartment } = useOrgContext();

  const isPlayground = location.pathname === "/playground";
  const isActive = (path: string) => location.pathname === path;

  const [sidebarOpen, setSidebarOpen] = useState(!isPlayground);

  useEffect(() => {
    setSidebarOpen(!isPlayground);
  }, [isPlayground]);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <Sidebar collapsible="icon" data-feedback-ref="navigation.sidebar" data-feedback-label="Sidebar">
        <SidebarHeader className={`flex-row items-center justify-center border-b border-border group-data-[state=expanded]:justify-start group-data-[state=expanded]:pl-4 group-data-[state=expanded]:pr-4 ${isPlayground ? "h-12" : "h-14"}`}>
          <button
            onClick={() => navigate("/")}
            className="flex items-center group-data-[state=collapsed]:hidden"
          >
            <Logo size="sm" variant="sidebar" className="translate-y-[2px]" />
          </button>
          <SidebarTrigger className="group-data-[state=expanded]:hidden" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive(item.path)}
                      tooltip={item.label}
                      onClick={() => navigate(item.path)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-2 group-data-[state=collapsed]:pl-0 group-data-[state=collapsed]:-ml-[2px]">
          <UserMenu scopeLabel={isDepartment ? scopeLabel : undefined} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className={isPlayground ? "h-svh min-h-0 overflow-hidden" : undefined}>
        {!isPlayground && <AppHeader title={getPageTitle(location.pathname)} />}
        <div className={isPlayground ? "flex-1 min-h-0" : "flex-1 p-4 md:p-6 lg:p-8 max-w-7xl"}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
