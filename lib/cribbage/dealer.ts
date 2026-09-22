// Alternates the dealer each deal — the loser of the previous deal's dealer
// coin-flip just keeps swapping. The very first deal of a game is decided by
// the caller (random pick), not by this function.
export function nextDealer(previousDealerId: string, player1Id: string, player2Id: string): string {
  return previousDealerId === player1Id ? player2Id : player1Id;
}

// Non-dealer plays/counts first in every phase.
export function poneOf(dealerId: string, player1Id: string, player2Id: string): string {
  return dealerId === player1Id ? player2Id : player1Id;
}
