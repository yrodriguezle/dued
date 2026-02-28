function setInitialFocus(update = false) {
  if (update) {
    if (window.document.getElementsByName("roleDescription").length) {
      window.document.getElementsByName("roleDescription")[0].focus();
    }
    return;
  }
  if (window.document.getElementsByName("roleName").length) {
    window.document.getElementsByName("roleName")[0].focus();
  }
}

export default setInitialFocus;
