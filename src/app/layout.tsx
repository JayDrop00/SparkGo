import type { Metadata } from "next";
import { Poppins, Orbitron, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import FloatingControls from "@/components/ui/FloatingControls";
import "./globals.css";

// ← your existing font(s) stay as they are
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-poppins",
});

// ← NEW: the three landing-page fonts
const display = Orbitron({
  subsets: ["latin"],
  weight: ["600", "800", "900"],
  variable: "--nf-display",
  display: "swap",
});
const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--nf-ui",
  display: "swap",
});
const data = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--nf-data",
  display: "swap",
});

export const metadata: Metadata = {
  // ← keep your existing metadata
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash of the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("sparkgo-theme");if(t==="solar"||t==="violet")document.documentElement.dataset.theme=t}catch(e){}})()',
          }}
        />
      </head>
      <body
        className={`${poppins.variable} ${display.variable} ${ui.variable} ${data.variable}`}
      >
        {children}
        <FloatingControls />
      </body>
    </html>
  );
}