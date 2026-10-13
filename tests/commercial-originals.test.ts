import { describe, expect, it } from "vitest";
import { serenityMonths, serenityChannels, serenityServices, serenityTherapists, isaborMonths } from "@/features/commercial/reference-data";

describe("dados históricos dos relatórios originais", () => {
  it("Serenity fecha receita de janeiro a setembro e mantém as ressalvas de leads", () => {
    expect(serenityMonths.map((m) => m.revenue).reduce((a,b) => a+b,0)).toBe(106760);
    expect(serenityMonths.map((m) => m.leads).reduce((a,b) => a+b,0)).toBe(1604);
    expect(serenityMonths.map((m) => m.attended).reduce((a,b) => a+b,0)).toBe(317);
    expect(serenityMonths[8]).toMatchObject({revenue:10240,leads:41,bookings:36,attended:36});
    expect(serenityChannels.map((c) => c.revenue).reduce((a,b) => a+b,0)).toBe(104710);
  });
  it("Serenity não duplica subtotais e mantém Valentina em setembro", () => {
    expect(serenityServices.reduce((a,x)=>a+x.revenue,0)).toBe(103520);
    expect(serenityServices.reduce((a,x)=>a+Number(x.total),0)).toBe(304);
    expect(serenityTherapists.find(x=>x.label==="Valentina")?.counts[8]).toBe(4);
    expect(serenityTherapists.find(x=>x.label==="Vanessa")?.counts[8]).toBeNull();
  });
  it("ROI e ROAS da Serenity mantêm a base dos canais pagos", () => {
    const investment=serenityMonths.reduce((a,m)=>a+m.metaSpend+m.sitesSpend,0);
    const revenue=serenityMonths.reduce((a,m)=>a+m.metaRevenue+m.sitesRevenue,0);
    expect(investment).toBeCloseTo(6084.18,2);
    expect(revenue).toBe(26085);
    expect((revenue-investment)/investment*100).toBeCloseTo(328.7,1);
  });
  it("Isabor fecha valores de maio a setembro e separa retorno geral", () => {
    expect(isaborMonths.reduce((a,m)=>a+m.leads,0)).toBe(695);
    expect(isaborMonths.reduce((a,m)=>a+m.attended,0)).toBe(55);
    expect(isaborMonths.reduce((a,m)=>a+m.revenue,0)).toBe(23400);
    expect(isaborMonths.reduce((a,m)=>a+m.spend,0)).toBeCloseTo(6001.87,2);
    expect(isaborMonths[4]).toMatchObject({leads:130,bookings:23,attended:18,revenue:7750,metaRevenue:3550,googleRevenue:450});
    expect(23400/6001.87).toBeCloseTo(3.90,2);
  });
});