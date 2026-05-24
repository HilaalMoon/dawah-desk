/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f5f1e8",
        ink: "#1f2937",
        olive: "#55624c",
        gold: "#b38a3e",
        mist: "#edf2ef",
      },
      boxShadow: {
        panel: "0 10px 30px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: ["Segoe UI", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};
