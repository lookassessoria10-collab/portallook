import { ExternalLink, Sheet } from "lucide-react";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/dates/period";
import { formatInteger } from "@/lib/format/number";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { describeMonths, getSocialSheetState, socialSheetEnabled, socialSheetUrl } from "@/features/social/sheet-sync";
import { SheetSyncButton } from "./sheet-sync-button";

const value = (v: number | null) => (v === null ? "—" : formatInteger(v));

/** ADM · Rede social: de onde vêm os meses novos (planilha Google) e o que a última leitura encontrou. */
export async function SheetSyncCard({ clientId, moduleEnabled }: { clientId: string; moduleEnabled: boolean }) {
  const header = <CardHeader title="Planilha Google" subtitle="Meses novos entram sozinhos no portal" icon={<Sheet className="size-4" />} />;
  if (!socialSheetEnabled()) {
    return (
      <Card>
        {header}
        <CardBody>
          <p className="text-[13px] leading-relaxed text-text-2">A leitura da planilha está desligada (SOCIAL_SHEET_SYNC=off). Os meses entram só pelo upload.</p>
        </CardBody>
      </Card>
    );
  }
  const state = await getSocialSheetState();
  const tz = env().APP_TIMEZONE;
  const mine = state.sheetId === env().SOCIAL_SHEET_ID ? (state.clients[clientId] ?? null) : null;
  const recent = mine?.created.slice(-6).reverse() ?? [];
  const swapped = mine?.replaced.slice(-6).reverse() ?? [];
  return (
    <Card>
      {header}
      <CardBody className="space-y-3">
        <p className="text-[13px] leading-relaxed text-text-2">
          A cada 10 minutos (quando alguém abre o portal) a aba do cliente na planilha de análise de dados é lida. Os meses encerrados que ainda não estão no portal são publicados na hora. Meses já publicados só mudam no “Sincronizar agora”, que troca os que mudaram na planilha (a versão anterior fica no histórico).
        </p>
        {!moduleEnabled ? <p className="text-xs text-text-3">A Rede social está desativada para este cliente: a planilha não é lida para ele.</p> : null}
        <dl className="grid gap-1 text-xs text-text-3">
          <div>
            <dt className="inline font-semibold text-text-2">Última leitura: </dt>
            <dd className="inline">{state.checkedAt ? formatDateTime(state.checkedAt, tz) : "ainda não lida"}</dd>
          </div>
          {mine?.sheets.length ? (
            <div>
              <dt className="inline font-semibold text-text-2">Aba: </dt>
              <dd className="inline">{mine.sheets.join(", ")}</dd>
            </div>
          ) : null}
          {mine?.months.length ? (
            <div>
              <dt className="inline font-semibold text-text-2">Meses na planilha: </dt>
              <dd className="inline">{mine.months.length}</dd>
            </div>
          ) : null}
        </dl>
        {state.error ? <p className="rounded-[10px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
        {mine?.problem ? <p className="rounded-[10px] bg-attention-soft px-3 py-2 text-[13px] text-attention">{mine.problem}</p> : null}
        {recent.length ? (
          <div className="text-xs text-text-3">
            <p className="font-semibold text-text-2">Publicados pela planilha</p>
            <ul className="mt-1 space-y-0.5">
              {recent.map((c) => (
                <li key={c.reportId}>
                  {describeMonths([c.periodKey])} · {formatDateTime(c.at, tz)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {swapped.length ? (
          <div className="text-xs text-text-3">
            <p className="font-semibold text-text-2">Atualizados pela planilha</p>
            <ul className="mt-1 space-y-0.5">
              {swapped.map((c) => (
                <li key={c.reportId}>
                  {describeMonths([c.periodKey])} · {formatDateTime(c.at, tz)}
                  {c.fields.length ? ` · ${c.fields.map((f) => `${f.label} ${value(f.portal)} → ${value(f.sheet)}`).join("; ")}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {mine?.divergent.length ? (
          <details className="text-xs text-text-3">
            <summary className="cursor-pointer font-semibold text-text-2">Diferenças com o que está publicado ({mine.divergent.length})</summary>
            <p className="mt-1">O portal mantém o valor publicado até alguém clicar em “Sincronizar agora”. Meses em rascunho, retirados ou arquivados não são trocados pela planilha.</p>
            <ul className="mt-1 space-y-1">
              {mine.divergent.map((d) => (
                <li key={d.periodKey}>
                  <span className="font-semibold text-text-2">{describeMonths([d.periodKey])}:</span>{" "}
                  {d.fields.map((f) => `${f.label} ${value(f.portal)} no portal × ${value(f.sheet)} na planilha`).join("; ")}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <SheetSyncButton clientId={clientId} />
          <a href={socialSheetUrl()} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
            <ExternalLink className="size-4" aria-hidden /> Abrir planilha
          </a>
        </div>
      </CardBody>
    </Card>
  );
}
