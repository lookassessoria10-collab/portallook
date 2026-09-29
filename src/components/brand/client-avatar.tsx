import { cn } from "@/lib/cn";

function initials(name: string): string {
  const words = name
    .replace(/^(dra?\.?|dr\.?)\s+/i, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^(de|da|do|dos|das|e)$/i.test(w));
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

/** Logo do cliente quando existe; senão, iniciais sobre fundo neutro. */
export function ClientAvatar({ name, logoUrl, size = 40, className }: { name: string; logoUrl?: string | null; size?: number; className?: string }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- servido por rota autenticada, sem otimização de imagem
      <img
        src={logoUrl}
        alt={`Logo de ${name}`}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-border-strong bg-white object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full border border-[rgb(0_174_239/0.3)] bg-primary-soft font-bold text-primary", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}
