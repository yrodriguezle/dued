import { useEffect } from "react";

/**
 * Pubblica in `--app-height` l'altezza reale dell'area visibile (visual viewport).
 *
 * Con la tastiera virtuale aperta il layout viewport - e quindi `100dvh` - non si
 * riduce: il browser sposta il viewport per mostrare il campo attivo, lasciando
 * uno spazio vuoto in fondo e spingendo la toolbar di salvataggio fuori schermo.
 * Poiché `html`/`body` sono in `overflow: hidden`, quello scroll non è
 * recuperabile con il dito (il gesto finisce nei contenitori interni).
 *
 * Qui allineiamo l'altezza dell'app al visual viewport e annulliamo lo scroll
 * imposto dal browser, saltando il caso in cui sia l'utente a spostarsi con lo zoom.
 */
function useAppHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    if (!viewport) {
      const syncFallback = () => root.style.setProperty("--app-height", `${window.innerHeight}px`);
      syncFallback();
      window.addEventListener("resize", syncFallback);
      return () => window.removeEventListener("resize", syncFallback);
    }

    const sync = () => {
      root.style.setProperty("--app-height", `${viewport.height}px`);
      // Con lo zoom attivo lo spostamento è dell'utente: non va annullato.
      if (viewport.scale <= 1 && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);
}

export default useAppHeight;
