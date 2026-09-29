"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ background: "#060e1c", color: "#eaf1fa", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20 }}>O Portal Look está indisponível no momento</h1>
          <p style={{ color: "#a7b6cb", fontSize: 14 }}>Tente novamente em alguns instantes.</p>
          <button onClick={reset} style={{ marginTop: 16, height: 40, padding: "0 16px", borderRadius: 10, border: 0, background: "#22b5f2", color: "#041322", fontWeight: 700, cursor: "pointer" }}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
