import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#081428',
        panel: '#0E2140',
        'panel-deep': '#0A1A31',
        input: '#12294F',
        line: {
          DEFAULT: '#1E3A66',
          strong: '#2E5590',
          subtle: '#132A4D',
        },
        ink: {
          primary: '#F7E7C1',
          secondary: '#F0E4CC',
          muted: '#93AACB',
          faint: '#7E97BD',
          dim: '#5A76A0',
        },
        brand: {
          DEFAULT: '#F5911E',
          hover: '#FFA83E',
          light: '#FFB259',
        },
        up: {
          DEFAULT: '#6FBE44',
          deep: '#4B9A2E',
          light: '#8FD65C',
        },
        down: '#E8434F',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        sans: ['Archivo', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        ndFloat: {
          '0%,100%': { transform: 'translateY(0) rotate(-1deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1deg)' },
        },
        ndPump: {
          '0%,100%': { transform: 'translateY(0) scale(1)' },
          '40%': { transform: 'translateY(-16px) scale(1.03)' },
          '70%': { transform: 'translateY(-4px) scale(1)' },
        },
        ndDip: {
          '0%,100%': { transform: 'translateY(0) rotate(-4deg)' },
          '50%': { transform: 'translateY(7px) rotate(-7deg)' },
        },
        ndMarquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        ndIn: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        ndBurst: {
          '0%': { opacity: '0', transform: 'scale(.9)' },
          '12%': { opacity: '1', transform: 'scale(1)' },
          '78%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'scale(1.05)' },
        },
        ndPulse: { '0%,100%': { opacity: '.35' }, '50%': { opacity: '1' } },
      },
      animation: {
        ndFloat: 'ndFloat 5s ease-in-out infinite',
        ndPump: 'ndPump 1.6s ease-in-out infinite',
        ndDip: 'ndDip 3.4s ease-in-out infinite',
        ndMarquee: 'ndMarquee 38s linear infinite',
        ndIn: 'ndIn .4s ease',
        ndBurst: 'ndBurst 2.6s ease forwards',
        ndPulse: 'ndPulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
