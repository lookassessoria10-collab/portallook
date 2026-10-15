export const commercialProfiles = {
  "dra-isabor-sant-anna": "isabor",
  "serenity-terapias": "serenity",
  "instituto-landim": "landim",
  larplan: "larplan",
} as const;
export type CommercialProfile =
  (typeof commercialProfiles)[keyof typeof commercialProfiles];
export function commercialProfile(slug: string): CommercialProfile | null {
  return commercialProfiles[slug as keyof typeof commercialProfiles] ?? null;
}
export const profileNames: Record<CommercialProfile, string> = {
  isabor: "Dra. Isabor",
  serenity: "Serenity",
  landim: "Instituto Landim",
  larplan: "Larplan",
};
