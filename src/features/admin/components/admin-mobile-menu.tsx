"use client";

import { LookLogo } from "@/components/brand/look-logo";
import { AdminNav } from "./admin-nav";
import { MobileDrawer } from "./mobile-drawer";

export function AdminMobileMenu({ pendingCount, email }: { pendingCount: number; email: string }) {
  return (
    <MobileDrawer>
      <div className="flex h-full flex-col">
          <div className="mb-6 px-2">
            <LookLogo width={96} />
            <p className="mt-2 text-xs font-semibold text-text-3">Portal Look · Painel</p>
          </div>
          <AdminNav pendingCount={pendingCount} />
          <p className="mt-auto truncate px-2 pt-6 text-xs text-text-3">{email}</p>
        </div>
    </MobileDrawer>
  );
}
