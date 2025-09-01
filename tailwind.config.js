/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './electron/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Game-specific color palette
      colors: {
        game: {
          primary: '#1a202c',
          secondary: '#2d3748',
          accent: '#3182ce',
          success: '#38a169',
          warning: '#d69e2e',
          error: '#e53e3e',
          ui: {
            background: '#f7fafc',
            surface: '#ffffff',
            border: '#e2e8f0',
            text: '#2d3748',
            muted: '#718096',
          },
        },
      },
      // Game development specific spacing
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },
      // Animation for game UI
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      // Game UI specific font sizes
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        'game-title': '4rem',
        'game-subtitle': '2.5rem',
      },
    },
  },
  plugins: [
    // Add plugins as needed for game development
  ],
  // Optimize for production builds
  corePlugins: {
    // Disable unused features for smaller bundle size
    preflight: true,
  },
  // Dark mode support for game themes
  darkMode: 'class',
};
