import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DialogoAutor } from "@/components/DialogoAutor";
import { useTiempoReal } from "@/lib/tiempoReal";
import { FUNCIONES } from "@/funciones";
import ErrorBoundary from "./components/ErrorBoundary";
import Nave from "./pages/Nave.tsx";
import Articulos from "./pages/Articulos.tsx";
import Historial from "./pages/Historial.tsx";

// Las etiquetas QR están en pausa: su página solo se carga si se activan
const CodigosQR = lazy(() => import("./qr/CodigosQR.tsx"));

const queryClient = new QueryClient();

/** Escucha los cambios que hacen los demás y refresca lo que haga falta. */
function TiempoReal() {
  useTiempoReal();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TiempoReal />
      <DialogoAutor />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Nave />} />
            <Route path="/zona/:zonaId" element={<Nave />} />
            <Route path="/articulos" element={<Articulos />} />
            <Route path="/articulos/:articuloId" element={<Articulos />} />
            <Route path="/historial" element={<Historial />} />
            {FUNCIONES.codigosQR && (
              <Route
                path="/qr"
                element={
                  <Suspense fallback={null}>
                    <CodigosQR />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
