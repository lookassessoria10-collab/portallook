import { describe, expect, it } from "vitest";
import { ACCESS_TOKEN_PATTERN, decryptToken, encryptToken, generateAccessToken, hashAccessToken, tokenHint, verifyAccessToken } from "@/lib/crypto/tokens";
import { hashPassword, verifyPassword } from "@/features/auth/password";
import { signSession, verifySession } from "@/features/auth/session-token";

describe("token de acesso do cliente", () => {
  it("é aleatório, não sequencial e com 256 bits", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateAccessToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(ACCESS_TOKEN_PATTERN);
  });

  it("valida o token correto e rejeita qualquer alteração", () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);
    expect(verifyAccessToken(token, hash)).toBe(true);
    const tampered = (token[0] === "A" ? "B" : "A") + token.slice(1);
    expect(verifyAccessToken(tampered, hash)).toBe(false);
    expect(verifyAccessToken(generateAccessToken(), hash)).toBe(false);
    expect(verifyAccessToken("curto", hash)).toBe(false);
    expect(verifyAccessToken(token, "nao-e-hash")).toBe(false);
  });

  it("guarda o token cifrado (recuperável só com o segredo) e com dica curta", () => {
    const token = generateAccessToken();
    const enc = encryptToken(token);
    expect(enc).not.toContain(token);
    expect(decryptToken(enc)).toBe(token);
    expect(decryptToken(enc.slice(0, -2) + "xx")).toBeNull();
    expect(tokenHint(token)).toHaveLength(4);
  });
});

describe("autenticação do ADM", () => {
  it("hash de senha scrypt sem '$' (compatível com .env do Next)", async () => {
    const hash = await hashPassword("senha-muito-forte");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(hash).not.toContain("$");
    expect(await verifyPassword("senha-muito-forte", hash)).toBe(true);
    expect(await verifyPassword("senha-errada-123", hash)).toBe(false);
    expect(await verifyPassword("x", "formato-invalido")).toBe(false);
  });

  it("rejeita senha curta", async () => {
    await expect(hashPassword("curta")).rejects.toThrow();
  });

  it("sessão assinada expira e não aceita outro segredo", async () => {
    const secret = "s".repeat(40);
    const { token } = await signSession("adm@look.test", secret, 1);
    expect((await verifySession(token, secret))?.email).toBe("adm@look.test");
    expect(await verifySession(token, "x".repeat(40))).toBeNull();
    expect(await verifySession(token.slice(0, -3) + "abc", secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
    expect(await verifySession(token, "curto")).toBeNull();
  });
});
