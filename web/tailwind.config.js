/** @type {import('tailwindcss').Config} */
export default {
  // Keep the production web deployment self-contained. The design config is
  // generated in ../replica during local development, but Vercel deploys this
  // directory as the project root and does not include that parent directory.
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        'border-input': 'var(--color-border-input)',
        text: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        'on-accent': 'var(--color-on-accent)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        'accent-text': 'var(--color-accent-text)',
      },
      fontFamily: { display: ['var(--font-display)'], sans: ['var(--font-sans)'], mono: ['var(--font-mono)'] },
      fontSize: {
        xs: ['12px', { lineHeight: '18px', fontWeight: '700' }],
        sm: ['14px', { lineHeight: '21px', fontWeight: '600' }],
        'body-sm': ['15px', { lineHeight: '22px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['22px', { lineHeight: '24px' }],
        xl: ['28px', { lineHeight: '29px' }],
        display: ['clamp(40px, 8vw, 76px)', { lineHeight: '1.02' }],
        score: ['clamp(34px, 7vw, 64px)', { lineHeight: '1' }],
        label: ['12px', { lineHeight: '18px', letterSpacing: '0.08em' }],
      },
      spacing: { 1.5: '6px', 2.5: '10px', 3.5: '14px' },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '14px' },
      borderWidth: { DEFAULT: '1px', control: '1.5px', 2: '2px', 3: '3px', 4: '4px' },
      maxWidth: { content: '980px', feed: '640px', dialog: '460px' },
      screens: { stack: { max: '780px' } },
      transitionDuration: { fast: '250ms', base: '400ms' },
    },
  },
  content: ['./index.html', './src/**/*.{js,jsx}'],
};
