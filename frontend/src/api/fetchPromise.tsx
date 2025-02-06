function fetchPromise(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    fetch(input, init)
      .then((response) => {
        if (response.ok) {
          resolve(response);
          return;
        }
        response.json().then((body) => reject(body));
      });
  });
}

export default fetchPromise