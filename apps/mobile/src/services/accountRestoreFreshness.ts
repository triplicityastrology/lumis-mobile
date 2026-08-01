export type AccountRestoreTicket = { isCurrent: () => boolean };

export function createAccountRestoreFreshnessGate() {
  let generation = 0;
  return {
    begin(): AccountRestoreTicket {
      const ticketGeneration = ++generation;
      return { isCurrent: () => ticketGeneration === generation };
    }
  };
}
