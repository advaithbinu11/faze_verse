import design from '../replica/design/tailwind.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [design],
  content: ['./index.html', './src/**/*.{js,jsx}'],
};
