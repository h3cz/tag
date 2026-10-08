import { createRoot } from "react-dom/client";
import StandaloneChat from "./StandaloneChat";
import "./index.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", {updateViaCache:"none"}).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StandaloneChat />,
);
