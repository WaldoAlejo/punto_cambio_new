import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const AppTree = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

createRoot(rootElement).render(
  import.meta.env.DEV ? AppTree : <StrictMode>{AppTree}</StrictMode>
);
