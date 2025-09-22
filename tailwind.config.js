const {heroui} = require('@heroui/theme');
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./public/index.html",
    "./node_modules/@heroui/theme/dist/components/(avatar|button|card|dropdown|input|modal|snippet|user|ripple|spinner|menu|divider|popover|form).js"
  ],
  theme: { extend: {} },
  plugins: [heroui()],
}