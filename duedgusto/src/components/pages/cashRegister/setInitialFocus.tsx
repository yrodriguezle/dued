function setInitialFocus() {
  setTimeout(() => {
    const firstInput = document.querySelector<HTMLInputElement>('input[type="number"]');
    if (firstInput) {
      firstInput.focus();
    }
  }, 100);
}

export default setInitialFocus;
