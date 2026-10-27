import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, MoreHorizontal, Pencil, RefreshCw, ShieldCheck, UserPlus, UserRoundCheck, UserRoundX } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarraSuperior } from "@/components/BarraSuperior";
import { cn } from "@/lib/utils";
import { usePerfil, type Rol } from "@/auth/sesion";
import { MINIMO_CONTRASENA } from "@/auth/DialogoContrasena";
import {
  CLAVE_USUARIOS,
  ROLES,
  cambiarAcceso,
  crearUsuario,
  editarPerfil,
  generarContrasena,
  ponerContrasena,
  useUsuarios,
  type Usuario,
} from "@/usuarios/useUsuarios";

const Aviso = ({ children }: { children: string }) => (
  <p role="alert" className="rounded-lg border border-peligro-borde bg-peligro-suave px-3 py-2 text-sm text-peligro-texto">
    {children}
  </p>
);

/** Elegir rol: dos tarjetas con lo que puede hacer cada uno. */
function ElegirRol({ valor, onCambiar, bloqueado }: { valor: Rol; onCambiar: (r: Rol) => void; bloqueado?: string }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">Rol</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(ROLES) as Rol[]).map((r) => (
          <label
            key={r}
            className={cn(
              "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              valor === r ? "border-primary bg-primary/10" : "hover:bg-accent",
              bloqueado && "cursor-not-allowed opacity-60",
            )}
          >
            <input type="radio" name="rol" value={r} checked={valor === r} onChange={() => onCambiar(r)} disabled={!!bloqueado} className="sr-only" />
            <span className="font-semibold">{ROLES[r].nombre}</span>
            <span className="text-xs text-muted-foreground">{ROLES[r].texto}</span>
          </label>
        ))}
      </div>
      {bloqueado && <p className="text-xs text-muted-foreground">{bloqueado}</p>}
    </fieldset>
  );
}

/** Campo de contraseña provisional con botón para inventar una. */
function CampoContrasena({ id, valor, onCambiar }: { id: string; valor: string; onCambiar: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Contraseña provisional</Label>
      <div className="flex gap-2">
        <Input id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} autoComplete="off" spellCheck={false} className="font-medium" />
        <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => onCambiar(generarContrasena())}>
          <RefreshCw className="h-4 w-4" /> Generar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Al menos {MINIMO_CONTRASENA} caracteres. Luego la puede cambiar desde el menú.</p>
    </div>
  );
}

/** Los datos para pasárselos a la persona, con botón para copiarlos. */
function DatosParaPasar({ email, password }: { email: string; password: string }) {
  const copiar = async () => {
    const texto = `Web: ${window.location.origin}\nCorreo: ${email}\nContraseña: ${password}`;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Datos copiados");
    } catch {
      toast.error("No se han podido copiar. Cópialos a mano.");
    }
  };
  return (
    <div className="space-y-3">
      <dl className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Web</dt>
          <dd className="font-medium">{window.location.host}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Correo</dt>
          <dd className="break-all font-medium">{email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Contraseña</dt>
          <dd className="font-medium tracking-wide">{password}</dd>
        </div>
      </dl>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => void copiar()}>
        <Copy className="h-4 w-4" /> Copiar los datos
      </Button>
    </div>
  );
}

/** Añadir una persona, o cambiar el nombre y el rol de una que ya está. */
function DialogoPersona({ abierto, usuario, onCerrar }: { abierto: boolean; usuario: Usuario | null; onCerrar: () => void }) {
  const yo = usePerfil();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("equipo");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<{ nombre: string; email: string; password: string } | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre(usuario?.nombre ?? "");
    setEmail(usuario?.email ?? "");
    setPassword(usuario ? "" : generarContrasena());
    setRol(usuario?.rol ?? "equipo");
    setError(null);
    setCreado(null);
  }, [abierto, usuario]);

  const guardar = async () => {
    const n = nombre.trim();
    if (n.length < 2) return setError("Escribe el nombre (al menos 2 letras). Es el que sale en el historial.");
    if (!usuario && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Ese correo no es válido. Revísalo.");
    if (!usuario && password.length < MINIMO_CONTRASENA)
      return setError(`La contraseña tiene que tener al menos ${MINIMO_CONTRASENA} caracteres.`);
    setGuardando(true);
    setError(null);
    try {
      if (usuario) {
        await editarPerfil(usuario.id, { nombre: n, rol });
        toast.success("Cambios guardados");
        onCerrar();
      } else {
        await crearUsuario({ nombre: n, email: email.trim(), password, rol });
        setCreado({ nombre: n, email: email.trim().toLowerCase(), password });
      }
      void queryClient.invalidateQueries({ queryKey: CLAVE_USUARIOS });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const soyYo = usuario?.id === yo.id;

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        {creado ? (
          <>
            <DialogHeader>
              <DialogTitle>{creado.nombre} ya puede entrar</DialogTitle>
              <DialogDescription>Pásale estos datos. Podrá cambiar la contraseña desde el menú.</DialogDescription>
            </DialogHeader>
            <DatosParaPasar email={creado.email} password={creado.password} />
            <DialogFooter>
              <Button onClick={onCerrar}>Hecho</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{usuario ? `Editar a ${usuario.nombre}` : "Añadir persona"}</DialogTitle>
              <DialogDescription>
                {usuario ? "El nombre nuevo sale en el historial desde ahora." : "Tendrá su propio usuario para entrar en la app."}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void guardar();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="persona-nombre">Nombre</Label>
                <Input id="persona-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoFocus />
                <p className="text-xs text-muted-foreground">Sale en el historial junto a cada cambio que haga.</p>
              </div>
              {!usuario && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="persona-correo">Correo</Label>
                    <Input
                      id="persona-correo"
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoComplete="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <CampoContrasena id="persona-contrasena" valor={password} onCambiar={setPassword} />
                </>
              )}
              <ElegirRol valor={rol} onCambiar={setRol} bloqueado={soyYo ? "Tu propio rol no lo puedes cambiar: pídeselo a otro administrador." : undefined} />
              {error && <Aviso>{error}</Aviso>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onCerrar}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                  {usuario ? "Guardar cambios" : "Añadir persona"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Poner una contraseña nueva a otra persona (cuando la olvida). */
function DialogoNuevaContrasena({ usuario, onCerrar }: { usuario: Usuario | null; onCerrar: () => void }) {
  const [password, setPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecha, setHecha] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    setPassword(generarContrasena());
    setError(null);
    setHecha(false);
  }, [usuario]);

  const guardar = async () => {
    if (!usuario) return;
    if (password.length < MINIMO_CONTRASENA) return setError(`La contraseña tiene que tener al menos ${MINIMO_CONTRASENA} caracteres.`);
    setGuardando(true);
    setError(null);
    try {
      await ponerContrasena(usuario.id, password);
      setHecha(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!usuario} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{hecha ? "Contraseña cambiada" : `Contraseña nueva para ${usuario?.nombre ?? ""}`}</DialogTitle>
          <DialogDescription>
            {hecha ? `Pásale estos datos a ${usuario?.nombre}. La de antes ya no sirve.` : "La que tenía deja de servir en cuanto la cambies."}
          </DialogDescription>
        </DialogHeader>
        {hecha && usuario ? (
          <>
            <DatosParaPasar email={usuario.email} password={password} />
            <DialogFooter>
              <Button onClick={onCerrar}>Hecho</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
            className="space-y-4"
          >
            <CampoContrasena id="nueva-contrasena" valor={password} onCambiar={setPassword} />
            {error && <Aviso>{error}</Aviso>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Poner contraseña
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FilaUsuario({
  u,
  esYo,
  onEditar,
  onContrasena,
  onAcceso,
}: {
  u: Usuario;
  esYo: boolean;
  onEditar: () => void;
  onContrasena: () => void;
  onAcceso: () => void;
}) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", !u.activo && "bg-muted/40")}>
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          u.activo ? "bg-primary/15 text-marca-lima-oscuro" : "bg-muted text-muted-foreground",
        )}
      >
        {u.nombre.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
          <span className={cn("truncate", !u.activo && "text-muted-foreground")}>{u.nombre}</span>
          {esYo && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Tú</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{u.email}</p>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <RolYEstado u={u} />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Opciones de ${u.nombre}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 sm:hidden">
            <RolYEstado u={u} />
          </div>
          <DropdownMenuItem onSelect={onEditar} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar nombre y rol
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onContrasena} className="gap-2" disabled={!u.activo}>
            <KeyRound className="h-4 w-4" /> Poner contraseña nueva
          </DropdownMenuItem>
          {!esYo && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onAcceso} className={cn("gap-2", u.activo && "text-peligro-texto focus:text-peligro-texto")}>
                {u.activo ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}
                {u.activo ? "Quitar acceso" : "Devolver acceso"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function RolYEstado({ u }: { u: Usuario }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          u.rol === "admin" ? "bg-marca-tinta text-white dark:bg-white dark:text-marca-tinta" : "bg-muted text-foreground",
        )}
      >
        {u.rol === "admin" && <ShieldCheck className="h-3 w-3" />}
        {ROLES[u.rol].nombre}
      </span>
      {!u.activo && <span className="rounded-full bg-peligro-suave px-2 py-0.5 text-xs font-semibold text-peligro-texto">Sin acceso</span>}
    </span>
  );
}

/** Quién puede entrar en la app y qué puede hacer (solo administradores). */
const Usuarios = () => {
  const yo = usePerfil();
  const queryClient = useQueryClient();
  const usuarios = useUsuarios();
  const [persona, setPersona] = useState<{ abierto: boolean; usuario: Usuario | null }>({ abierto: false, usuario: null });
  const [paraContrasena, setParaContrasena] = useState<Usuario | null>(null);
  const [paraAcceso, setParaAcceso] = useState<Usuario | null>(null);
  const [cambiando, setCambiando] = useState(false);

  if (yo.rol !== "admin") return <Navigate to="/" replace />;

  const lista = usuarios.data ?? [];
  const conAcceso = lista.filter((u) => u.activo);
  const sinAcceso = lista.filter((u) => !u.activo);

  const confirmarAcceso = async () => {
    if (!paraAcceso) return;
    setCambiando(true);
    try {
      await cambiarAcceso(paraAcceso.id, !paraAcceso.activo);
      toast.success(paraAcceso.activo ? `${paraAcceso.nombre} ya no puede entrar` : `${paraAcceso.nombre} vuelve a tener acceso`);
      void queryClient.invalidateQueries({ queryKey: CLAVE_USUARIOS });
      setParaAcceso(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCambiando(false);
    }
  };

  const fila = (u: Usuario) => (
    <FilaUsuario
      key={u.id}
      u={u}
      esYo={u.id === yo.id}
      onEditar={() => setPersona({ abierto: true, usuario: u })}
      onContrasena={() => setParaContrasena(u)}
      onAcceso={() => setParaAcceso(u)}
    />
  );

  return (
    <div className="min-h-dvh bg-background">
      <BarraSuperior className="sticky top-0" />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <p className="text-sm text-muted-foreground">Quién puede entrar en la app y qué puede hacer.</p>
          </div>
          <Button className="gap-2" onClick={() => setPersona({ abierto: true, usuario: null })}>
            <UserPlus className="h-4 w-4" /> Añadir persona
          </Button>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {(Object.keys(ROLES) as Rol[]).map((r) => (
            <div key={r} className="rounded-lg border px-3 py-2">
              <dt className="font-semibold">{ROLES[r].nombre}</dt>
              <dd className="text-muted-foreground">{ROLES[r].texto}</dd>
            </div>
          ))}
        </dl>

        {usuarios.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : usuarios.isError ? (
          <Aviso>No se ha podido cargar la lista de usuarios. Recarga la página para volver a probar.</Aviso>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-xl border">{conAcceso.map(fila)}</ul>
            {sinAcceso.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">Sin acceso</h2>
                <ul className="divide-y overflow-hidden rounded-xl border">{sinAcceso.map(fila)}</ul>
              </section>
            )}
          </>
        )}
      </main>

      <DialogoPersona abierto={persona.abierto} usuario={persona.usuario} onCerrar={() => setPersona((p) => ({ ...p, abierto: false }))} />
      <DialogoNuevaContrasena usuario={paraContrasena} onCerrar={() => setParaContrasena(null)} />
      <AlertDialog open={!!paraAcceso} onOpenChange={(a) => !a && !cambiando && setParaAcceso(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paraAcceso?.activo ? `¿Quitar el acceso a ${paraAcceso?.nombre}?` : `¿Devolver el acceso a ${paraAcceso?.nombre}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paraAcceso?.activo
                ? "No podrá entrar en la app. Su nombre se queda en el historial y puedes devolverle el acceso cuando quieras."
                : "Podrá volver a entrar con su correo y la contraseña que tenía."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cambiando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarAcceso();
              }}
              disabled={cambiando}
              className={cn(paraAcceso?.activo && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              {cambiando && <Loader2 className="h-4 w-4 animate-spin" />}
              {paraAcceso?.activo ? "Quitar acceso" : "Devolver acceso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Usuarios;
