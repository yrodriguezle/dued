type Role = {
  __typename: "Role";
  roleId: number;
  roleName: string;
  roleDescription: string;
  users: User[];
} | null;

type RoleInput = {
  roleId: number;
  roleName: string;
  roleDescription?: string;
};
