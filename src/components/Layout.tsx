import { Link, NavLink, Outlet } from "react-router-dom";
import { useTheme } from "next-themes";
import { Boxes, History, Home, LayoutGrid, Map as MapIcon, Moon, Package, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchCommand } from "@/components/SearchCommand";

const navItems = [
  { to: "/",            label: "Inicio",      icon: Home,        end: true },
  { to: "/mapa",        label: "Mapa",        icon: MapIcon },
  { to: "/articulos",   label: "Artículos",   icon: Package },
  { to: "/stock-total", label: "Stock",       icon: Boxes },
  { to: "/estanterias", label: "Estanterías", icon: LayoutGrid },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title="Cambiar tema"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

const Layout = () => {
  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          {/* Logo */}
          <Link to="/" className="min-w-0 text-lg font-bold leading-tight text-foreground sm:text-xl">
            <span className="block truncate">Verdnatura</span>
            <span className="block text-xs font-medium text-muted-foreground sm:hidden">
              Stock y mapa
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden gap-1 sm:flex sm:gap-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
            {/* Historial solo en desktop */}
            <NavLink
              to="/historial"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <History className="h-4 w-4" />
              <span>Historial</span>
            </NavLink>
          </nav>

          {/* Acciones header */}
          <div className="flex items-center gap-1">
            <SearchCommand />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 sm:py-6">
        <Outlet />
      </main>

      {/* Nav móvil inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-card/95 px-1 py-1 shadow-lg backdrop-blur sm:hidden">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
