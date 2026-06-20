import React from "react";
import ReactDOM from "react-dom/client";
import { StoreProvider } from "./store";
import { App } from "./App";
import { StandaloneWindow } from "./components/StandaloneWindow";
import type { FloatingKind } from "./lib/windows";
import "./styles/global.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// A floating window webview is opened with ?window=mini|lyrics — render just that body.
const win = new URLSearchParams(window.location.search).get("window");
if (win === "mini" || win === "lyrics") {
  document.documentElement.setAttribute("data-theme", "dark");
  root.render(
    <React.StrictMode>
      <StoreProvider>
        <StandaloneWindow kind={win as FloatingKind} />
      </StoreProvider>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </React.StrictMode>,
  );
}
