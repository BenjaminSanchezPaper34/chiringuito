/** Tailwind compile en build (remplace le Play CDN) — union des configs inline des pages */
module.exports = {
  content: ['./index.html', './404.html', './**/index.html', '!./node_modules/**'],
  theme: {
    extend: {
      colors: {
        brand: '#009BA4',
        'brand-dark': '#007A82',
        'brand-light': '#00B8C4',
        text: '#575756',
        'text-light': '#8A8A89',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Parisienne', 'cursive'],
      },
    },
  },
};
