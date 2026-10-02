export function shouldEnablePollResultsQuery(
  token: string | undefined,
  poll: unknown,
): boolean {
  return Boolean(token && poll);
}
