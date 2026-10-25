import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Map, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type Articulo = { id: string; nombre: string; categoria: string | null };

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Articulo[]>([]);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K abre la paleta
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("articulos")
        .select("id, nombre, categoria")
        .ilike("nombre", `%${query.trim()}%`)
        .limit(8);
      setResults((data ?? []) as Articulo[]);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* Botón en el header */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden gap-2 text-muted-foreground sm:flex"
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Buscar...</span>
        <kbd className="ml-1 rounded border bg-muted px-1.5 text-[10px] font-mono">⌘K</kbd>
      </Button>
      {/* Icono solo en móvil */}
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="sm:hidden">
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar artículo, ir a sección..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Sin resultados para "{query}"</CommandEmpty>

          {results.length > 0 && (
            <CommandGroup heading="Artículos">
              {results.map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.nombre}
                  onSelect={() => go(`/articulos?q=${encodeURIComponent(a.nombre)}`)}
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{a.nombre}</span>
                    {a.categoria && (
                      <span className="text-xs text-muted-foreground">{a.categoria}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {query && (
                <CommandItem
                  value={`buscar-en-mapa-${query}`}
                  onSelect={() => go(`/mapa?busqueda=${encodeURIComponent(query)}`)}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <Map className="h-4 w-4" />
                  <span>Ver "{query}" en el mapa</span>
                </CommandItem>
              )}
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup heading="Navegación rápida">
            <CommandItem onSelect={() => go("/mapa")} className="flex items-center gap-2">
              <Map className="h-4 w-4 text-muted-foreground" />
              <span>Ir al mapa del almacén</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/articulos")} className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>Ir a Artículos</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/historial")} className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span>Ver historial de movimientos</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
