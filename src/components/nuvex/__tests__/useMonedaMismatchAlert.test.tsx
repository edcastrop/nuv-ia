import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMonedaMismatchAlert } from "../MonedaMismatchDialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type HookHandle = ReturnType<typeof useMonedaMismatchAlert>;

function Harness({ onReady }: { onReady: (h: HookHandle) => void }) {
  const h = useMonedaMismatchAlert();
  onReady(h);
  return h.dialog;
}

function mount() {
  let handle!: HookHandle;
  const utils = render(
    <Harness
      onReady={(h) => {
        handle = h;
      }}
    />,
  );
  return {
    ...utils,
    getHandle: () => handle,
  };
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("useMonedaMismatchAlert", () => {
  it("eleva únicamente el diálogo de moneda por encima del lector OCR", async () => {
    const { getHandle } = mount();
    await act(async () => {
      void getHandle().confirm({ detectada: "pesos", simulador: "uvr" });
    });

    expect(await screen.findByRole("alertdialog")).toHaveClass("z-[120]");
    expect(document.querySelector('[data-state="open"].fixed.inset-0')).toHaveClass("z-[120]");
  });

  it("conserva z-50 por defecto en los demás AlertDialog", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Diálogo normal</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByRole("alertdialog")).toHaveClass("z-50");
    expect(document.querySelector('[data-state="open"].fixed.inset-0')).toHaveClass("z-50");
  });

  it("resuelve true al aceptar ('Aplicar de todos modos')", async () => {
    const user = userEvent.setup();
    const { getHandle } = mount();

    let promise!: Promise<boolean>;
    await act(async () => {
      promise = getHandle().confirm({ detectada: "uvr", simulador: "pesos" });
    });

    const applyBtn = await screen.findByRole("button", { name: /aplicar de todos modos/i });
    await user.click(applyBtn);

    await expect(promise).resolves.toBe(true);
  });

  it("resuelve false al cancelar ('Cancelar carga')", async () => {
    const user = userEvent.setup();
    const { getHandle } = mount();

    let promise!: Promise<boolean>;
    await act(async () => {
      promise = getHandle().confirm({ detectada: "uvr", simulador: "pesos" });
    });

    const cancelBtn = await screen.findByRole("button", { name: /cancelar carga/i });
    await user.click(cancelBtn);

    await expect(promise).resolves.toBe(false);
  });

  it.each([
    ["botón X", async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: /cerrar/i }))],
    ["Escape/onOpenChange", async (user: ReturnType<typeof userEvent.setup>) =>
      user.keyboard("{Escape}")],
  ])("resuelve false una sola vez mediante %s", async (_label, close) => {
    const user = userEvent.setup();
    const { getHandle } = mount();
    let promise!: Promise<boolean>;
    await act(async () => {
      promise = getHandle().confirm({ detectada: "pesos", simulador: "uvr" });
    });
    const resolved = vi.fn();
    void promise.then(resolved);

    await close(user);
    await expect(promise).resolves.toBe(false);
    await flush();
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it("dos confirmaciones consecutivas: la primera resuelve false, la segunda queda vigente y resuelve normal", async () => {
    const user = userEvent.setup();
    const { getHandle } = mount();

    let p1!: Promise<boolean>;
    let p2!: Promise<boolean>;

    await act(async () => {
      p1 = getHandle().confirm({ detectada: "uvr", simulador: "pesos" });
    });
    await act(async () => {
      p2 = getHandle().confirm({ detectada: "uvr", simulador: "pesos" });
    });

    // p1 debe resolver false de inmediato al llegar la segunda confirmación.
    await expect(p1).resolves.toBe(false);

    // p2 sigue pendiente hasta que el usuario interactúa.
    const applyBtn = await screen.findByRole("button", { name: /aplicar de todos modos/i });
    await user.click(applyBtn);

    await expect(p2).resolves.toBe(true);
  });

  it("desmontaje con promesa pendiente → resuelve false", async () => {
    const { getHandle, unmount } = mount();

    let promise!: Promise<boolean>;
    await act(async () => {
      promise = getHandle().confirm({ detectada: "uvr", simulador: "pesos" });
    });

    unmount();

    await expect(promise).resolves.toBe(false);
  });

  it("no resuelve dos veces la misma promesa (aceptar y luego intentar cerrar no re-dispara)", async () => {
    const user = userEvent.setup();
    const { getHandle } = mount();

    let promise!: Promise<boolean>;
    await act(async () => {
      promise = getHandle().confirm({ detectada: "uvr", simulador: "pesos" });
    });

    let resolvedCount = 0;
    let resolvedValue: boolean | undefined;
    promise.then((v) => {
      resolvedCount += 1;
      resolvedValue = v;
    });

    const applyBtn = await screen.findByRole("button", { name: /aplicar de todos modos/i });
    await user.click(applyBtn);
    await flush();

    // Intento de "segunda resolución": cerrar overlay presionando Escape.
    await user.keyboard("{Escape}");
    await flush();

    expect(resolvedCount).toBe(1);
    expect(resolvedValue).toBe(true);
  });
});
