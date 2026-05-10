import { useEffect, useRef } from 'react'

/**
 * Black hole canvas — rotating vortex with 200 star particles spiraling inward.
 * 1 full rotation every 45 seconds (very slow / hypnotic).
 */
export function BlackHoleCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animId
    let width, height, cx, cy

    function resize() {
      width  = canvas.width  = window.innerWidth
      height = canvas.height = window.innerHeight
      cx = width  / 2
      cy = height / 2
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Stars ──────────────────────────────────────────────
    const STAR_COUNT = 220
    const stars = Array.from({ length: STAR_COUNT }, () => initStar())

    function initStar(existing) {
      // Start stars at a random radius from center, random angle
      const minR = 60
      const maxR = Math.max(width, height) * 0.72
      const r = minR + Math.random() * (maxR - minR)
      const angle = Math.random() * Math.PI * 2
      return {
        r,
        angle,
        speed: 0.00018 + Math.random() * 0.00045, // angular speed (inward drift)
        size:  0.4 + Math.random() * 1.8,
        opacity: 0.25 + Math.random() * 0.65,
        drift: 0.15 + Math.random() * 0.4,  // spiraling inward speed (px per frame)
      }
    }

    // ── Render loop ────────────────────────────────────────
    let lastTime = performance.now()
    const VORTEX_PERIOD = 45000 // ms per rotation
    let elapsed = 0

    function draw(now) {
      const dt = now - lastTime
      lastTime = now
      elapsed += dt

      ctx.clearRect(0, 0, width, height)

      // ── Draw radial vortex gradient ──
      const vortexAngle = (elapsed / VORTEX_PERIOD) * Math.PI * 2
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.55)
      grad.addColorStop(0,   'rgba(0,0,0,0.98)')
      grad.addColorStop(0.18,'rgba(20,5,50,0.85)')
      grad.addColorStop(0.42,'rgba(62,20,120,0.45)')
      grad.addColorStop(0.72,'rgba(40,10,80,0.2)')
      grad.addColorStop(1,   'rgba(10,10,15,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

      // ── Draw spiral arms (subtle) ──
      for (let arm = 0; arm < 3; arm++) {
        const armAngle = vortexAngle + (arm * Math.PI * 2) / 3
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(armAngle)
        const armGrad = ctx.createLinearGradient(0, 0, 200, 0)
        armGrad.addColorStop(0, 'rgba(124,58,237,0.18)')
        armGrad.addColorStop(1, 'rgba(124,58,237,0)')
        ctx.fillStyle = armGrad
        ctx.beginPath()
        ctx.ellipse(80, 0, 140, 18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // ── Draw event horizon ring ──
      const ringGrad = ctx.createRadialGradient(cx, cy, 38, cx, cy, 72)
      ringGrad.addColorStop(0, 'rgba(124,58,237,0)')
      ringGrad.addColorStop(0.5,'rgba(124,58,237,0.25)')
      ringGrad.addColorStop(1, 'rgba(124,58,237,0)')
      ctx.fillStyle = ringGrad
      ctx.beginPath()
      ctx.arc(cx, cy, 72, 0, Math.PI * 2)
      ctx.fill()

      // ── Animate & draw stars ──
      for (const s of stars) {
        // Spiral inward
        s.r -= s.drift * (dt / 16)
        s.angle += s.speed * dt

        // Compute position
        const x = cx + Math.cos(s.angle) * s.r
        const y = cy + Math.sin(s.angle) * s.r

        // Recycle when near center
        if (s.r < 30) {
          s.r = 200 + Math.random() * (Math.max(width, height) * 0.55)
          s.angle = Math.random() * Math.PI * 2
        }

        // Fade near center
        const fade = Math.min(1, (s.r - 30) / 80)

        ctx.beginPath()
        ctx.arc(x, y, s.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.opacity * fade})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
