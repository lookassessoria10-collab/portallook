import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/features/auth/session";
import { requireImport, uploadLimits } from "@/features/uploads/service";
import { logError } from "@/lib/errors";
import { isValidId } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * Upload direto navegador → Vercel Blob (privado) para arquivos grandes,
 * sem passar pelo limite de 4,5 MB da função. O token só é emitido para o
 * caminho de staging exato de uma importação aguardando arquivo.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!(await getSession())) throw new Error("unauthorized");
        const importId = clientPayload ?? "";
        if (!isValidId(importId, "im")) throw new Error("invalid import");
        const record = await requireImport(importId);
        if (record.status !== "awaiting_file" || pathname !== record.stagingPath) throw new Error("invalid pathname");
        return {
          allowedContentTypes: [record.contentType, "application/octet-stream"],
          maximumSizeInBytes: uploadLimits().maxBytes,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: importId,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    logError("upload:blob-token", e);
    return Response.json({ error: "Não foi possível autorizar o envio do arquivo." }, { status: 400 });
  }
}
