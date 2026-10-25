import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Error desconocido" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error capturado por ErrorBoundary", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">La pantalla no ha podido cargarse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La web sigue funcionando, pero esta sección ha encontrado un dato inesperado o un fallo puntual.
            </p>
            {this.state.message && (
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {this.state.message}
              </pre>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>Recargar</Button>
              <Button variant="outline" onClick={() => (window.location.href = "/")}>Volver al inicio</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
