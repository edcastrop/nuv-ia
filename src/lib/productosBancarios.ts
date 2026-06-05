// Catálogo jerárquico de productos bancarios NUVEX.
// Reemplaza la lista plana PRODUCTOS_PESOS/PRODUCTOS_UVR de constants.ts.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoProductoCat = "credito_hipotecario" | "leasing_habitacional";
export type ModalidadCat = "pesos" | "uvr";
export type SubmodalidadUVR = "baja" | "media" | "alta" | null;

export interface ProductoBancario {
  id: string;
  banco: string;
  tipo_producto: TipoProductoCat;
  modalidad: ModalidadCat;
  submodalidad_uvr: SubmodalidadUVR;
  cobertura: boolean;
  nombre_comercial: string;
  codigo: string;
  activo: boolean;
  orden: number;
}

export interface ParsedProducto {
  esLeasing: boolean;
  esUVR: boolean;
  cobertura: boolean;
  submodalidadUVR: SubmodalidadUVR;
  tipo: TipoProductoCat;
  modalidad: ModalidadCat;
}

/** Parsea por nombre comercial cuando no se tiene el producto del catálogo a mano. */
export function parseProductoComercial(nombre?: string | null): ParsedProducto {
  const n = (nombre ?? "").toLowerCase();
  const esLeasing = /leasing(\s+habitacional)?|contrato\s+leasing/.test(n);
  const esUVR = /\buvr\b/.test(n);
  const cobertura = /con\s+beneficio\s+de\s+cobertura/.test(n);
  let submodalidadUVR: SubmodalidadUVR = null;
  if (esUVR) {
    if (/uvr\s+baja/.test(n)) submodalidadUVR = "baja";
    else if (/uvr\s+media/.test(n)) submodalidadUVR = "media";
    else if (/uvr\s+alta/.test(n)) submodalidadUVR = "alta";
  }
  return {
    esLeasing,
    esUVR,
    cobertura,
    submodalidadUVR,
    tipo: esLeasing ? "leasing_habitacional" : "credito_hipotecario",
    modalidad: esUVR ? "uvr" : "pesos",
  };
}

export function useProductosBancarios() {
  return useQuery({
    queryKey: ["productos_bancarios"],
    queryFn: async (): Promise<ProductoBancario[]> => {
      const { data, error } = await supabase
        .from("productos_bancarios" as never)
        .select("*")
        .eq("activo", true)
        .order("banco")
        .order("orden");
      if (error) throw error;
      return (data ?? []) as ProductoBancario[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Mapea la salida del motor OCR al nombre comercial del catálogo. */
export function buscarProductoComercial(
  productos: ProductoBancario[],
  filtros: {
    banco?: string | null;
    esLeasing?: boolean;
    esUVR?: boolean;
    cobertura?: boolean;
    submodalidadUVR?: SubmodalidadUVR;
  },
): ProductoBancario | null {
  const { banco, esLeasing, esUVR, cobertura, submodalidadUVR } = filtros;
  const cand = productos.filter((p) => {
    if (banco && p.banco.toLowerCase() !== banco.toLowerCase()) return false;
    if (typeof esLeasing === "boolean") {
      const isL = p.tipo_producto === "leasing_habitacional";
      if (isL !== esLeasing) return false;
    }
    if (typeof esUVR === "boolean") {
      const isU = p.modalidad === "uvr";
      if (isU !== esUVR) return false;
    }
    if (typeof cobertura === "boolean" && p.cobertura !== cobertura) return false;
    if (submodalidadUVR !== undefined) {
      if ((p.submodalidad_uvr ?? null) !== submodalidadUVR) return false;
    }
    return true;
  });
  return cand[0] ?? null;
}
