/**
 * Cria um .env.local para desenvolvimento com segredos aleatórios.
 *   npm run setup
 * Não sobrescreve um .env.local existente.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { hashPassword } from "@/features/auth/password";

async function main() {
  const file = ".env.local";
  if (existsSync(file)) {
    console.log(".env.local já existe — nada foi alterado.");
    return;
  }
  const password = randomBytes(9).toString("base64url");
  const email = "admin@look.test";
  const hash = await hashPassword(password);
  const content = `# Gerado por "npm run setup" — apenas para desenvolvimento local.
# Credenciais de desenvolvimento do painel (/adm/login):
#   e-mail: ${email}
#   senha:  ${password}
# Para trocar a senha: npm run hash-password -- "nova senha" e substitua ADMIN_PASSWORD_HASH.

STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=.data
ADMIN_EMAIL=${email}
ADMIN_PASSWORD_HASH=${hash}
SESSION_SECRET=${randomBytes(32).toString("base64url")}
PORTAL_TOKEN_SECRET=${randomBytes(32).toString("base64url")}
PUBLIC_BASE_URL=http://localhost:3000
`;
  writeFileSync(file, content, { encoding: "utf8" });
  console.log(`.env.local criado. As credenciais de desenvolvimento estão no topo do arquivo.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
