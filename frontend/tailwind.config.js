/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Trending Coolors Palette: Warm Editorial Neutrals (edede9 - d6ccc2 - f5ebe0 - e3d5ca - d5bdaf)
        obsidian: {
          950: "#F5EBE0", // Soft Cream (Canvas base background)
          900: "#EDEDE9", // Alabaster (Sidebar & Header surface)
          850: "#FAF7F2", // Crisp Warm White (Message item surface)
          800: "#FFFFFF", // Pure White (Cards & Input box)
          700: "#E3D5CA", // Warm Sand (Active tabs & hover states)
          600: "#D6CCC2", // Bone Gray (Borders, dividers & outlines)
          500: "#8C827A", // Muted neutral labels & timestamps
          400: "#6E675F", // Secondary warm slate text
          300: "#44403C", // Deep warm charcoal text
          200: "#292524", // Body copy text (AAA contrast)
          100: "#1C1917", // Primary high-contrast text
          50: "#0C0A09",  // Heading accents
        },
        brand: {
          cream: "#F5EBE0",
          alabaster: "#EDEDE9",
          bone: "#D6CCC2",
          sand: "#E3D5CA",
          taupe: "#D5BDAF",
          teal: "#3F625D",   // Deep Sage (Grounded QA mode)
          cyan: "#4E7973",
          sky: "#3F625D",    // Primary Accent mapped to Sage
          skyDark: "#2D4844",
          gold: "#9C6644",   // Warm Walnut (Ship 30 for 30 mode)
          goldDark: "#7F5539",
          emerald: "#2D6A4F",
          emeraldDark: "#1B4332",
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-merriweather)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"]
      }
    },
  },
  plugins: [],
};
