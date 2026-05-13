import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppModeProvider, useAppMode } from "@/contexts/AppModeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { StandaloneAuthProvider } from "@/contexts/StandaloneAuthContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { StandaloneSyncProvider } from "@/contexts/StandaloneSyncContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { GuestBanner } from "@/components/GuestBanner";
import { AppShell } from "@/components/AppShell";
import { TeamMembers } from "@/components/TeamMembers";
import { PendingReviews } from "@/components/PendingReviews";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ModeSelection from "./pages/ModeSelection";

const Playground = lazy(() => import("./pages/Playground"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminParticipants = lazy(() => import("./pages/AdminParticipants"));
const AdminFeedback = lazy(() => import("./pages/AdminFeedback"));
const FeedbackButton = lazy(() => import("./components/feedback/FeedbackButton"));

const queryClient = new QueryClient();

const PlatformLayout = ({ children }: { children: React.ReactNode }) => (
  <AppShell>
    <GuestBanner />
    {children}
  </AppShell>
);

const WorkshopApp = () => (
  <AuthProvider>
    <SyncProvider>
      <OrgProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<PlatformLayout><Dashboard /></PlatformLayout>} />
            <Route path="/library" element={<PlatformLayout><Library /></PlatformLayout>} />
            <Route path="/onboarding" element={<PlatformLayout><Onboarding /></PlatformLayout>} />
            <Route path="/workspace" element={<Navigate to="/library" replace />} />
            <Route path="/analytics" element={<Navigate to="/" replace />} />
            <Route path="/settings" element={<PlatformLayout><Settings /></PlatformLayout>} />
            <Route path="/profil" element={<Navigate to="/settings" replace />} />
            <Route path="/admin/teilnehmer" element={<PlatformLayout><AdminParticipants /></PlatformLayout>} />
            <Route path="/admin/feedback" element={<PlatformLayout><AdminFeedback /></PlatformLayout>} />
            <Route path="/team" element={<PlatformLayout><TeamMembers /></PlatformLayout>} />
            <Route path="/reviews" element={<PlatformLayout><PendingReviews /></PlatformLayout>} />
            <Route path="/playground" element={<PlatformLayout><Playground /></PlatformLayout>} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FeedbackButton />
        </Suspense>
      </OrgProvider>
    </SyncProvider>
  </AuthProvider>
);

const StandaloneApp = () => (
  <StandaloneAuthProvider>
    <StandaloneSyncProvider>
      <OrgProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<PlatformLayout><Dashboard /></PlatformLayout>} />
            <Route path="/library" element={<PlatformLayout><Library /></PlatformLayout>} />
            <Route path="/onboarding" element={<PlatformLayout><Onboarding /></PlatformLayout>} />
            <Route path="/settings" element={<PlatformLayout><Settings /></PlatformLayout>} />
            <Route path="/admin/feedback" element={<PlatformLayout><AdminFeedback /></PlatformLayout>} />
            <Route path="/playground" element={<PlatformLayout><Playground /></PlatformLayout>} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FeedbackButton />
        </Suspense>
      </OrgProvider>
    </StandaloneSyncProvider>
  </StandaloneAuthProvider>
);

const AppContent = () => {
  const { mode, isChosen } = useAppMode();

  if (!isChosen) {
    return (
      <Routes>
        <Route path="*" element={<ModeSelection />} />
      </Routes>
    );
  }

  return mode === "workshop" ? <WorkshopApp /> : <StandaloneApp />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppModeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AppModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
