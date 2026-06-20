import React from "react";
import ReactDOM from "react-dom/client";
import { StoreProvider } from "./store";
import { App } from "./App";
import "./styles/global.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
