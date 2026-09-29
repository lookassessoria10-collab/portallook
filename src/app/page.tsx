import { redirect } from "next/navigation";

/** A raiz não expõe nada: clientes entram pelo link exclusivo; a equipe, pelo /adm. */
export default function Home() {
  redirect("/adm");
}
