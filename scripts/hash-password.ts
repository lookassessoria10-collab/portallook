/**
 * Gera o valor de ADMIN_PASSWORD_HASH.
 *   npm run hash-password -- "minha senha forte"
 */
import { hashPassword } from "@/features/auth/password";

const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash-password -- "sua senha"');
  process.exit(1);
}
hashPassword(password)
  .then((hash) => console.log(`ADMIN_PASSWORD_HASH=${hash}`))
  .catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
