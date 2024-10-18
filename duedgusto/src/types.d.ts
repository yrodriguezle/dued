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

type MakeRequest<InputData> = {
  path: string
  method: string
  data?: InputData
  headers?: HeadersInit
  failOnForbidden?: boolean
  // onError?: (response: Response) => void
};

// AuthToken
type AuthToken = {
  token: string
  refreshToken: string
} | null;

interface InProgress {
  [key: string]: boolean
}

type CallbackStoreSet = (state: Store) => Partial<Store>;
type StoreSet = (callback: CallbackStoreSet) => void;
interface Store {
  user: User
  inProgress: InProgress
  receiveUser: (payload: User) => void
  onInProgress: (payload: string) => void
  offInProgress: (payload: string) => void
}

type ThemeMode = 'light' | 'dark' | 'default';