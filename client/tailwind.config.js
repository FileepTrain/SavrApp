/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include every file that can contain className usage so Tailwind generates styles.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        "app-background": "var(--color-app-background)",
        accent: "var(--color-accent)",
        icon: "var(--color-icon)",
        "muted-background": "var(--color-muted-background)",
        "muted-foreground": "var(--color-muted-foreground)",
        "red-primary": "var(--color-red-primary)",
        "red-secondary": "var(--color-red-secondary)",
      },
      fontFamily: {
        sans: "Roboto",
        "roboto-medium": "Roboto-Medium",
      },
    },
  },
  plugins: [],
};
