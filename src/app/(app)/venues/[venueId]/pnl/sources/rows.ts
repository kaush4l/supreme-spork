/** The title of a source group in the words a person uses. */

const GROUP_TITLES: Record<string, string> = {
  sales: "Sales rows",
  purchases: "Docket lines",
  shifts: "Shifts",
  transactions: "Bank and statement rows",
  bills: "Bills",
};

export function groupTitle(group: string): string {
  return GROUP_TITLES[group] ?? group;
}
