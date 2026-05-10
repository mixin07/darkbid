import { useState, useEffect } from "react"
import { AUCTION_STATES } from "../lib/constants"

export function useAuction(initialDurationS = 35) {
  const [state, setState] = useState(AUCTION_STATES.BIDDING)
  const [timeLeft, setTimeLeft] = useState(initialDurationS)
  const [bids, setBids] = useState(14)
  const [revealed, setRevealed] = useState(0)
  const [isWinner, setIsWinner] = useState(false)

  // Simulation timeline
  useEffect(() => {
    if (state === AUCTION_STATES.BIDDING) {
      if (timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
        return () => clearTimeout(timer)
      } else {
        setState(AUCTION_STATES.REVEAL)
      }
    }

    if (state === AUCTION_STATES.REVEAL) {
      // Simulate people revealing over 10 seconds
      if (revealed < bids) {
        const timer = setTimeout(() => setRevealed(r => Math.min(r + 1, bids)), 800)
        return () => clearTimeout(timer)
      } else {
        // Move to calculating after briefly waiting
        const timer = setTimeout(() => setState(AUCTION_STATES.CALCULATING), 1500)
        return () => clearTimeout(timer)
      }
    }

    if (state === AUCTION_STATES.CALCULATING) {
      const timer = setTimeout(() => {
        // Fake winner selection
        setIsWinner(Math.random() > 0.5)
        setState(AUCTION_STATES.CLOSED)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state, timeLeft, revealed, bids])

  return {
    state,
    timeLeft,
    bids,
    revealed,
    isWinner,
    totalDuration: initialDurationS,
    placeBid: () => setBids(b => b + 1)
  }
}
