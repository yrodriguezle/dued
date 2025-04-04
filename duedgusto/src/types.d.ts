interface Global extends Window {
  API_ENDPOINT?: string;
  GRAPHQL_ENDPOINT?: string;
  GRAPHQL_WEBSOCKET?: string;
  COPYRIGHT?: string;
  CONNECTION_INTERVAL_UPDATE_TIME?: number;
  LOGON_TIME?: number;
  SEARCHBOX_CONTAINER_MIN_WIDTH?: number;
  appVersion?: string;
  ClassicEditor?: ClassicEditor;
}

type MakeRequest<InputData> = {
  path: string;
  method: string;
  data?: InputData;
  headers?: HeadersInit;
  failOnForbidden?: boolean;
};

// AuthToken
type AuthToken = {
  token: string;
  refreshToken: string;
} | null;

interface InProgress {
  [key: string]: boolean;
}

type SidebarMenuItemType = "group" | "item" | "collapse";
interface SidebarMenuItem {
  id: string;
  type: string;
  title?: string;
  url?: string;
  icon?: ReactElement;
  breadcrumbs?: boolean;
  children?: SidebarMenuItem[];
}
interface Sidebar {
  isOpen: string[];
  opened: boolean;
  navGroup: SidebarMenuItem[];
}

interface ConfirmDialog {
  open: boolean;
  title: string | JSX.Element;
  content: string | JSX.Element;
  acceptLabel?: string | JSX.Element;
  cancelLabel?: string | JSX.Element;
  onAccept: (value: boolean | PromiseLike<boolean>) => void;
  onCancel?: (value: boolean | PromiseLike<boolean>) => void;
}

type ServerStatus = "ONLINE" | "OFFLINE";

type CallbackStoreSet = (state: Store) => Partial<Store>;
type StoreSet = (callback: CallbackStoreSet) => void;
interface Store {
  // user
  user: User;
  receiveUser: (payload: User) => void;
  // inProgress
  inProgress: InProgress;
  onInProgress: (payload: string) => void;
  offInProgress: (payload: string) => void;
  // userTheme
  userTheme: UserTheme;
  changeTheme: (theme: ThemeMode) => void;
  // confirmDialog
  confirmDialog: ConfirmDialog;
  setConfirmValues: (payload: ConfirmDialog) => void;
  // serverStatus
  serverStatus: ServerStatus;
  receiveServerStatus: (serverStatus: ServerStatus) => void;
}

type ThemeMode = "light" | "dark" | "default";
type Theme = Exclude<ThemeMode, "default">;
interface UserTheme {
  mode: ThemeMode;
  theme: Theme;
}
