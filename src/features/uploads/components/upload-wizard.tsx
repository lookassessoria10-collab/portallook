"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, ClipboardPaste, Download, FileWarning, LoaderCircle, RotateCcw, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionButton } from "@/components/ui/confirm-action";
import { Badge } from "@/components/ui/badge";
import { ReportViewer } from "@/components/dashboard/report-viewer";
import { extensionOf } from "@/lib/parsers/sniff";
import { CSV_CONTENT_OPTIONS, UPLOAD_PLATFORM_OPTIONS, type CsvContent, type ImportRecord, type PreviewPeriod, type UploadPlatform } from "@/features/uploads/schema";
import { confirmImportAction, discardImportAction, initImportAction, processImportAction, publishImportAction } from "@/features/uploads/actions";
import { periodOptions } from "@/features/uploads/period-options";
import { UploadDropzone } from "./upload-dropzone";
import { ValidationList } from "./validation-list";
import { FormatGuide, pasteExample } from "./format-guide";
import { sendFile } from "./transport";

export interface WizardClient {
  id: string;
  name: string;
  modules: Record<"commercial" | "traffic", { enabled: boolean; cadence: "monthly" | "weekly"; allowOriginalDownload: boolean; expectedKey: string | null }>;
}

type ReportType = "commercial" | "traffic";

const STEPS = ["Cliente", "Tipo", "Período", "Arquivo", "Validação", "Prévia", "Confirmação", "Rascunho"] as const;
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const TYPE_LABEL: Record<ReportType, string> = { commercial: "Comercial", traffic: "Tráfego" };
const PLATFORM_SHORT: Record<UploadPlatform, string> = { meta_ads: "Meta Ads", google_ads: "Google Ads" };
const EXISTING_LABEL = { none: "Novo", draft: "Já existe rascunho", published: "Já publicado — criará nova versão", other: "Existe versão anterior" } as const;

export function UploadWizard({
  clients,
  today,
  maxMb,
  initial,
  resume,
}: {
  clients: WizardClient[];
  today: string;
  maxMb: number;
  initial?: { clientId?: string | null; type?: ReportType | null; periodKey?: string | null };
  resume?: ImportRecord | null;
}) {
  const firstClient = clients.find((c) => c.id === (resume?.clientId ?? initial?.clientId)) ?? null;
  const firstType: ReportType | null = resume?.reportType ?? (initial?.type && firstClient?.modules[initial.type].enabled ? initial.type : firstClient ? (["commercial", "traffic"] as const).find((t) => firstClient.modules[t].enabled) ?? null : null);

  const [step, setStep] = useState<Step>(resume ? (resume.status === "imported" ? 7 : 4) : firstClient && firstType ? (initial?.periodKey !== undefined && initial?.periodKey !== null ? 3 : 2) : firstClient ? 1 : 0);
  const [clientId, setClientId] = useState<string | null>(firstClient?.id ?? null);
  const [type, setType] = useState<ReportType | null>(firstType);
  const [periodKey, setPeriodKey] = useState<string>(resume?.requestedPeriod ? keyFromRecord(resume) : (initial?.periodKey ?? (firstClient && firstType ? (firstClient.modules[firstType].expectedKey ?? "") : "")));
  const [file, setFile] = useState<File | null>(null);
  /** Enviar um arquivo ou colar os dados (tabela Markdown ou células copiadas da planilha). */
  const [source, setSource] = useState<"file" | "paste">(resume?.format === "md" ? "paste" : "file");
  const [pasted, setPasted] = useState("");
  const [platform, setPlatform] = useState<UploadPlatform | "">(resume?.platform ?? "");
  /** Quantos relatórios o "Publicar todos" publicou (null = ainda não usado). */
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [csvContent, setCsvContent] = useState<CsvContent | "">(resume?.csvContent ?? "");
  const [dimensionLabel, setDimensionLabel] = useState(resume?.csvDimensionLabel ?? "");
  const [title, setTitle] = useState(resume?.title ?? "");
  const [allowDownload, setAllowDownload] = useState<boolean>(resume?.allowDownload ?? (firstClient && firstType ? firstClient.modules[firstType].allowOriginalDownload : false));
  const [progress, setProgress] = useState<number | null>(null);
  const [record, setRecord] = useState<ImportRecord | null>(resume ?? null);
  const [selected, setSelected] = useState<string[]>(resume?.preview?.suggestedPeriodKeys ?? []);
  /** Quando o arquivo tem outro período que o escolhido: qual usar (escolha obrigatória). */
  const [target, setTarget] = useState<"requested" | "file" | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "validating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Reabrir uma colagem que ainda não foi importada: o texto volta para o campo, para corrigir.
  useEffect(() => {
    if (resume?.format !== "md" || resume.status === "imported" || resume.status === "discarded") return;
    let active = true;
    fetch(`/api/adm/uploads/${resume.id}/file`)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        if (active && text) setPasted((current) => current || text);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [resume?.format, resume?.id, resume?.status]);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const mod = client && type ? client.modules[type] : null;
  const options = useMemo(() => (mod ? periodOptions(mod.cadence, today) : []), [mod, today]);
  const ext = source === "file" && file ? extensionOf(file.name) : "";
  const isCsv = ext === "csv";
  const isDocument = ext === "pdf" || ext === "html" || ext === "htm";
  const csvOptions = CSV_CONTENT_OPTIONS.filter((o) => o.reportType === type);

  const selectClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    setClientId(id);
    const t = c ? ((type && c.modules[type].enabled ? type : null) ?? (["commercial", "traffic"] as const).find((m) => c.modules[m].enabled) ?? null) : null;
    setType(t);
    if (c && t) {
      setPeriodKey(c.modules[t].expectedKey ?? "");
      setAllowDownload(c.modules[t].allowOriginalDownload);
    }
  };

  const selectType = (t: ReportType) => {
    setType(t);
    setCsvContent("");
    if (t !== "traffic") setPlatform("");
    if (client) {
      setPeriodKey(client.modules[t].expectedKey ?? "");
      setAllowDownload(client.modules[t].allowOriginalDownload);
    }
  };

  const reset = () => {
    setFile(null);
    setPublishedCount(null);
    setRecord(null);
    setSelected([]);
    setTarget(null);
    setProgress(null);
    setError(null);
    setPhase("idle");
    setStep(3);
  };

  const platformChoice = type === "traffic" && platform ? platform : null;
  const platformName = platformChoice ? PLATFORM_SHORT[platformChoice] : null;
  const unitWord = mod?.cadence === "weekly" ? "semana" : "mês";

  const submitFile = () => {
    if (!client || !type) return;
    setError(null);
    if (source === "paste" && !pasted.trim()) return setError("Cole os dados antes de continuar.");
    // Dados colados viram um arquivo .md e seguem o mesmo caminho de validação das planilhas.
    const upload = source === "paste" ? new File([pasted], `dados-colados${platformChoice ? `-${platformChoice === "meta_ads" ? "meta" : "google"}` : ""}.md`, { type: "text/markdown" }) : file;
    if (!upload) return;
    if (platformChoice && isDocument) return setError("O upload por plataforma aceita planilhas (XLSX, XLS, CSV) ou dados colados, não PDF/HTML.");
    if (ext === "pdf" && !periodKey) return setError("Para PDF, selecione o período no passo Período.");
    if (isCsv && !csvContent) return setError("Informe o tipo de conteúdo do CSV.");
    if (isCsv && csvContent === "dimension" && !dimensionLabel.trim()) return setError("Informe o nome da dimensão.");
    start(async () => {
      setPhase("uploading");
      setProgress(0);
      const init = await initImportAction({
        clientId: client.id,
        reportType: type,
        fileName: upload.name,
        size: upload.size,
        contentType: upload.type,
        csvContent: isCsv ? csvContent || null : null,
        csvDimensionLabel: isCsv && csvContent === "dimension" ? dimensionLabel : null,
        platform: platformChoice,
        periodKey: periodKey || null,
        title: title || null,
        allowDownload,
      });
      if (!init.ok) {
        setPhase("idle");
        setProgress(null);
        return setError(init.error);
      }
      try {
        await sendFile(init.data, upload, setProgress);
      } catch (e) {
        setPhase("idle");
        setProgress(null);
        await discardImportAction(init.data.importId);
        return setError(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
      }
      setPhase("validating");
      const processed = await processImportAction(init.data.importId);
      setPhase("idle");
      if (!processed.ok) return setError(processed.error);
      setRecord(processed.data);
      setSelected(processed.data.preview?.suggestedPeriodKeys ?? []);
      setTarget(null);
      setStep(4);
    });
  };

  const discard = () =>
    start(async () => {
      if (record) await discardImportAction(record.id);
      toast.success("Upload cancelado. Nada foi publicado.");
      reset();
    });

  const mismatch = record?.preview?.kind === "dataset" ? record.preview.periodMismatch : null;
  const filePeriod = mismatch ? (record?.preview?.periods[0] ?? null) : null;

  const confirm = () =>
    start(async () => {
      if (!record) return;
      const keys = record.preview?.kind === "document" ? record.preview.suggestedPeriodKeys : mismatch ? (target === "file" && filePeriod ? [filePeriod.periodKey] : []) : selected;
      const res = await confirmImportAction(record.id, keys, { useRequestedPeriod: Boolean(mismatch) && target === "requested" });
      if (!res.ok) return setError(res.error);
      setRecord(res.data);
      toast.success(res.message ?? "Rascunho criado.");
      setStep(7);
    });

  const hasErrors = record?.issues.some((i) => i.level === "error") ?? false;
  const importLabels = !record?.preview
    ? []
    : record.preview.kind === "document"
      ? record.preview.periods.map((p) => p.label)
      : mismatch
        ? [target === "requested" ? mismatch.requestedLabel : (filePeriod?.label ?? "")]
        : record.preview.periods.filter((p) => selected.includes(p.periodKey)).map((p) => p.label);
  const canGoTo = (s: Step) => s < step && s <= 3 && !record;

  return (
    <div className="space-y-6">
      <Stepper step={step} onGo={(s) => canGoTo(s) && setStep(s)} canGoTo={canGoTo} />

      <div className="card p-5 sm:p-7">
        {step === 0 ? (
          <StepFrame title="Para qual cliente é o relatório?" onNext={() => setStep(1)} nextDisabled={!clientId}>
            <Field label="Cliente" htmlFor="wiz-client">
              <Select id="wiz-client" value={clientId ?? ""} onChange={(e) => selectClient(e.target.value)}>
                <option value="" disabled>
                  Selecione…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </StepFrame>
        ) : null}

        {step === 1 && client ? (
          <StepFrame title="Qual o tipo de relatório?" onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!type}>
            <div role="radiogroup" aria-label="Tipo de relatório" className="grid gap-3 sm:grid-cols-2">
              {(["commercial", "traffic"] as const).map((t) => {
                const enabled = client.modules[t].enabled;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={type === t}
                    disabled={!enabled}
                    onClick={() => selectType(t)}
                    className={cn(
                      "rounded-[var(--radius-lg)] border p-4 text-left transition-colors disabled:opacity-40",
                      type === t ? "border-primary bg-primary-soft" : "border-border-strong hover:bg-surface-2",
                    )}
                  >
                    <span className="block font-bold text-text">{TYPE_LABEL[t]}</span>
                    <span className="mt-0.5 block text-[13px] text-text-3">
                      {enabled ? (client.modules[t].cadence === "weekly" ? "Entrega semanal" : "Entrega mensal") : "Módulo não contratado"}
                    </span>
                  </button>
                );
              })}
            </div>
          </StepFrame>
        ) : null}

        {step === 2 && mod ? (
          <StepFrame title="Qual o período?" description="Para planilhas, você pode deixar o sistema detectar os períodos pelo arquivo." onBack={() => setStep(1)} onNext={() => setStep(3)}>
            <Field label="Período" htmlFor="wiz-period" hint={mod.expectedKey ? "Sugerimos o período pendente mais recente." : undefined}>
              <Select id="wiz-period" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
                <option value="">Detectar pelos dados (planilha ou tabela colada)</option>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                    {o.key === mod.expectedKey ? " (pendente)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </StepFrame>
        ) : null}

        {step === 3 && mod && type ? (
          <StepFrame
            title={source === "paste" ? "Cole os dados" : "Envie o arquivo"}
            description={`${client?.name} · ${TYPE_LABEL[type]}${platformName ? ` · só ${platformName}` : ""} · ${periodKey ? (options.find((o) => o.key === periodKey)?.label ?? periodKey) : "período detectado pelos dados"}`}
            onBack={() => setStep(2)}
            nextLabel={phase === "uploading" ? `Enviando ${progress ?? 0}%` : phase === "validating" ? "Validando…" : "Enviar e validar"}
            onNext={submitFile}
            nextDisabled={(source === "paste" ? !pasted.trim() : !file) || pending}
            busy={pending}
          >
            <div className="space-y-5">
              <div role="radiogroup" aria-label="Como enviar os dados" className="grid grid-cols-2 gap-1 rounded-[12px] border border-border bg-surface-2 p-1 sm:w-[360px]">
                {(
                  [
                    { value: "file", label: "Enviar arquivo", icon: Upload },
                    { value: "paste", label: "Colar dados", icon: ClipboardPaste },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={source === o.value}
                    disabled={pending}
                    onClick={() => {
                      setSource(o.value);
                      setError(null);
                    }}
                    className={cn("flex h-9 items-center justify-center gap-2 rounded-[9px] text-sm font-bold transition-colors", source === o.value ? "bg-surface text-text shadow-sm" : "text-text-3 hover:text-text-2")}
                  >
                    <o.icon className="size-4" aria-hidden />
                    {o.label}
                  </button>
                ))}
              </div>

              {type === "traffic" ? (
                <Field
                  label="Plataforma"
                  htmlFor="wiz-platform"
                  hint={
                    platformChoice
                      ? `Pode trazer vários períodos de uma vez. Em cada ${unitWord}, só os dados de ${platformName} são substituídos; as outras plataformas que já estão no relatório são mantidas.`
                      : "Use quando o arquivo tem a coluna Plataforma (várias plataformas juntas)."
                  }
                >
                  <Select id="wiz-platform" value={platform} onChange={(e) => setPlatform(e.target.value as UploadPlatform | "")} disabled={pending}>
                    <option value="">Várias plataformas (coluna Plataforma)</option>
                    {UPLOAD_PLATFORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        Só {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              {source === "file" ? (
                <UploadDropzone file={file} onFile={(f) => {
                    setFile(f);
                    setError(null);
                    if (f && extensionOf(f.name) === "csv" && csvOptions.length === 1) setCsvContent(csvOptions[0].value);
                  }} disabled={pending} maxMb={maxMb} />
              ) : (
                <Field label="Dados" htmlFor="wiz-paste" hint="Cole a tabela aqui. Confira o formato esperado logo abaixo.">
                  <Textarea
                    id="wiz-paste"
                    value={pasted}
                    onChange={(e) => {
                      setPasted(e.target.value);
                      setError(null);
                    }}
                    disabled={pending}
                    rows={12}
                    spellCheck={false}
                    placeholder={pasteExample(type, mod.cadence, platformChoice)}
                    className="font-mono text-[13px] leading-relaxed"
                  />
                </Field>
              )}
              {source === "paste" || !isDocument ? (
                <FormatGuide
                  type={type}
                  cadence={mod.cadence}
                  platform={platformChoice}
                  source={source}
                  periodChosen={Boolean(periodKey)}
                  onUseExample={() => {
                    setPasted(pasteExample(type, mod.cadence, platformChoice));
                    setError(null);
                  }}
                />
              ) : null}
              {progress !== null ? (
                <div aria-live="polite">
                  <div className="h-2 overflow-hidden rounded-full bg-chart-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do envio">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-text-3">{phase === "validating" ? "Arquivo recebido. Lendo e validando os dados…" : `Enviando… ${progress}%`}</p>
                </div>
              ) : null}
              {isCsv ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Conteúdo do CSV" htmlFor="wiz-csv" hint="CSV não tem abas: diga o que este arquivo contém.">
                    <Select id="wiz-csv" value={csvContent} onChange={(e) => setCsvContent(e.target.value as CsvContent)}>
                      <option value="" disabled>
                        Selecione…
                      </option>
                      {csvOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {csvContent === "dimension" ? (
                    <Field label="Nome da dimensão" htmlFor="wiz-dim">
                      <Input id="wiz-dim" value={dimensionLabel} onChange={(e) => setDimensionLabel(e.target.value)} placeholder="Ex.: Serviços, Profissionais, Unidades" maxLength={60} />
                    </Field>
                  ) : null}
                </div>
              ) : null}
              {isDocument ? (
                <Field label="Título do documento" htmlFor="wiz-title" optional>
                  <Input id="wiz-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Relatório comercial completo — setembro" />
                </Field>
              ) : null}
              {source === "file" ? <Checkbox checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} label="Permitir que o cliente baixe o arquivo original" /> : null}
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-3">
                Modelos:
                <a className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href="/modelos/modelo-comercial.xlsx" download>
                  <Download className="size-3.5" aria-hidden /> Comercial (XLSX)
                </a>
                <a className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href="/modelos/modelo-trafego.xlsx" download>
                  <Download className="size-3.5" aria-hidden /> Tráfego (XLSX)
                </a>
                <a className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href="/modelos/exemplo-html-estruturado.html" download>
                  <Download className="size-3.5" aria-hidden /> HTML estruturado
                </a>
              </p>
            </div>
          </StepFrame>
        ) : null}

        {step === 4 && record ? (
          <StepFrame
            title={record.format === "md" ? (hasErrors ? "Encontramos problemas nos dados colados" : "Dados validados") : hasErrors ? "Encontramos problemas no arquivo" : "Arquivo validado"}
            description={record.format === "md" ? `Dados colados${record.platform ? ` · só ${PLATFORM_SHORT[record.platform]}` : ""}` : record.fileName}
            nextLabel={hasErrors ? undefined : "Ver prévia"}
            onNext={hasErrors ? undefined : () => setStep(5)}
            extra={
              <>
                <Button variant="ghost" onClick={discard} disabled={pending}>
                  <RotateCcw className="size-4" aria-hidden /> {hasErrors ? (record.format === "md" ? "Corrigir os dados" : "Enviar outro arquivo") : "Cancelar"}
                </Button>
              </>
            }
          >
            {record.issues.length ? <ValidationList issues={record.issues} /> : (
              <p className="flex items-center gap-2 rounded-xl bg-positive-soft px-4 py-3 text-sm font-semibold text-positive">
                <CircleCheck className="size-4" aria-hidden /> Nenhum problema encontrado.
              </p>
            )}
          </StepFrame>
        ) : null}

        {step === 5 && record?.preview ? (
          <StepFrame
            title="Prévia dos dados"
            description={record.preview.kind === "document" ? "Confira o documento antes de criar o rascunho." : mismatch ? "Confirme em qual período o relatório deve entrar." : "Escolha os períodos que serão importados como rascunho."}
            onBack={() => setStep(4)}
            onNext={() => setStep(6)}
            nextDisabled={record.preview.kind === "dataset" && (mismatch ? !target : !selected.length)}
          >
            {record.preview.kind === "document" ? (
              <div className="space-y-3">
                <p className="text-sm text-text-2">
                  {record.preview.periods[0]?.label}
                  {record.preview.documentPages ? ` · ${record.preview.documentPages} página(s)` : ""}
                </p>
                <ReportViewer source={record.format === "pdf" ? "pdf" : "html_legacy"} src={`/api/adm/uploads/${record.id}/file`} downloadHref={null} title={record.fileName} />
              </div>
            ) : (
              <div className="space-y-5">
                {record.preview.sheets.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-text-3">Abas lidas</p>
                    <ul className="flex flex-wrap gap-2">
                      {record.preview.sheets.map((s) => (
                        <li key={s.name}>
                          <Badge tone={s.recognizedAs ? "primary" : "muted"}>
                            {s.name}
                            {s.recognizedAs && s.recognizedAs !== s.name ? ` → ${s.recognizedAs}` : ""} · {s.rows} linha(s)
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {mismatch && filePeriod ? (
                  <>
                    <fieldset>
                      <legend className="mb-1 text-sm font-bold text-text">Em qual período este relatório deve entrar?</legend>
                      <p className="mb-3 text-[13px] text-text-3">
                        Você escolheu <strong className="text-text-2">{mismatch.requestedLabel}</strong>, mas as datas da planilha são de <strong className="text-text-2">{filePeriod.label}</strong>. Se a planilha foi montada a partir de outro relatório, as datas provavelmente ficaram desatualizadas.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            { value: "requested", label: mismatch.requestedLabel, existing: mismatch.existing, hint: "Período escolhido no assistente. As datas da planilha são ignoradas." },
                            { value: "file", label: filePeriod.label, existing: filePeriod.existing, hint: "Período das datas que estão na planilha." },
                          ] as const
                        ).map((o) => (
                          <label key={o.value} className={cn("flex cursor-pointer gap-3 rounded-[var(--radius-md)] border p-3.5", target === o.value ? "border-primary bg-primary-soft/60" : "border-border-strong hover:bg-surface-2")}>
                            <input type="radio" name="period-target" className="mt-1 size-[18px] shrink-0 accent-[var(--primary)]" checked={target === o.value} onChange={() => setTarget(o.value)} />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-text">{o.label}</span>
                                <Badge tone={existingTone(o.existing)}>{EXISTING_LABEL[o.existing]}</Badge>
                              </span>
                              <span className="mt-1 block text-xs text-text-3">{o.hint}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <p className="mb-2 text-xs font-semibold text-text-3">Dados encontrados no arquivo</p>
                      <div className="rounded-[var(--radius-md)] border border-border-strong p-3.5 [&>*:first-child]:mt-0">
                        <PeriodFigures p={filePeriod} />
                      </div>
                    </div>
                  </>
                ) : (
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold text-text-3">Períodos encontrados</legend>
                    <ul className="space-y-2">
                      {record.preview.periods.map((p) => {
                        const checked = selected.includes(p.periodKey);
                        return (
                          <li key={p.periodKey}>
                            <label className={cn("flex cursor-pointer gap-3 rounded-[var(--radius-md)] border p-3.5", checked ? "border-primary bg-primary-soft/60" : "border-border-strong hover:bg-surface-2")}>
                              <input
                                type="checkbox"
                                className="mt-1 size-[18px] shrink-0 accent-[var(--primary)]"
                                checked={checked}
                                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.periodKey] : s.filter((k) => k !== p.periodKey)))}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-text">{p.label}</span>
                                  <Badge tone={existingTone(p.existing)}>{EXISTING_LABEL[p.existing]}</Badge>
                                </span>
                                <PeriodFigures p={p} />
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                )}
              </div>
            )}
          </StepFrame>
        ) : null}

        {step === 6 && record?.preview ? (
          <StepFrame title="Confirmar importação" onBack={() => setStep(5)} nextLabel="Criar rascunho" onNext={confirm} nextDisabled={pending} busy={pending}>
            <div className="space-y-3 text-sm text-text-2">
              <p>
                Serão criados <strong className="text-text">{importLabels.length} rascunho(s)</strong> para <strong className="text-text">{client?.name}</strong>:
              </p>
              <ul className="list-inside list-disc space-y-1 text-text">
                {importLabels.map((label) => (
                  <li key={label}>
                    {TYPE_LABEL[record.reportType]} · {label}
                  </li>
                ))}
              </ul>
              {mismatch && target === "requested" && filePeriod ? (
                <p className="rounded-xl bg-info-soft px-4 py-3 text-[13px] text-text-2">
                  Os dados da planilha (datas de {filePeriod.label}) entram como {mismatch.requestedLabel}.
                </p>
              ) : null}
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-text-3">Nada será publicado agora. O cliente só verá o relatório depois que você revisar e clicar em Publicar. O arquivo original fica guardado junto do relatório.</p>
              {record.format === "csv" && record.reportType === "commercial" && record.csvContent !== "funnel" ? (
                <p className="rounded-xl bg-info-soft px-4 py-3 text-[13px] text-text-2">Este CSV atualiza apenas a seção enviada: os dados das outras seções serão copiados do relatório mais recente do período.</p>
              ) : null}
              {record.platform ? (
                <p className="rounded-xl bg-info-soft px-4 py-3 text-[13px] text-text-2">
                  Em cada período, só os dados de {UPLOAD_PLATFORM_OPTIONS.find((o) => o.value === record.platform)?.label ?? record.platform} são substituídos. As campanhas das outras plataformas são copiadas do relatório mais recente {unitWord === "semana" ? "da semana" : "do mês"}.
                </p>
              ) : null}
            </div>
          </StepFrame>
        ) : null}

        {step === 7 && record ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-positive-soft text-positive" aria-hidden>
              <CircleCheck className="size-7" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-text">
                {publishedCount !== null ? (publishedCount === 1 ? "1 relatório publicado" : `${publishedCount} relatórios publicados`) : record.reportIds.length === 1 ? "Rascunho criado" : `${record.reportIds.length} rascunhos criados`}
              </h2>
              <p className="mt-1 text-sm text-text-3">{publishedCount !== null ? (publishedCount ? "O cliente já vê os dados no portal." : "Nada foi publicado: esses relatórios já tinham sido publicados ou substituídos por versões mais novas.") : "Revise a prévia e publique quando estiver tudo certo."}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {record.reportIds.length > 1 && publishedCount === null ? (
                <ActionButton
                  variant="primary"
                  icon={<Send className="size-4" aria-hidden />}
                  action={async () => {
                    const result = await publishImportAction(record.id);
                    if (result.ok) setPublishedCount(result.data.published);
                    return result;
                  }}
                  confirm={{
                    title: `Publicar ${record.reportIds.length} relatórios?`,
                    description: `Os rascunhos criados agora ficam visíveis para ${client?.name ?? "o cliente"} na hora. Se algum período já estava publicado, a versão anterior é substituída (e continua no histórico interno). Rascunhos que já têm uma versão mais nova não são publicados. Dá para retirar a publicação depois.`,
                    confirmLabel: "Publicar todos",
                    tone: "primary",
                  }}
                >
                  Publicar todos
                </ActionButton>
              ) : null}
              {record.reportIds.slice(0, 1).map((id) => (
                <Link key={id} href={`/adm/clientes/${record.clientId}/relatorios/${id}`} className={buttonClass(record.reportIds.length > 1 && publishedCount === null ? "secondary" : "primary")}>
                  {publishedCount !== null ? "Ver relatório" : record.reportIds.length > 1 ? "Revisar um por um" : "Revisar e publicar"} <ArrowRight className="size-4" aria-hidden />
                </Link>
              ))}
              <Link href={`/adm/clientes/${record.clientId}/portal`} className={buttonClass("secondary")}>
                Prévia do portal
              </Link>
              <Link href="/adm/uploads" className={buttonClass("ghost")}>
                Novo upload
              </Link>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-negative-soft px-4 py-3 text-sm font-medium text-negative" role="alert">
            <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function existingTone(existing: PreviewPeriod["existing"]) {
  return existing === "none" ? "positive" : existing === "published" ? "attention" : "info";
}

/** Indicadores e detalhes lidos de um período do arquivo. */
function PeriodFigures({ p }: { p: PreviewPeriod }) {
  return (
    <>
      {p.metrics.length ? (
        <span className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {p.metrics.map((m) => (
            <span key={m.label} className="min-w-0 text-[13px]">
              <span className="block truncate text-text-3">{m.label}</span>
              <span className="tabular block font-semibold text-text">{m.value}</span>
            </span>
          ))}
        </span>
      ) : null}
      {p.details.length ? <span className="mt-1.5 block text-xs text-text-3">{p.details.join(" · ")}</span> : null}
    </>
  );
}

function keyFromRecord(r: ImportRecord): string {
  const p = r.requestedPeriod;
  if (!p) return "";
  if (p.granularity === "month") return p.start.slice(0, 7);
  if (p.granularity === "week") return p.start;
  return `${p.start}_${p.end}`;
}

function Stepper({ step, onGo, canGoTo }: { step: Step; onGo: (s: Step) => void; canGoTo: (s: Step) => boolean }) {
  return (
    <nav aria-label="Etapas do upload">
      <p className="mb-2 text-sm font-semibold text-text-2 sm:hidden">
        Etapa {step + 1} de {STEPS.length} · <span className="text-text">{STEPS[step]}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-chart-track sm:hidden" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <ol className="hidden grid-cols-8 gap-2 sm:grid">
        {STEPS.map((label, i) => {
          const s = i as Step;
          const done = s < step;
          const current = s === step;
          const clickable = canGoTo(s);
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onGo(s)}
                disabled={!clickable}
                aria-current={current ? "step" : undefined}
                className={cn("flex w-full flex-col gap-1.5 text-left disabled:cursor-default", clickable && "hover:opacity-80")}
              >
                <span className={cn("h-1 rounded-full", done || current ? "bg-primary" : "bg-chart-track")} aria-hidden />
                <span className={cn("flex items-center gap-1 text-xs font-semibold", current ? "text-text" : done ? "text-text-2" : "text-text-3")}>
                  {done ? <Check className="size-3 text-primary" aria-hidden /> : <span className="tabular text-text-3">{i + 1}.</span>}
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepFrame({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Continuar",
  nextDisabled,
  busy,
  extra,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-text sm:text-xl">{title}</h2>
      {description ? <p className="mt-1 text-sm text-text-3">{description}</p> : null}
      <div className="mt-5">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {onBack ? (
            <Button variant="ghost" onClick={onBack} disabled={busy}>
              <ArrowLeft className="size-4" aria-hidden /> Voltar
            </Button>
          ) : null}
          {extra}
        </div>
        {onNext ? (
          <Button variant="primary" size="lg" onClick={onNext} disabled={nextDisabled} aria-busy={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {nextLabel}
            {!busy ? <ArrowRight className="size-4" aria-hidden /> : null}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
