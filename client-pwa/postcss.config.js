// Tailwind CSS v4+: the PostCSS plugin moved to '@tailwindcss/postcss'
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss(),
    autoprefixer(),
  ],
};
