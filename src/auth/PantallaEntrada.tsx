import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { mensajeEntrada, useSesion } from "./sesion";

/**
 * Línea de flujo pintada en el suelo, como las del mapa de la nave: dos bordes
 * y flechas lima hacia los muelles. Es el sello de la pantalla de entrada.
 */
function LineaDeFlujo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden className={cn("h-12 w-full", className)} preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="34" height="48" patternUnits="userSpaceOnUse">
          <path d="M9 12 L21 24 L9 36" fill="none" stroke="hsl(var(--marca-lima))" strokeWidth="6" strokeLinecap="square" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="2" fill="hsl(var(--marca-lima) / 0.45)" />
      <rect x="0" y="46" width="100%" height="2" fill="hsl(var(--marca-lima) / 0.45)" />
      <rect x="0" y="0" width="100%" height="48" fill={`url(#${id})`} />
    </svg>
  );
}

/** Marco común: banda oscura con la marca (arriba en el móvil, a la izquierda en el ordenador) y el contenido. */
function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-marca-tinta px-6 pb-6 pt-8 text-white lg:w-[44%] lg:px-12 lg:py-12">
        <img src="/marca/logo-verdnatura-blanco.png" alt="Verdnatura" className="h-7 w-auto self-start lg:h-9" />
        <div className="mt-10 space-y-2 lg:mt-0">
          <p className="text-2xl font-semibold leading-tight lg:text-4xl">Stock y almacén</p>
          <p className="text-sm text-white/60 lg:text-base">Nave de Holanda</p>
        </div>
        <LineaDeFlujo className="mt-6 animate-in slide-in-from-left-12 fade-in duration-700 motion-reduce:animate-none lg:mt-0" />
      </aside>
      <main className="flex flex-1 items-start justify-center px-6 py-10 lg:items-center lg:py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

function Formulario() {
  const { entrar } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setEntrando(true);
    setError(null);
    try {
      await entrar(email, password);
    } catch (e) {
      setError(mensajeEntrada(e));
      setEntrando(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      className="space-y-5"
      noValidate
    >
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-muted-foreground">Con el correo y la contraseña que te ha dado un administrador.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entrada-correo">Correo</Label>
        <Input
          id="entrada-correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entrada-contrasena">Contraseña</Label>
        <div className="relative">
          <Input
            id="entrada-contrasena"
            type={ver ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? "Ocultar la contraseña" : "Mostrar la contraseña"}
            aria-pressed={ver}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-peligro-borde bg-peligro-suave px-3 py-2 text-sm text-peligro-texto">
          {error}
        </p>
      )}

      <Button type="submit" className="h-11 w-full text-base" disabled={entrando}>
        {entrando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>

      <p className="text-sm text-muted-foreground">¿Has olvidado la contraseña? Pide a un administrador que te ponga una nueva.</p>
    </form>
  );
}

function SinAcceso({ email }: { email: string }) {
  const { salir } = useSesion();
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Tu usuario no tiene acceso</h1>
        <p className="text-sm text-muted-foreground">
          Has entrado como <span className="font-medium text-foreground">{email || "un usuario sin correo"}</span>, pero ese usuario no
          está dado de alta en la app o se le ha quitado el acceso. Habla con un administrador.
        </p>
      </div>
      <Button variant="outline" className="h-11 w-full gap-2" onClick={() => void salir()}>
        <LogOut className="h-4 w-4" /> Salir
      </Button>
    </div>
  );
}

/** Lo que se ve antes de estar dentro: comprobando, pantalla de entrada o usuario sin acceso. */
export function PantallaEntrada() {
  const sesion = useSesion();
  if (sesion.estado === "cargando") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Cargando">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Marco>{sesion.estado === "sin-acceso" ? <SinAcceso email={sesion.email} /> : <Formulario />}</Marco>;
}
