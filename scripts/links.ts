/**
 * Lista os links exclusivos atuais dos clientes (útil em desenvolvimento).
 *   npm run links
 */
import { getPortalLink } from "@/features/clients/access";
import { getRepositories } from "@/server/repositories";

async function main() {
  const clients = await getRepositories().clients.list();
  for (const c of clients) {
    const { url, access } = await getPortalLink(c);
    const state = !access?.enabled ? " (acesso desativado)" : !url ? " (sem link ativo)" : "";
    console.log(`${c.name.padEnd(28)} ${url ?? "—"}${state}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
