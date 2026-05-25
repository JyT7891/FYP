/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map your CSS variables to Tailwind colors
        'text': 'var(--text)',
        'text-h': 'var(--text-h)',
        'bg': 'var(--bg)',
        'border': 'var(--border)',
        'code-bg': 'var(--code-bg)',
        'accent': 'var(--accent)',
        'accent-bg': 'var(--accent-bg)',
        'accent-border': 'var(--accent-border)',
      },
      fontFamily: {
        'sans': ['system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
        'mono': ['ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}