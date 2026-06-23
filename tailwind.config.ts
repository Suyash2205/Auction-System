import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        court: {
          ink: "#13231d",
          line: "#e8f6ef",
          green: "#1f8f64",
          mint: "#c9f5d9",
          blue: "#1677a8",
          clay: "#d8643f",
          lime: "#d7f241"
        }
      },
      boxShadow: {
        glow: "0 18px 60px rgba(31, 143, 100, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
