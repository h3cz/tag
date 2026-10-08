import { createRoot } from "react-dom/client";
import StandaloneChat from "./StandaloneChat";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StandaloneChat />,
);
