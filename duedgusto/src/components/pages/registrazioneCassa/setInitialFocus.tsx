/**
 * Mette il focus sul primo campo numerico. Il ritardo serve ad attendere il render
 * della griglia; ritorna la funzione per annullarlo, perché un timer lasciato in volo
 * dopo lo smontaggio ruberebbe il focus alla pagina successiva.
 */
function setInitialFocus() {
  const timeoutId = setTimeout(() => {
    const firstInput = document.querySelector<HTMLInputElement>('input[type="number"]');
    if (firstInput) {
      firstInput.focus();
    }
  }, 100);

  return () => clearTimeout(timeoutId);
}

export default setInitialFocus;
