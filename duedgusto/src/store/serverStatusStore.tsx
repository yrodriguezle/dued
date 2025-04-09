export const ONLINE: ServerStatus = "ONLINE";
export const OFFLINE: ServerStatus = "OFFLINE";

function serverStatusStore(set: StoreSet) {
  return {
    serverStatus: ONLINE,
    receiveServerStatus: (serverStatus: ServerStatus) => set(() => ({ serverStatus })),
  };
}

export default serverStatusStore;
