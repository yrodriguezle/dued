const reportError = (error: unknown) => {
  const message = error instanceof Error ? error.message : null;
  return message;
};

export default reportError;
