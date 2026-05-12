import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initI18n } from "./lib/i18n";

initI18n().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed:", err);
      });
  });
}
