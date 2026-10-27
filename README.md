# Verdnatura · Stock y almacén

Aplicación web para controlar el stock del almacén de Verdnatura en la nave de
Holanda. La pantalla principal es la nave en 3D: se recorre como un mapa y, al
tocar una zona u objeto, la cámara vuela hasta ella y se ve qué hay guardado
allí.

## Acceso con usuario

Solo entra quien tiene usuario: correo y contraseña de Supabase Auth, más un
perfil (tabla `perfiles`) con su nombre, su rol y si tiene acceso. Sin haber
entrado no se ve nada: ni el mapa, ni el stock, ni las fotos. No hay registro
público; la contraseña olvidada la pone nueva un administrador.

| Rol | Qué puede hacer |
| --- | --- |
| Administrador | Todo: editar el mapa, borrar artículos, gestionar usuarios y descargar la copia de seguridad. |
| Equipo | Contar stock y crear o editar artículos. |

Los administradores gestionan a la gente en **☰ → Usuarios**: añadir persona
(con una contraseña provisional que se le pasa), cambiar nombre y rol, poner
una contraseña nueva y quitar o devolver el acceso. A quien se le quita el
acceso no se le borra: su nombre sigue en el historial. La base de datos no
deja que se quede sin ningún administrador.

Las altas, contraseñas y bajas pasan por la función `usuarios` de Supabase
(`supabase/functions/usuarios`), que comprueba que quien llama es
administrador y usa la clave de servicio, que nunca sale de Supabase. Los
permisos de verdad están en la base de datos (políticas RLS con
`es_usuario()` y `es_admin()`); la app solo esconde lo que no se puede usar.

## Catálogo de artículos

En `/articulos` (botón de la caja en el mapa) está todo lo que tenemos: cada
artículo con sus fotos, categoría, unidad en la que se cuenta (carros, cajas,
rollos...), descripción y las características que se quieran apuntar (nombre y
valor libres). El stock es la cantidad que hay en cada zona del mapa; el total
es la suma.

Desde el mapa, al entrar en una zona, el panel «Qué hay aquí» lista los
artículos de esa zona con su cantidad y botones **+ / −** para contar (tocando
el número se escribe la cantidad exacta). «Añadir» crea un artículo nuevo ya
colocado en la zona o pone aquí uno que ya existe.

Cada artículo puede tener un **stock mínimo** opcional: si el total baja de ahí
sale marcado «Bajo mínimo» en el catálogo, el buscador y los informes.

## Lo que hay, a la vista en el mapa

Cada artículo puede tener un **dibujo en el mapa** («Cómo se ve en el mapa» en
la ficha): carros CC apilados, carro CC con barras, con bandejas o con cartón,
palet de planchas de cartón, palet con film y flejes, o armario con cajas. En
la zona donde está guardado se dibuja como es, a tamaño real y con los colores
de las fotos, tantos como diga la cantidad (lo que quepa): 20 carros CC son dos
pilas de 10; 3 palets que no caben en el suelo van de dos en dos. Si en una
estantería solo hay cajas de etiquetas, el armario ocupa el lugar de la
estantería de adorno. Los objetos «Carros CC» sin nada apuntado se dibujan con
carros montados y vacíos.

Encima de cada zona con algo guardado sale un **bocadillo** con la foto de lo
que hay y cuánto (3 fotos en el ordenador, 2 en el móvil, y «+N» si hay más);
al tocarlo se entra en la zona. Se apaga en el menú ☰ → «Fotos de lo que hay en
cada zona». Las fotos de los artículos se suben sin fondo (PNG o WebP con
transparencia) para que se vean limpias.

Si se borra del mapa una zona con artículos, la app avisa antes; sus
cantidades no se pierden, quedan **«Sin ubicar»** y el catálogo las señala
para colocarlas en otra zona.

## Buscar

La lupa del mapa (o Ctrl+K, o «/») busca artículos por nombre, categoría,
características o zona, y zonas del mapa, sin importar tildes ni mayúsculas.
Al elegir un artículo, el mapa señala todas las zonas donde está con su
cantidad (`/?articulo=<id>`). Sin escribir nada salen lo visto hace poco y lo
que está por debajo del mínimo.

## Historial y varias personas a la vez

Unos disparadores de la base de datos apuntan en la tabla `historial` todo lo
que cambia (cantidades, artículos y mapa), con el nombre del perfil de quien lo
hizo y cuándo. Se ve en `/historial` (con filtros por persona, tipo, artículo y zona)
y en la ficha de cada artículo.

Para que varias personas no se pisen:
- los botones + / − suman o restan en la propia base de datos
  (`ajustar_existencia`), y los toques seguidos se mandan juntos;
- la ficha solo guarda lo que se ha cambiado y, si otra persona tocó eso mismo
  mientras tanto, no guarda y avisa de qué ha cambiado;
- el editor del mapa compara con el mapa de cuando se empezó a editar, así que
  al guardar no deshace lo que otro haya guardado entretanto;
- los cambios de los demás llegan al momento (Supabase Realtime) y la app se
  actualiza sola. El punto verde del menú indica que está conectado.

## Exportar el stock

«Exportar» en la barra de arriba. Se elige:
- **Excel**: resumen con los números clave y los avisos, una hoja por artículo
  (foto, total, mínimo, estado, dónde está, características) y otra por zona
  con el color de cada zona;
- **PDF**: lo mismo, listo para imprimir o mandar.

Se genera en el propio navegador (`src/exportar`), con fotos o sin ellas.

## Siempre encendida y copias de seguridad

`api/mantenimiento.js` es una función de Vercel que el cron de `vercel.json`
lanza cada día. Llama al `latido()` de la base de datos, que no devuelve
ningún dato, para que el proyecto gratuito de Supabase no se pause por falta de
uso.

La copia de seguridad la hace la propia base de datos cada noche a las 03:17
UTC (pg_cron → `hacer_copia()`): todo (mapa, artículos, existencias,
historial y usuarios) en la tabla `copias_seguridad`, una por día, y se
guardan los últimos 30 días. Los administradores descargan la última desde
**☰ → Descargar copia de seguridad**. Las copias antiguas en JSON siguen en el
bucket `copias` (Storage).

## App en el móvil

Tiene manifiesto e iconos: en Android, el menú ofrece «Instalar en este
dispositivo»; en iPhone, desde Safari, Compartir → «Añadir a pantalla de
inicio». El tema (claro, oscuro o el del dispositivo) se elige en el menú.

## En pausa

- **Códigos QR por zona** (`src/qr`): etiquetas para imprimir y pegar en la
  nave que abren esa zona al escanearlas. Hechas pero apagadas; se activan
  poniendo `codigosQR: true` en `src/funciones.ts`.

Las fotos se reducen en el navegador (lado mayor 1600 px, JPEG) antes de
subirlas al bucket privado `fotos-articulos` de Supabase; para verlas, la app
pide enlaces firmados que valen una semana. Las que se suben y luego se
cancelan, o se quitan de un artículo, se borran del almacén.

## Editar el mapa

Con el botón del lápiz se entra en el modo edición. Ahí se pueden mover las
zonas y objetos arrastrándolos, cambiarles el tamaño por las esquinas o los
lados, añadir otros nuevos, duplicarlos, borrarlos y cambiar su nombre,
categoría, color, sentido de las flechas, muelle y medidas exactas. Nada se
guarda hasta pulsar «Guardar»; «Deshacer» (Ctrl+Z) vuelve atrás y Supr borra
lo seleccionado. Los cambios se guardan en la tabla `elementos_mapa` de
Supabase, así que todo el equipo ve el mismo mapa.

Cada zona u objeto tiene el interruptor **«Se guardan artículos aquí»**. Solo
los que lo tienen encendido salen en «Zonas», en el buscador y en la ficha de
los artículos, y solo en ellos se entra tocando el mapa. De serie está apagado
en las líneas de flujo (entradas, vuelta de vacíos, tumba, frío, plantas, CC
tumbados, boxes), los PC y los cargadores: se ven y se editan, pero no se
entra en ellos.

Con **«Mostrar el nombre en el mapa»** apagado, el nombre no sale sobre el mapa
(menos ruido): en las zonas donde se guardan artículos sale al pasar el ratón
y en «Zonas»; en lo demás, solo al editar. De serie está apagado en los
cargadores.

## Imagen de marca

La app usa la imagen oficial de [verdnatura.es](https://verdnatura.es):
- **Letra**: Poppins (400, 500, 600 y 700), con el espaciado de letra de la web.
- **Colores**: verde lima `#8CC63F` para botones y acentos, casi negro
  `#1A1A1A` para el texto, grises `#3D3D3D`, `#747A87`, `#E0DEDE`,
  `#EEF0F2` y `#F8F8F8`. Están como variables en `src/index.css` (`marca-*`) y los
  avisos tienen las suyas (`aviso`, `peligro`, `correcto`), en claro y en oscuro.
- **Logo** (`public/marca`): el de la web y una versión con «Verd» en blanco para el
  tema oscuro y la banda negra del Excel y el PDF. El icono de la app y el favicon
  son las cuatro hojas de la web.
- **Botones** en píldora, como los de la web.
- El Excel y el PDF llevan la banda negra con el logo, Poppins (incrustada en el
  PDF, `src/exportar/fuentes`, licencia OFL) y el verde lima.

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase, y para el 3D
Three.js con React Three Fiber, drei y camera-controls.

## Puesta en marcha

1. `npm install`
2. Copiar `.env.example` a `.env.local` y rellenar los datos del proyecto de Supabase.
3. Aplicar las migraciones de `supabase/migrations` en orden (SQL Editor de Supabase o `supabase db push`).
4. Desplegar la función `supabase/functions/usuarios` (Edge Functions → Deploy
   a new function → Via Editor, con el nombre `usuarios`) y apagar en sus
   ajustes «Verify JWT with legacy secret».
5. Primer administrador: crearlo en Authentication → Users → Add user → Create
   new user (con «Auto confirm user») y darle perfil en el SQL Editor:
   `insert into public.perfiles (id, nombre, email, rol) select id, 'Nombre', email, 'admin' from auth.users where email = 'su@correo';`
   Los demás se añaden desde la app. En Authentication → Sign In / Providers
   conviene apagar «Allow new users to sign up».
6. `npm run dev` → http://localhost:8080 (en PowerShell, `npm.cmd run dev`).

## Cómo está organizado el 3D (`src/nave`)

| Archivo | Qué contiene |
| --- | --- |
| `plano.ts` | Medidas de la nave sacadas del PDF del plano: límite con las otras empresas, paredes, pilares, muelles M3–M8, oficinas, cámara frigorífica y la cuadrícula de referencia (vanos A–K, franjas 1–4). Solo se dibuja la parte de Verdnatura. |
| `elementos.ts` | Tipo `Elemento` (líneas, zonas, estanterías y objetos), categorías y colores de serie, y cómo se crea uno nuevo. |
| `mapa-inicial.json` | El mapa de serie sacado del croquis; también es la semilla de la migración y el respaldo si Supabase no responde. |
| `useMapa.ts`, `useEditor.ts` | Lectura y guardado en Supabase, y el borrador del modo edición con su historial para deshacer. |
| `EscenaNave.tsx` | El lienzo 3D, las luces y la cámara con sus vuelos entre vista general y zona. |
| `Estructura.tsx` | Dibuja la nave fija: suelo, paredes cortadas, pilares, muelles, oficinas, cámara frigorífica, rótulos. |
| `ElementoMapa.tsx` | Cada elemento según su tipo (flechas de flujo animadas, nombre pintado en el suelo, lo que tiene guardado y su bocadillo) y, en edición, su selección, arrastre y tiradores. |
| `contenido.ts`, `DibujoContenido.tsx` | Los artículos dibujados como son (carros CC, palets, armario de etiquetas) con medidas reales y cómo se reparten en la zona; el bocadillo con las fotos. |
| `PanelEdicion.tsx`, `BarraEdicion.tsx` | Propiedades del elemento seleccionado y barra inferior del modo edición. |
| `marco.ts`, `Puestos.tsx`, `estanterias.ts` | Marco local (a lo largo / a lo ancho) y modelos de objetos y estanterías, que valen en las dos orientaciones. |
| `piezas.tsx`, `fundido.ts`, `geometria.ts` | Cajas instanciadas, fundido suave de opacidad y utilidades para pasar del plano a la escena. |

La escala es provisional (1:300, unos 110 × 34 m) porque el plano no trae
cotas: cuando haya una medida real basta con reescalar los números de
`plano.ts`.

## Catálogo (`src/articulos`)

| Archivo | Qué contiene |
| --- | --- |
| `modelo.ts` | Tipos `Articulo`, `Existencia` y `Caracteristica`, unidades y características sugeridas, URL pública de las fotos. |
| `aspectos.ts` | Los dibujos que puede tener un artículo en el mapa. |
| `useArticulos.ts` | Lectura de artículos con sus existencias, guardado (artículo, existencias por zona y limpieza de fotos), borrado y subida de fotos. |
| `imagen.ts` | Reduce las fotos antes de subirlas. |
| `FichaArticulo.tsx` | La ficha lateral para crear o editar un artículo; se usa en el catálogo y en el mapa. |

Tablas en Supabase: `articulos` y `existencias` (cantidad de un artículo en un
elemento del mapa; si se borra la zona, la existencia queda «sin ubicar»).

## Resto del código

| Carpeta / archivo | Qué contiene |
| --- | --- |
| `src/nave/Paneles.tsx` | Panel de zona («Qué hay aquí» con + / −) y panel del artículo buscado. |
| `src/buscador` | Buscador del mapa y los vistos hace poco. |
| `src/historial` | Lectura del historial, cómo se cuenta cada cambio y su lista. |
| `src/exportar` | Datos del informe, Excel (ExcelJS), PDF (jsPDF) y el diálogo. |
| `src/auth` | Sesión y perfil de quien ha entrado, pantalla de entrada y cambiar la contraseña propia. |
| `src/usuarios`, `src/pages/Usuarios.tsx` | Gestión de usuarios (solo administradores). |
| `supabase/functions/usuarios` | Función de Supabase para altas, contraseñas y acceso. |
| `src/lib/copia.ts` | Descargar la última copia de seguridad. |
| `src/lib/tiempoReal.ts` | Escucha los cambios de los demás y refresca. |
| `src/lib/texto.ts` | Búsqueda sin tildes y con puntuación. |
| `src/components/BarraSuperior.tsx` | Barra de arriba, igual en todas las páginas: Mapa, Artículos, Historial, Exportar y «Nuevo artículo» (en el móvil, en una fila de pestañas). |
| `src/components/MenuGeneral.tsx` | Menú ☰: tu cuenta (contraseña, salir; usuarios y copia para administradores), tema, instalar la app y el estado del tiempo real. |
| `src/funciones.ts` | Funciones hechas pero apagadas. |
| `api/mantenimiento.js` | Tarea diaria: el latido que mantiene Supabase activo. |

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon / publishable) |
| `VITE_SUPABASE_PROJECT_ID` | Ref del proyecto |
