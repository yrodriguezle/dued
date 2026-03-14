function formDirtyStore(set: StoreSet) {
  return {
    isFormDirty: false,
    setFormDirty: (dirty: boolean) =>
      set((state) => {
        if (state.isFormDirty === dirty) return state;
        return { isFormDirty: dirty };
      }),
  };
}

export default formDirtyStore;
