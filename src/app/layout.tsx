import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

/** Serifa de destaque do painel comercial (o mês em foco). */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Portal Look",
    template: "%s · Portal Look",
  },
  description: "Relatórios e dashboards dos clientes da Look Assessoria de Comunicação.",
  applicationName: "Portal Look",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#060e1c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--surface-2)",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
              fontFamily: "var(--font-manrope)",
            },
          }}
        />
      </body>
    </html>
  );
}
