import type { Config } from 'tailwindcss';

export default {
  content: [
    './apps/**/*.{ts,tsx,html}',
    './packages/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        neon: '#57f287'
      }
    }
  },
  plugins: []
} satisfies Config;
