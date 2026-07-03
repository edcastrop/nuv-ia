import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SimuladorPage } from "./simulador";

const searchSchema = z.object({
  maestroId: z.string().optional(),
  modo: z.enum(["pesos", "uvr"]).optional(),
  auditoriaId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/herramientas/simulador")({
  component: SimuladorPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Simulador NUVEX (exploración) · Herramientas" },
      {
        name: "description",
        content:
          "Simulador de crédito en modo exploración. Nada se guarda en el ERP hasta que decidas convertirlo en caso.",
      },
    ],
  }),
});
