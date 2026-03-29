import { z } from "zod";

export const Schema = z.object({
  fornitoreId: z.number().optional(),
  ragioneSociale: z.string().nonempty("Ragione sociale è obbligatoria"),
  ragioneSociale2: z.string().optional(),
  partitaIva: z.string().optional(),
  codiceFiscale: z.string().optional(),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  telefono: z.string().optional(),
  indirizzo: z.string().optional(),
  citta: z.string().optional(),
  cap: z.string().optional(),
  provincia: z.string().optional(),
  paese: z.string().default("IT"),
  note: z.string().optional(),
  attivo: z.boolean().default(true),
  aliquotaIva: z.number().min(0).max(100).optional(),
});

export type FormikFornitoreValues = z.infer<typeof Schema>;

export const mapFornitoreToFormValues = (fornitore: Fornitore): Partial<FormikFornitoreValues> => ({
  fornitoreId: fornitore.fornitoreId,
  ragioneSociale: fornitore.ragioneSociale,
  ragioneSociale2: fornitore.ragioneSociale2 || "",
  partitaIva: fornitore.partitaIva || "",
  codiceFiscale: fornitore.codiceFiscale || "",
  email: fornitore.email || "",
  telefono: fornitore.telefono || "",
  indirizzo: fornitore.indirizzo || "",
  citta: fornitore.citta || "",
  cap: fornitore.cap || "",
  provincia: fornitore.provincia || "",
  paese: fornitore.paese || "IT",
  note: fornitore.note || "",
  attivo: fornitore.attivo,
  aliquotaIva: fornitore.aliquotaIva ?? 22,
});
