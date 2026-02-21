function setInitialFocus() {
  if (window.document.getElementsByName('businessName').length) {
    window.document.getElementsByName('businessName')[0].focus();
  }
}

export default setInitialFocus;
