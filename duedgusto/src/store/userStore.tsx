function userStore(set: StoreSet) {
  return {
    utente: null,
    receiveUtente: (payload: Utente) => set(() => ({ utente: payload })),
  };
}

export default userStore;
