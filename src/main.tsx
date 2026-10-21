import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { DesktopWidget } from "@/features/widget/desktop-widget";
import { WorkspaceErrorBoundary } from "@/features/widget/workspace-error-boundary";

document.documentElement.classList.add("widget-mode");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkspaceErrorBoundary>
      <DesktopWidget />
    </WorkspaceErrorBoundary>
  </StrictMode>,
);
