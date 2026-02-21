function setInitialFocus() {
  if (window.document.getElementsByName('invoiceNumber').length) {
    window.document.getElementsByName('invoiceNumber')[0].focus();
  }
}

export default setInitialFocus;
