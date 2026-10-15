import { getSession } from "@/features/auth/session";
import { clientCommercialWorkbook } from "@/features/commercial/live/templates";
import {
  profileNames,
  type CommercialProfile,
} from "@/features/commercial/live/profiles";
import { workbookBuffer } from "@/features/uploads/templates";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  if (!(await getSession()))
    return new Response("Sessão expirada.", { status: 401 });
  const { profile } = await params;
  if (!Object.hasOwn(profileNames, profile))
    return new Response("Modelo não encontrado.", { status: 404 });
  const body = workbookBuffer(
    clientCommercialWorkbook(profile as CommercialProfile),
  );
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="modelo-comercial-${profile}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
