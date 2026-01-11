function inProgressStore(set: StoreSet) {
  return {
    inProgress: {},
    onInProgress: (key: string) =>
      set((state) => {
        // Don't create a new object if the value is already true
        if (state.inProgress[key] === true) {
          return state;
        }
        return {
          inProgress: {
            ...state.inProgress,
            [key]: true,
          },
        };
      }),
    offInProgress: (key: string) =>
      set((state) => {
        // Don't create a new object if the value is already false or undefined
        if (state.inProgress[key] === false || state.inProgress[key] === undefined) {
          return state;
        }
        return {
          inProgress: {
            ...state.inProgress,
            [key]: false,
          },
        };
      }),
  };
}

export default inProgressStore;
