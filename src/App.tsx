import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import Articulos from "./pages/Articulos.tsx";
import StockTotal from "./pages/StockTotal.tsx";
import Estanterias from "./pages/Estanterias.tsx";
import EstanteriaDetalle from "./pages/EstanteriaDetalle.tsx";
import Mapa from "./pages/Mapa.tsx";
import Historial from "./pages/Historial.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/"              element={<Index />} />
              <Route path="/mapa"          element={<Mapa />} />
              <Route path="/articulos"     element={<Articulos />} />
              <Route path="/stock-total"   element={<StockTotal />} />
              <Route path="/estanterias"   element={<Estanterias />} />
              <Route path="/estanterias/:id" element={<EstanteriaDetalle />} />
              <Route path="/historial"     element={<Historial />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
