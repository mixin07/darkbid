/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        /* shadcn compat */
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "var(--violet-500)",
          foreground: "var(--text-primary)",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "var(--error)",
          foreground: "var(--text-primary)",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "var(--bg-surface)",
          foreground: "var(--text-primary)",
        },
        /* PRD tokens */
        'db-base':    '#0A0A0F',
        'db-surface': '#12121A',
        'db-border':  '#1E1E2E',
        'violet':     '#7C3AED',
        'violet-l':   '#A78BFA',
        'neon-green': '#06FFA5',
        'amber':      '#FFA500',
        'hot-pink':   '#FF3B5C',
      },
      boxShadow: {
        'glow-v':    '0 0 32px rgba(124,58,237,0.25)',
        'glow-v-lg': '0 0 64px rgba(124,58,237,0.4)',
        'glow-g':    '0 0 32px rgba(6,255,165,0.2)',
        'glow-a':    '0 0 32px rgba(255,165,0,0.2)',
        'card':      '0 4px 24px rgba(0,0,0,0.4)',
        'modal':     '0 16px 64px rgba(0,0,0,0.5)',
        'raised':    '0 8px 32px rgba(0,0,0,0.35)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        'glow-pulse':  'glow-pulse 2s ease-in-out infinite',
        'glow-green':  'glow-green-pulse 2s ease-in-out infinite',
        'float':       'float-up 3s ease-in-out infinite',
        'spin-slow':   'spin-slow 8s linear infinite',
        'pulse-badge': 'pulse-badge 2s ease-in-out infinite',
        'slide-toast': 'slide-in-toast 0.4s ease-out',
      },
    },
  },
  plugins: [],
}
