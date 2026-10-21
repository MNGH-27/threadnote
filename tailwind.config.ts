import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
      },
      fontFamily: { sans: ["Inter", "Segoe UI", "sans-serif"] },
      boxShadow: { panel: "0 18px 45px rgba(0,0,0,.22)" },
    },
  },
  plugins: [],
} satisfies Config;
