type User = {
  __typename: "User";
  userId: number;
  userName: string;
  firstName: string;
  lastName: string;
  description: string;
  disabled: boolean;
  roleId: number;
  role: Role;
  menus: Menu[];
} | null;
