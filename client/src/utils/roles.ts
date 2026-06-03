export const ROLES = {
  ADMIN: "admin",
  OWNER: "owner",
  SUPERVISOR: "supervisor",
  SPECIAL_SUPERVISOR: "special_supervisor",
  LABOUR: "labour",
} as const;

export const getHomeRouteForRole = (role?: string) => {
  switch (role) {
    case ROLES.ADMIN:
      return "/(tabs)/home";
    case ROLES.OWNER:
      return "/owner/dashboard";
    case ROLES.SUPERVISOR:
      return "/supervisor/(tabs)/home";
    case ROLES.SPECIAL_SUPERVISOR:
      return "/special-supervisor/assignments";
    case ROLES.LABOUR:
      return "/(labour)/dashboard";
    default:
      return "/(tabs)/home";
  }
};

export const getRoleLabel = (role?: string) => {
  switch (role) {
    case ROLES.OWNER:
      return "Owner";
    case ROLES.SPECIAL_SUPERVISOR:
      return "Special Supervisor";
    case ROLES.SUPERVISOR:
      return "Supervisor";
    case ROLES.ADMIN:
      return "Admin";
    case ROLES.LABOUR:
      return "Labour";
    default:
      return "User";
  }
};
