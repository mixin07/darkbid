import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import canvasConfetti from 'canvas-confetti'

/**
 * ConfettiBurst — call ref.current.fire() to trigger confetti explosion.
 * Mounts a hidden canvas in the top-right corner that canvas-confetti uses.
 */
export const ConfettiBurst = forwardRef(function ConfettiBurst(_, ref) {
  const canvasRef = useRef(null)
  const confettiRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    confettiRef.current = canvasConfetti.create(canvasRef.current, {
      resize: true,
      useWorker: false,
    })
    return () => confettiRef.current?.reset?.()
  }, [])

  useImperativeHandle(ref, () => ({
    fire() {
      if (!confettiRef.current) return
      // First burst — center explosion
      confettiRef.current({
        particleCount: 120,
        spread: 100,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#7C3AED', '#06FFA5', '#FFA500', '#A78BFA', '#FF3B5C', '#ffffff'],
        ticks: 200,
        gravity: 1.2,
        scalar: 1.1,
      })
      // Second burst — side launchers
      setTimeout(() => {
        confettiRef.current({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.65 },
          colors: ['#7C3AED', '#06FFA5', '#A78BFA'],
        })
        confettiRef.current({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.65 },
          colors: ['#7C3AED', '#06FFA5', '#A78BFA'],
        })
      }, 250)
    }
  }))

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    />
  )
})
