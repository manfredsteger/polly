import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initI18n } from "./lib/i18n";

initI18n().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
