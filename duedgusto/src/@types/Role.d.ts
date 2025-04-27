type Role = {
  __typename: "Role";
  roleId: number;
  roleName: string;
  roleDescription: string;
  users: User[];
  menuIds: number[];
} | null;

type RoleInput = {
  roleId: number;
  roleName: string;
  roleDescription?: string;
};
