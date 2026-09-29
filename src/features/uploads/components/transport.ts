"use client";

import type { InitImportResult } from "@/features/uploads/service";

/**
 * Envia o arquivo com progresso. Arquivos pequenos passam pelo servidor;
 * grandes vão direto para o Vercel Blob privado (token de uso único).
 */
export async function sendFile(init: InitImportResult, file: File, onProgress: (pct: number) => void): Promise<void> {
  if (init.strategy === "blob") {
    const { upload } = await import("@vercel/blob/client");
    await upload(init.pathname, file, {
      access: "private",
      handleUploadUrl: "/api/adm/uploads/blob",
      clientPayload: init.importId,
      multipart: file.size > 20 * 1024 * 1024,
      contentType: file.type || "application/octet-stream",
      onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
    });
    onProgress(100);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/adm/uploads/${init.importId}/file`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let message = "Não foi possível enviar o arquivo. Tente novamente.";
      try {
        const body = JSON.parse(xhr.responseText) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // resposta não-JSON: mantém a mensagem padrão
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("A conexão caiu durante o envio. Verifique a internet e tente novamente."));
    xhr.send(file);
  });
}
