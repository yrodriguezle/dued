function userStore(set: StoreSet) {
  return {
    user: null,
    receiveUser: (payload: User) => set(() => ({ user: payload })),
  };
}

export default userStore;
