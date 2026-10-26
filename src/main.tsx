import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "./theme";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
