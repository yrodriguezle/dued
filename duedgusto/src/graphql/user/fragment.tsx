import { menuFragment } from "../menus/fragments";
import { roleFragment } from "../roles/fragments";

export const userFragment = `
  ${roleFragment}
  ${menuFragment}
  fragment UserFragment on User {
    userId
    userName
    firstName
    lastName
    description
    disabled
    roleId
    role { ...RoleFragment }
    menus { ...MenuFragment }
  }`;
