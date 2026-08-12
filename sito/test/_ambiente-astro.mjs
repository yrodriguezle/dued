// Registra l'hook dei moduli virtuali e apre la porta ai sorgenti che li importano.
//
// Va importato **prima** di qualunque `await import()` di un file di `src/lib/`: la
// registrazione vale per le risoluzioni successive, non per quelle già avvenute. È il
// motivo per cui i test caricano i moduli sotto esame con un import dinamico invece che
// con un import statico in testa al file.

import { register } from 'node:module';

register('./_hook-astro-env.mjs', import.meta.url);

/** Il modulo di lettura delle rotte, e il modo di spostarne l'origine fra un caso e l'altro. */
export async function caricaApi() {
  const api = await import('../src/lib/api.ts');
  const finto = await import('astro:env/server');
  return { ...api, impostaApiInternaUrl: finto.impostaApiInternaUrl };
}

/** Il modulo di composizione degli URL dei media, con la stessa possibilità. */
export async function caricaMediaUrl() {
  const media = await import('../src/lib/mediaUrl.ts');
  const finto = await import('astro:env/client');
  return { ...media, impostaMediaOrigine: finto.impostaMediaOrigine };
}
