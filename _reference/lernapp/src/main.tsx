import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { initErrorCapture } from "@/lib/actionTracker";

initErrorCapture();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    attribute="class"
    defaultTheme="muted-stone-contrast"
    enableSystem={false}
    themes={[
      "muted-stone-contrast",
      "muted-stone-contrast-dark",
      "muted-moss-light",
      "muted-moss-light-dark",
      "silber",
      "silber-dark",
    ]}
  >
    <App />
  </ThemeProvider>
);
