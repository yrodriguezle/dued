import { gql } from "@apollo/client";

export const UPDATE_BUSINESS_SETTINGS = gql`
  mutation UpdateBusinessSettings($input: BusinessSettingsInput!) {
    updateBusinessSettings(input: $input) {
      settingsId
      businessName
      openingTime
      closingTime
      operatingDays
      timezone
      currency
      vatRate
      updatedAt
    }
  }
`;
