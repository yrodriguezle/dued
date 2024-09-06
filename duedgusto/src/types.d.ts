interface Global extends Window {
  API_ENDPOINT?: string
  GRAPHQL_ENDPOINT?: string
  GRAPHQL_WEBSOCKET?: string
  COPYRIGHT?: string
  ROOT_URL?: string
  CONNECTION_INTERVAL_UPDATE_TIME?: number
  LOGON_TIME?: number
  SEARCHBOX_CONTAINER_MIN_WIDTH?: number
  appVersion?: string
  ClassicEditor?: ClassicEditor
}

// AuthToken
type AuthToken = {
  token: string
  refreshToken: string
} | null;

type CallbackStoreSet = (state: Store) => Partial<Store>;
type StoreSet = (callback: CallbackStoreSet) => void;
interface Store {
  user: User
  receiveUser: (payload: User) => void
}

type ThemeMode = 'light' | 'dark' | 'default';