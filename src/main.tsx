import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Connect to React DevTools standalone in development (port 8097)
const enableDevTools = (import.meta as any).env?.VITE_ENABLE_REACT_DEVTOOLS === "true";
if (import.meta.env.DEV && enableDevTools) {
  // Dynamically import so it won't be bundled in production
  import("react-devtools-core")
    .then((mod: any) => {
      const connect = mod.connectToDevTools || mod.default?.connectToDevTools;
      if (typeof connect === "function") {
        try {
          connect({ host: "localhost", port: 8097 });
          // eslint-disable-next-line no-console
          console.log("[DevTools] Attempting to connect to React DevTools at ws://localhost:8097");
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[DevTools] Failed to connect:", e);
        }
      }
    })
    .catch(() => {
      // eslint-disable-next-line no-console
      console.warn("[DevTools] react-devtools-core not installed. Run: npm i -D react-devtools react-devtools-core");
    });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
