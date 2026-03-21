import { gql, useSubscription } from "@apollo/client";

const ON_SETTINGS_UPDATED = gql`
  subscription OnSettingsUpdated {
    onSettingsUpdated {
      azione
      timestamp
    }
  }
`;

interface SettingsUpdatedEvent {
  azione: string;
  timestamp: string;
}

interface SettingsUpdatedData {
  onSettingsUpdated: SettingsUpdatedEvent;
}

const useSettingsSubscription = () => {
  return useSubscription<SettingsUpdatedData>(ON_SETTINGS_UPDATED);
};

export default useSettingsSubscription;
