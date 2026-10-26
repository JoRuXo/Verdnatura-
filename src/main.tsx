import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" storageKey="verdnatura-theme">
    <App />
  </ThemeProvider>,
);
