function setInitialFocus(update = false) {
  if (update) {
    if (window.document.getElementsByName('firstName').length) {
      window.document.getElementsByName('firstName')[0].focus();
    }
    return;
  }
  if (window.document.getElementsByName('userName').length) {
    window.document.getElementsByName('userName')[0].focus();
  }
}

export default setInitialFocus;