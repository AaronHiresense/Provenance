import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion, MotionConfig } from "motion/react";
import App from "./App";
import "./index.css";

// Features are code-split so the first paint does not wait on the animation
// runtime; "user" honours the OS reduced-motion setting for every animation.
const loadFeatures = () => import("./motion-features").then((m) => m.default);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
);
