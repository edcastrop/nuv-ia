// Modelo + helpers para intervinientes (Titular/Cotitular o Locatario/Colocatario)
// y para Beneficio de Cobertura. NO modifica fórmulas financieras: solo se
// muestra, guarda y exporta.

export type RolTitular = "Titular" | "Locatario";
export type RolCotitular = "Cotitular" | "Colocatario";
export type RolInterviniente = RolTitular | RolCotitular;

export interface Interviniente {
  rol: RolInterviniente;
  nombreCompleto: string;
  cedula: string;
  lugarExpedicionCedula: string;
  direccion: string;
}

export interface Cobertura {
  activo: boolean;
  valorCobertura: string;
  tasaCobertura: string;
}

export function isLeasing(producto?: string | null): boolean {
  return !!producto && /leasing\s+habitacional/i.test(producto);
}

export function tieneCobertura(producto?: string | null): boolean {
  return !!producto && /con\s+beneficio\s+de\s+cobertura/i.test(producto);
}

export function rolTitular(producto?: string | null): RolTitular {
  return isLeasing(producto) ? "Locatario" : "Titular";
}

export function rolCotitular(producto?: string | null): RolCotitular {
  return isLeasing(producto) ? "Colocatario" : "Cotitular";
}

export function defaultInterviniente(rol: RolInterviniente): Interviniente {
  return {
    rol,
    nombreCompleto: "",
    cedula: "",
    lugarExpedicionCedula: "",
    direccion: "",
  };
}

export function defaultIntervinientes(producto?: string | null): Interviniente[] {
  return [defaultInterviniente(rolTitular(producto))];
}

export const defaultCobertura: Cobertura = {
  activo: false,
  valorCobertura: "",
  tasaCobertura: "",
};

/** Reasigna roles según el producto actual (al cambiar entre hipotecario/leasing). */
export function reasignarRoles(list: Interviniente[], producto?: string | null): Interviniente[] {
  const t = rolTitular(producto);
  const c = rolCotitular(producto);
  return list.map((i, idx) => ({ ...i, rol: idx === 0 ? t : c }));
}
