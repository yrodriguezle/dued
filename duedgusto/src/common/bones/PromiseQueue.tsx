/* eslint-disable @typescript-eslint/no-explicit-any */
class PromiseQueue {
  private queue: Promise<any>;

  constructor() {
    this.queue = Promise.resolve(true);
  }

  add(operation: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue = this.queue
        .then(operation)
        .then(resolve)
        .catch(reject);
    });
  }
}

export default PromiseQueue;
