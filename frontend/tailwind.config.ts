import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0A0A0F",
          secondary: "#13131A",
          surface: "#1C1C28",
        },
        accent: {
          primary: "#7C3AED",
          secondary: "#06D6A0",
        },
        brand: {
          warning: "#F59E0B",
          danger: "#EF4444",
        },
        text: {
          primary: "#F8F8FF",
          secondary: "#9594A8",
        },
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "fade-up": "fade-up 0.3s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        "particle-burst": "particle-burst 0.6s ease-out forwards",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 5px #7C3AED40" },
          "50%": { boxShadow: "0 0 20px #7C3AED80, 0 0 40px #7C3AED40" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "particle-burst": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(2)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-cyber": "linear-gradient(135deg, #7C3AED20, #06D6A020)",
      },
    },
  },
  plugins: [],
};

export default config;
