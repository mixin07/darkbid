import { motion } from 'framer-motion'

export function CountdownTimer({ timeLeft, state, totalDuration, bids = 0 }) {
  const hours   = Math.floor(timeLeft / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  const seconds = timeLeft % 60

  const progress = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0
  const timerColor = timeLeft < 30 ? 'text-[var(--error)]' : timeLeft < 120 ? 'text-[var(--warning)]' : 'text-white'
  const barColor   = timeLeft < 30 ? '#FF3B5C' : timeLeft < 120 ? '#FFA500' : '#06FFA5'
  const glowColor  = timeLeft < 30 ? 'rgba(255,59,92,1)' : timeLeft < 120 ? 'rgba(255,165,0,1)' : 'rgba(210,187,255,1)'

  const display = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden cosmic-glow min-h-[400px] w-full">
      
      {/* Black Hole / Radar Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
        <div className="w-[340px] h-[340px] rounded-full border border-[rgba(124,58,237,0.2)] animate-[spin_12s_linear_infinite]" />
        <div className="absolute w-[280px] h-[280px] rounded-full border border-[rgba(124,58,237,0.3)] border-dashed animate-[spin_18s_linear_infinite_reverse]" />
        <div className="absolute w-[220px] h-[220px] bg-black rounded-full shadow-[0_0_80px_rgba(124,58,237,0.8),inset_0_0_20px_rgba(0,0,0,1)] z-0" />
      </div>

      <div className="text-center z-10 w-full relative">
        <p className="font-mono text-xs text-[var(--violet-400)] uppercase tracking-[0.3em] mb-6 font-bold opacity-80">
          T-Minus to Event Horizon
        </p>
        
        <div className={`text-display text-[72px] leading-none font-bold mb-8 flex items-center justify-center gap-0 tabular-nums tracking-tighter ${timerColor}`} style={{ textShadow: `0 0 20px ${glowColor.replace(',1)', ',0.8)')}` }}>
          {display}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-[280px] mx-auto h-1.5 bg-black/50 rounded-full overflow-hidden mb-4 border border-white/10 relative backdrop-blur-sm">
          <motion.div 
            className="h-full relative rounded-full"
            animate={{ width: `${progress}%`, backgroundColor: barColor }}
            transition={{ ease: "linear", duration: 1 }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-white/50 blur-[4px] animate-pulse" />
          </motion.div>
        </div>

        <div className="flex justify-between items-center w-full max-w-[280px] mx-auto px-1 mt-4">
          <span className="font-mono text-xs text-[var(--text-muted)] tracking-wider uppercase">
            {bids} BIDS SEALED
          </span>
          <span className="flex items-center gap-2 font-mono text-xs text-[var(--success)] tracking-widest uppercase">
            <span 
              className="w-2 h-2 rounded-full animate-pulse object-cover" 
              style={{ backgroundColor: barColor, boxShadow: `0 0 10px ${glowColor}` }} 
            />
            Live
          </span>
        </div>
      </div>

    </div>
  )
}

export default CountdownTimer
