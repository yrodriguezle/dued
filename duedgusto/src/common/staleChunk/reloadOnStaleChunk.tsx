const RELOAD_TIMESTAMP_KEY = "stale-chunk-reload-ts";
const MIN_RELOAD_INTERVAL_MS = 10_000;

/**
 * Ricarica la pagina quando un chunk non è più disponibile sul server
 * (tipicamente dopo un deploy che ha sostituito gli asset hashati).
 * Il reload recupera l'index.html aggiornato con i riferimenti corretti.
 *
 * @returns true se il reload è stato avviato, false se soppresso
 *          (reload già tentato di recente: l'errore va lasciato propagare
 *          all'error boundary per evitare loop di ricaricamento)
 */
export function reloadOnStaleChunk(): boolean {
  const lastReload = Number(sessionStorage.getItem(RELOAD_TIMESTAMP_KEY) ?? 0);
  if (Date.now() - lastReload < MIN_RELOAD_INTERVAL_MS) {
    return false;
  }
  sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

/**
 * Registra il listener globale per i fallimenti di preload dei moduli
 * dinamici di Vite. Da chiamare una sola volta all'avvio dell'app.
 */
export function setupStaleChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnStaleChunk()) {
      event.preventDefault();
    }
  });
}
