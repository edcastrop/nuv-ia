import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

const NUVIA_STABILITY_SCRIPT = `
(() => {
  if (window.__nuviaStabilityInstalled) return;
  window.__nuviaStabilityInstalled = true;
  const importFailure = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|vite:preloadError/i;
  const isImportFailure = (reason) => importFailure.test(String((reason && (reason.message || reason.stack)) || reason || ""));
  const showNotice = () => {
    if (document.getElementById("nuvia-stability-notice")) return;
    const el = document.createElement("div");
    el.id = "nuvia-stability-notice";
    el.setAttribute("role", "status");
    el.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);max-width:calc(100vw - 32px);border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(5,8,22,.94);color:#e5edf9;padding:10px 16px;font:600 12px/1.3 system-ui,-apple-system,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.28);backdrop-filter:blur(16px)";
    el.textContent = "Reconectando NUVIA sin perder la pantalla actual…";
    document.body.appendChild(el);
  };
  const recover = (event, reason) => {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (!isImportFailure(reason || event)) return;
    showNotice();
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      fetch(window.location.href, { method: "HEAD", cache: "no-store" })
        .then((response) => {
          if (response.ok || response.status < 500) window.location.reload();
          else if (attempts < 24) window.setTimeout(retry, 1250);
        })
        .catch(() => {
          if (attempts < 24) window.setTimeout(retry, 1250);
        });
    };
    window.setTimeout(retry, 750);
  };
  window.addEventListener("vite:preloadError", (event) => recover(event, event && event.payload));
  window.addEventListener("unhandledrejection", (event) => {
    if (isImportFailure(event.reason)) recover(event, event.reason);
  });
  window.addEventListener("error", (event) => {
    const reason = event.error || event.message;
    if (isImportFailure(reason)) recover(event, reason);
  }, true);
})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NUVEX — Finanzas Inteligentes" },
      { name: "description", content: "NUVEX — Plataforma profesional de finanzas inteligentes para optimización de créditos en pesos y UVR." },
      { name: "author", content: "NUVEX" },
      { property: "og:title", content: "NUVEX — Finanzas Inteligentes" },
      { property: "og:description", content: "Plataforma profesional NUVEX para optimización de créditos." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "NUVEX" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "NUVEX — Finanzas Inteligentes" },
      { name: "twitter:description", content: "Plataforma profesional NUVEX para optimización de créditos." },
      { name: "theme-color", content: "#0a1628" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "NUVEX" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body style={{ background: "#F4F6FB", color: "#0A1226" }}>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: NUVIA_STABILITY_SCRIPT }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
