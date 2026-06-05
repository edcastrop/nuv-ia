import { useMemo } from "react";
import { useProductosBancarios, type ModalidadCat, type ProductoBancario } from "@/lib/productosBancarios";

interface Props {
  banco: string;
  producto: string; // nombre_comercial
  onChange: (next: { banco: string; producto: string; productoId: string | null }) => void;
  /** Si se pasa, restringe el catálogo a una sola moneda (simulador en Pesos vs UVR). */
  filtrarPorModalidad?: ModalidadCat;
  className?: string;
}

export function ProductoBancarioSelect({ banco, producto, onChange, filtrarPorModalidad, className }: Props) {
  const { data: catalogo = [], isLoading } = useProductosBancarios();

  const productosFiltrados = useMemo(() => {
    return catalogo.filter((p) => {
      if (filtrarPorModalidad && p.modalidad !== filtrarPorModalidad) return false;
      return true;
    });
  }, [catalogo, filtrarPorModalidad]);

  const bancos = useMemo(() => {
    const set = new Set<string>();
    productosFiltrados.forEach((p) => set.add(p.banco));
    return Array.from(set).sort();
  }, [productosFiltrados]);

  // Resolver banco contra el catálogo case-insensitive. Si el expediente
  // guardó un valor legacy ("DAVIVIENDA") evitamos que el <select> caiga
  // silenciosamente al primer item alfabético ("AV Villas") y muestre un
  // banco que no corresponde al caso real.
  const bancoCanonico = useMemo(() => {
    if (!banco) return "";
    const exact = bancos.find((b) => b === banco);
    if (exact) return exact;
    const ci = bancos.find((b) => b.toLowerCase() === banco.toLowerCase());
    return ci ?? banco;
  }, [banco, bancos]);
  const bancoEsLegacy = !!bancoCanonico && !bancos.includes(bancoCanonico);

  const productosDelBanco = useMemo(
    () =>
      productosFiltrados
        .filter((p) => p.banco.toLowerCase() === bancoCanonico.toLowerCase())
        .sort((a, b) => a.orden - b.orden),
    [productosFiltrados, bancoCanonico],
  );

  const handleBanco = (b: string) => {
    onChange({ banco: b, producto: "", productoId: null });
  };

  const handleProducto = (nombre: string) => {
    const found: ProductoBancario | undefined = productosDelBanco.find((p) => p.nombre_comercial === nombre);
    onChange({ banco: bancoCanonico, producto: nombre, productoId: found?.id ?? null });
  };

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${className ?? ""}`}>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-[#242424]/70 uppercase">Banco</span>
        <select
          value={bancoCanonico}
          onChange={(e) => handleBanco(e.target.value)}
          disabled={isLoading}
          className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2.5 text-sm text-[#242424] outline-none transition-all focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15"
        >
          <option value="" disabled>{isLoading ? "Cargando…" : "Seleccione…"}</option>
          {bancos.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
          {bancoEsLegacy && (
            <option value={bancoCanonico}>{bancoCanonico} (legacy)</option>
          )}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-[#242424]/70 uppercase">Tipo de producto</span>
        <select
          value={producto}
          onChange={(e) => handleProducto(e.target.value)}
          disabled={!banco || isLoading}
          className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2.5 text-sm text-[#242424] outline-none transition-all focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15 disabled:bg-[#F7F9FB]"
        >
          <option value="" disabled>{banco ? "Seleccione producto…" : "Primero elija un banco"}</option>
          {productosDelBanco.map((p) => (
            <option key={p.id} value={p.nombre_comercial}>{p.nombre_comercial}</option>
          ))}
          {producto && !productosDelBanco.some((p) => p.nombre_comercial === producto) && (
            <option value={producto}>{producto} (legacy)</option>
          )}
        </select>
      </label>
    </div>
  );
}
