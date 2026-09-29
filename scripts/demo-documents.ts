import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/** PDF fictício de várias páginas para demonstrar o visualizador. */
export async function buildDemoPdf(title: string, clientName: string, periodLabel: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.09, 0.17);
  const cyan = rgb(0, 0.68, 0.94);
  const green = rgb(0, 0.75, 0.5);
  const gray = rgb(0.4, 0.45, 0.52);

  const pages: Array<{ heading: string; lines: string[]; bars?: number[] }> = [
    {
      heading: title,
      lines: [clientName, periodLabel, "", "Documento de demonstração gerado pelo Portal Look.", "Os números são fictícios."],
    },
    {
      heading: "Resumo do período",
      lines: ["Leads: 257", "Agendamentos: 14", "Comparecimentos: 8", "Receita: R$ 3.400,00", "Investimento em mídia: R$ 1.208,17"],
      bars: [96, 108, 115, 77, 229, 257],
    },
    {
      heading: "Próximos passos",
      lines: ["1. Revisar roteiro de atendimento no WhatsApp.", "2. Reforçar o programa de indicação.", "3. Testar criativos em vídeo curto."],
    },
  ];

  for (const [i, content] of pages.entries()) {
    const page = pdf.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: navy });
    page.drawRectangle({ x: 0, y: 780, width: 595, height: 2, color: cyan });
    page.drawText("LOOK · Assessoria de Comunicação", { x: 40, y: 806, size: 11, font: bold, color: rgb(1, 1, 1) });
    page.drawText(content.heading, { x: 40, y: 720, size: i === 0 ? 26 : 20, font: bold, color: navy });
    content.lines.forEach((line, j) => page.drawText(line, { x: 40, y: 680 - j * 24, size: 13, font, color: j === 0 && i === 0 ? cyan : navy }));
    if (content.bars) {
      const max = Math.max(...content.bars);
      content.bars.forEach((v, j) => {
        const h = (v / max) * 180;
        page.drawRectangle({ x: 60 + j * 78, y: 300, width: 44, height: h, color: j === content.bars!.length - 1 ? cyan : green, opacity: j === content.bars!.length - 1 ? 1 : 0.55 });
        page.drawText(String(v), { x: 66 + j * 78, y: 306 + h, size: 11, font: bold, color: navy });
        page.drawText(["mar", "abr", "mai", "jun", "jul", "ago"][j], { x: 70 + j * 78, y: 282, size: 10, font, color: gray });
      });
      page.drawText("Leads por mês", { x: 60, y: 520, size: 12, font: bold, color: gray });
    }
    page.drawText(`Página ${i + 1} de ${pages.length}`, { x: 40, y: 40, size: 10, font, color: gray });
  }
  return Buffer.from(await pdf.save());
}

/** HTML "legado" com JavaScript próprio — exibido isolado em iframe sandbox. */
export function buildDemoLegacyHtml(clientName: string, periodLabel: string): Buffer {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard comercial — ${periodLabel}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f9; color: #1d2733; }
  header { background: #1d2733; color: #fff; padding: 20px 24px; }
  h1 { margin: 0; font-size: 20px; }
  main { padding: 24px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
  .kpi { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .kpi b { display: block; font-size: 28px; margin-top: 6px; }
  canvas { background: #fff; border-radius: 8px; width: 100%; grid-column: 1 / -1; }
</style>
</head>
<body>
<header><h1>${clientName} — ${periodLabel}</h1><small>Formato anterior de dashboard (demonstração)</small></header>
<main>
  <div class="kpi">Leads<b>229</b></div>
  <div class="kpi">Agendamentos<b>13</b></div>
  <div class="kpi">Comparecimentos<b>6</b></div>
  <div class="kpi">Receita<b>R$ 2.876</b></div>
  <canvas id="c" width="800" height="260"></canvas>
</main>
<script>
  const ctx = document.getElementById('c').getContext('2d');
  const data = [96, 108, 115, 77, 229];
  const labels = ['mar', 'abr', 'mai', 'jun', 'jul'];
  const max = Math.max(...data);
  data.forEach((v, i) => {
    const h = (v / max) * 180;
    ctx.fillStyle = i === data.length - 1 ? '#1d6fd8' : '#9db7d9';
    ctx.fillRect(60 + i * 140, 220 - h, 70, h);
    ctx.fillStyle = '#1d2733';
    ctx.font = '14px Arial';
    ctx.fillText(v, 80 + i * 140, 212 - h);
    ctx.fillText(labels[i], 82 + i * 140, 244);
  });
</script>
</body>
</html>`;
  return Buffer.from(html, "utf8");
}
