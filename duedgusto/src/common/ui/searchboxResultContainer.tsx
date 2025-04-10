interface ContainerResult {
  [key: string]: number;
}

export const getSearchboxResultContainerWidth = (id: string) => {
  const searchboxResultContainer = localStorage.getItem("searchboxResultContainerWidth") || "{}";
  const containerResult: ContainerResult = JSON.parse(searchboxResultContainer);

  return containerResult[id] || (window as Global).SEARCHBOX_CONTAINER_MIN_WIDTH || 500;
};

export const setSearchboxResultContainerWidth = (id: string, width: number) => {
  const searchboxResultContainer = localStorage.getItem("searchboxResultContainerWidth") || "{}";
  const containerResult: ContainerResult = JSON.parse(searchboxResultContainer);

  localStorage.setItem(
    "searchboxResultContainerWidth",
    JSON.stringify({
      ...containerResult,
      [id]: width,
    })
  );
};
