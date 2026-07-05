import type { Config } from "tailwindcss";

/**
 * Premier Clean & Seal — brand tokens
 * Extracted directly from the company logo:
 *   slate  #58606B  (logo background — sidebar & dark surfaces)
 *   silver #D9D9D9  (logo lettering — text on dark)
 *   plum   #3C2263  (logo swoosh — primary accent)
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        // Raw brand values, available everywhere as bg-brand-plum etc.
        brand: {
          slate: "#58606B",
          "slate-deep": "#454C56",
          "slate-ink": "#2E333B",
          silver: "#D9D9D9",
          plum: "#3C2263",
          "plum-bright": "#6A46A8",
          "plum-soft": "#EDE7F6",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "swoosh-in": {
          from: { strokeDashoffset: "320" },
          to: { strokeDashoffset: "0" },
        },
      },
      animation: { "swoosh-in": "swoosh-in 900ms ease-out forwards" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
