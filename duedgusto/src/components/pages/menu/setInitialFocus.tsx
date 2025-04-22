const setInitialFocus = () => {
  const firstInput = document.querySelector("input");
  if (firstInput) {
    firstInput.focus();
  }
};

export default setInitialFocus;
