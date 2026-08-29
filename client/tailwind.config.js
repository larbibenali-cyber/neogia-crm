/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4527EA',
          50: '#F1EEFE',
          100: '#E3DDFD',
          200: '#C7BBFB',
          300: '#AB99F9',
          400: '#8F77F5',
          500: '#6B4FF0',
          600: '#4527EA',
          700: '#3620BB',
          800: '#28188C',
          900: '#1A105D',
        },
        slate2: {
          DEFAULT: '#8D9AB0',
          50: '#F5F6F8',
          100: '#EBEDF1',
          200: '#D3D8E0',
          300: '#BBC2CF',
          400: '#A3ACBF',
          500: '#8D9AB0',
          600: '#6E7C95',
          700: '#556076',
          800: '#3D4657',
          900: '#252C38',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(26,16,93,0.06), 0 1px 3px 0 rgba(26,16,93,0.08)',
        'card-hover': '0 4px 12px 0 rgba(26,16,93,0.10)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
};
