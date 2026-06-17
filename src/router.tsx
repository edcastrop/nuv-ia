import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB] px-4 text-[#0A1226]">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">NUVIA no pudo cargar esta vista</h1>
        <p className="mt-2 text-sm text-slate-600">
          La sesión sigue activa. Reintenta la vista o vuelve al inicio sin perder el trabajo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-[#445DA3] px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
          <a
            href="/inicio"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: false,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
