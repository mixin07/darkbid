import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { AUCTION_STATES } from '@/lib/constants'

const verbs = ['placed a sealed bid', 'placed a sealed bid', 'placed a sealed bid', 'revised their commitment']

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function fakeAddr() {
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  return `${hex()}…${hex()}`
}

export function ActivityFeed({ state }) {
  const [activities, setActivities] = useState([
    { id: 1, address: fakeAddr(), time: '2m ago', text: 'created the auction' },
    { id: 2, address: fakeAddr(), time: '5m ago', text: 'placed a sealed bid' },
  ])

  useEffect(() => {
    if (state !== AUCTION_STATES.BIDDING) return
    const id = setInterval(() => {
      if (Math.random() > 0.45) {
        setActivities(prev => [{
          id: Date.now(),
          address: fakeAddr(),
          time: 'just now',
          text: rand(verbs),
        }, ...prev].slice(0, 8))
      }
    }, 2800)
    return () => clearInterval(id)
  }, [state])

  return (
    <div className="border border-[var(--border-subtle)] rounded-2xl p-5 bg-[var(--bg-surface)]">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
        <span className="w-2 h-2 rounded-full bg-[var(--violet-400)] animate-pulse" />
        Live Activity
      </h3>

      <div className="flex flex-col gap-2" style={{ minHeight: 100 }}>
        <AnimatePresence>
          {activities.map(a => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--violet-400)] shrink-0" />
                <span className="font-mono text-xs text-[var(--text-secondary)]">{a.address}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{a.text}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">{a.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
