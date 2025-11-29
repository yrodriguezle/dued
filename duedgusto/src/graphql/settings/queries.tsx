import { gql } from "@apollo/client";

export const GET_BUSINESS_SETTINGS = gql`
  query GetBusinessSettings {
    getBusinessSettings {
      settingsId
      businessName
      openingTime
      closingTime
      operatingDays
      timezone
      currency
      vatRate
      updatedAt
      createdAt
    }
  }
`;
