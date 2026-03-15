function setInitialFocus() {
  if (window.document.getElementsByName("ragioneSociale").length) {
    window.document.getElementsByName("ragioneSociale")[0].focus();
  }
}

export default setInitialFocus;
