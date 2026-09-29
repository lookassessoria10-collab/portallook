import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/session";
import { listClientOverviews } from "@/features/clients/service";
import { AdminShell } from "@/features/admin/components/admin-shell";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel Look" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/adm">) {
  const session = await requireAdmin();
  const overviews = await listClientOverviews();
  const pending = overviews
    .filter((o) => o.client.status === "active")
    .reduce((n, o) => n + (["pending", "error"].includes(o.delivery.commercial.state) ? 1 : 0) + (["pending", "error"].includes(o.delivery.traffic.state) ? 1 : 0), 0);
  return (
    <AdminShell email={session.email} pendingCount={pending}>
      {children}
    </AdminShell>
  );
}
