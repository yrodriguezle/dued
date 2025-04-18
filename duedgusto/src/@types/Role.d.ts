type Role = {
  __typename: "Role";
  roleId: number;
  roleName: string;
  roleDescription: string;
  users: User[];
} | null;
