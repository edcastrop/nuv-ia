import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * NUVIA Toaster — superficie oscura glassmorphism alineada con el shell.
 * No introduce hex hardcodeados: consume tokens vía CSS variables.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          // CSS vars consumidas por sonner (--normal-bg / --normal-text / --normal-border)
          "--normal-bg": "var(--nuvia-bg-card)",
          "--normal-text": "var(--nuvia-text-primary)",
          "--normal-border": "var(--nuvia-border)",
          "--success-bg": "var(--nuvia-bg-card)",
          "--success-text": "var(--nuvia-accent-green)",
          "--success-border": "var(--nuvia-border)",
          "--error-bg": "var(--nuvia-bg-card)",
          "--error-text": "var(--nuvia-danger)",
          "--error-border": "var(--nuvia-border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:backdrop-blur-xl group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[color:var(--nuvia-text-secondary)]",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-[color:var(--nuvia-bg-tertiary)] group-[.toast]:text-[color:var(--nuvia-text-secondary)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
