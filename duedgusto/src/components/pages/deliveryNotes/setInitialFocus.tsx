function setInitialFocus() {
  if (window.document.getElementsByName('ddtNumber').length) {
    window.document.getElementsByName('ddtNumber')[0].focus();
  }
}

export default setInitialFocus;
