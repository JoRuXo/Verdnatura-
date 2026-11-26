import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  valor: string;
  /** Guarda el texto nuevo; si falla, que lance (el campo vuelve a lo que había). */
  onGuardar: (nuevo: string) => Promise<void>;
  /** Solo lectura: se ve como texto normal. */
  soloLeer?: boolean;
  multilinea?: boolean;
  /** No deja guardar vacío (vuelve a lo que había). */
  obligatorio?: boolean;
  placeholder?: string;
  etiqueta: string;
  sugerencias?: string[];
  className?: string;
};

/**
 * Un texto que se cambia escribiendo encima, sin botón de guardar: se guarda al
 * salir del campo (o con Intro si es de una línea). Esc deja lo que había.
 * Al pasar por encima se nota que se puede tocar; mientras guarda lo dice.
 */
export function TextoEditable({ valor, onGuardar, soloLeer, multilinea, obligatorio, placeholder, etiqueta, sugerencias, className }: Props) {
  const [texto, setTexto] = useState(valor);
  const [enfocado, setEnfocado] = useState(false);
  const [estado, setEstado] = useState<"quieto" | "guardando" | "guardado">("quieto");
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const cancelado = useRef(false);
  const lista = useId();

  // Si cambia desde fuera (otra persona, otra pantalla) y no se está escribiendo, se ve lo nuevo
  useEffect(() => {
    if (!enfocado) setTexto(valor);
  }, [valor, enfocado]);

  useEffect(() => {
    if (estado !== "guardado") return;
    const t = window.setTimeout(() => setEstado("quieto"), 1500);
    return () => window.clearTimeout(t);
  }, [estado]);

  if (soloLeer) {
    if (!valor) return null;
    return <p className={cn("whitespace-pre-line", className)}>{valor}</p>;
  }

  const guardar = async () => {
    setEnfocado(false);
    if (cancelado.current) {
      cancelado.current = false;
      setTexto(valor);
      return;
    }
    const nuevo = multilinea ? texto.replace(/\s+$/, "") : texto.trim();
    if (nuevo === valor) return setTexto(valor);
    if (obligatorio && !nuevo) return setTexto(valor);
    setEstado("guardando");
    try {
      await onGuardar(nuevo);
      setEstado("guardado");
    } catch {
      setEstado("quieto");
      setTexto(valor);
    }
  };

  const comun = {
    ref,
    value: texto,
    placeholder,
    "aria-label": etiqueta,
    onFocus: () => setEnfocado(true),
    onBlur: () => void guardar(),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setTexto(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelado.current = true;
        ref.current?.blur();
      }
      if (e.key === "Enter" && (!multilinea || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        ref.current?.blur();
      }
    },
    className: cn(
      "w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 outline-none transition",
      "placeholder:text-muted-foreground/70 hover:border-border hover:bg-background/60",
      "focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/30",
      multilinea && "resize-none [field-sizing:content] min-h-[2.25rem]",
      className,
    ),
  };

  return (
    <div className="group relative">
      {multilinea ? (
        <textarea rows={2} {...comun} />
      ) : (
        <input {...comun} list={sugerencias?.length ? lista : undefined} autoComplete="off" />
      )}
      {sugerencias?.length ? (
        <datalist id={lista}>
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      <span className="pointer-events-none absolute -right-1 top-1.5 text-muted-foreground" aria-live="polite">
        {estado === "guardando" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Guardando" />
        ) : estado === "guardado" ? (
          <Check className="h-3.5 w-3.5 text-correcto" aria-label="Guardado" />
        ) : (
          !enfocado && <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-60" aria-hidden />
        )}
      </span>
    </div>
  );
}
