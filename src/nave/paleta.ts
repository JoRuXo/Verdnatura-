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

// Grises neutros de la marca (los de verdnatura.es: #F8F8F8, #EEF0F2, #E0DEDE,
// #747A87, #3D3D3D, #1A1A1A), sin el tono azulado de antes.
export const PALETA_CLARA: Paleta = {
  fondo: "#eef0f2",
  suelo: "#f8f8f8",
  patio: "#e0dede",
  lineas: "#cfd2d7",
  pared: "#b3b7be",
  corte: "#3d3d3d",
  pilar: "#747a87",
  oficina: "#f1ede4",
  camara: "#22b8cf",
  abrigo: "#3d3d3d",
  nivelador: "#5c616b",
  marcaPatio: "#ffffff",
};

export const PALETA_OSCURA: Paleta = {
  fondo: "#131313",
  suelo: "#262626",
  patio: "#1a1a1a",
  lineas: "#3d3d3d",
  pared: "#5c616b",
  corte: "#e0dede",
  pilar: "#747a87",
  oficina: "#3d3d3d",
  camara: "#22d3ee",
  abrigo: "#2b2b2b",
  nivelador: "#5c616b",
  marcaPatio: "#3d3d3d",
};
