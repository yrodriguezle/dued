const handleRetry = async (error, operation) => {
  const requiresRetry = false;
  console.log('error', error, 'operation', operation);
  // if (error.statusCode === 401) {
  //   requiresRetry = true;
  //   if (!this.refreshingToken) {
  //     this.refreshingToken = true;
  //     await this.requestNewAccessToken();
  //     operation.setContext(({ headers = {} }) => this._getAuthHeaders(headers));
  //     this.refreshingToken = false;
  //   }
  // }
  return requiresRetry;
};

export default handleRetry;
