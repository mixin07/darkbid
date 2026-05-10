import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, X } from 'lucide-react'

/**
 * Toast hook — returns { toasts, showToast }
 * showToast({ type: 'success'|'error', title, body, link?, linkLabel? })
 */
export function useToast() {
  const [toasts, setToasts] = useState([])

  function showToast(opts) {
    const id = Date.now()
    setToasts(prev => [...prev, { id, ...opts }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, showToast, dismiss }
}

/**
 * ToastContainer — fixed portal at bottom-right.
 * Pass `toasts` and `dismiss` from useToast().
 */
export function ToastContainer({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-3 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ x: 120, opacity: 0 }}
            animate={{ x: 0,   opacity: 1 }}
            exit={{   x: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className={`relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-modal
              ${t.type === 'success'
                ? 'bg-[rgba(6,255,165,0.08)] border-[rgba(6,255,165,0.25)] text-[var(--success)]'
                : 'bg-[rgba(255,59,92,0.08)] border-[rgba(255,59,92,0.25)] text-[var(--error)]'
              }
            `}
          >
            {t.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              : <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white">{t.title}</p>
              {t.body && <p className="text-xs mt-0.5 opacity-75">{t.body}</p>}
              {t.link && (
                <a
                  href={t.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline underline-offset-2 mt-1 inline-block opacity-80 hover:opacity-100"
                >
                  {t.linkLabel || 'View →'}
                </a>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
