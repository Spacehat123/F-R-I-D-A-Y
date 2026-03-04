import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { JarvisProvider } from "./core/JarvisContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <JarvisProvider>
      <App />
    </JarvisProvider>
  </React.StrictMode>
);