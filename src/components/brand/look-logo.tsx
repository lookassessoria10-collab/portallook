import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Assinatura institucional. Arquivos derivados da marca original sem alterar o
 * desenho: versão branca (fundo escuro) e colorida. `wordmark` omite a linha
 * "Assessoria de Comunicação" em tamanhos onde ela ficaria ilegível.
 */
export function LookLogo({
  variant = "white",
  wordmark = false,
  width = 96,
  className,
  priority,
}: {
  variant?: "white" | "color";
  wordmark?: boolean;
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  const src = wordmark
    ? variant === "white"
      ? "/brand/look-wordmark-white.png"
      : "/brand/look-wordmark-color.png"
    : variant === "white"
      ? "/brand/look-white.png"
      : "/brand/look-color-on-dark.png";
  const ratio = wordmark ? 306 / 800 : 387 / 800;
  return (
    <Image
      src={src}
      alt="Look Assessoria de Comunicação"
      width={width}
      height={Math.round(width * ratio)}
      className={cn("h-auto select-none", className)}
      priority={priority}
      unoptimized
    />
  );
}
