async function fetchConfiguration() {
  return fetch("/config.json", {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

export default fetchConfiguration;
