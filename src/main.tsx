import { createRoot } from "react-dom/client";
import App from "./App";

const elementoRoot = document.getElementById("root");

if (elementoRoot) {
  const root = createRoot(elementoRoot);
  root.render(<App />);
}