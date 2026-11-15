/** Who may upload and decide sales files (the bookkeeper only reads). The backend decides too. */
export const SALES_WRITE_ROLES = ["owner", "partner", "manager"];

export function mayWriteSales(roles: string[]): boolean {
  return roles.some((r) => SALES_WRITE_ROLES.includes(r));
}
