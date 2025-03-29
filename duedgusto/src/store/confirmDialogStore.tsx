function confirmDialogStore(set: StoreSet) {
  const confirmDialog: ConfirmDialog = {
    open: false,
    title: "",
    content: "",
    acceptLabel: "Ok",
    cancelLabel: "",
    onAccept: () => Promise.resolve(true),
  };

  return {
    confirmDialog,
    setConfirmValues: (payload: ConfirmDialog) => set((state) => ({
      confirmDialog: {
        ...state.confirmDialog,
        ...payload,
      }
    })),
  };
}

export default confirmDialogStore;
