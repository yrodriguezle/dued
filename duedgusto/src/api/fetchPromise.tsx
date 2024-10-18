function fetchPromise(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    fetch(input, init)
      .then((response) => {
        if (response.ok) {
          resolve(response);
        }
        response.json().then((body) => reject(body));
      });
  });
}

export default fetchPromise