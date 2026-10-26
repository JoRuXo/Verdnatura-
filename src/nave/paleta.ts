// Colores de la maqueta 3D en tema claro y oscuro.

export type Paleta = {
  fondo: string;
  suelo: string;
  patio: string;
  lineas: string;
  pared: string;
  corte: string;
  pilar: string;
  oficina: string;
  camara: string;
  abrigo: string;
  nivelador: string;
  marcaPatio: string;
};

export const PALETA_CLARA: Paleta = {
  fondo: "#e8ecf0",
  suelo: "#f7f8f9",
  patio: "#d9dee4",
  lineas: "#c3ccd6",
  pared: "#a7b1bc",
  corte: "#3f4a56",
  pilar: "#8794a2",
  oficina: "#efe9df",
  camara: "#22b8cf",
  abrigo: "#3b4450",
  nivelador: "#56606b",
  marcaPatio: "#ffffff",
};

export const PALETA_OSCURA: Paleta = {
  fondo: "#0d131b",
  suelo: "#26313f",
  patio: "#151c26",
  lineas: "#3a495c",
  pared: "#64748b",
  corte: "#d3dde8",
  pilar: "#728199",
  oficina: "#475467",
  camara: "#22d3ee",
  abrigo: "#2e3744",
  nivelador: "#556070",
  marcaPatio: "#64748b",
};
