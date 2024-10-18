function inProgressStore(set: StoreSet) {
  return {
    inProgress: {},
    onInProgress: (key: string) => set((state) => ({
      inProgress: {
        ...state.inProgress,
        [key]: true,
      },
    })),
    offInProgress: (key: string) => set((state) => ({
      inProgress: {
        ...state.inProgress,
        [key]: false,
      },
    })),
  };
}

export default inProgressStore;
