import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "GDS Command Trainer",
  description: "A browser-based Amadeus-style GDS cryptic command trainer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        {/* GDS Study Buddy chat widget -- config.js must load before widget.js */}
        <script src="/config.js" />
        <script src="/widget.js" />
      </body>
    </html>
  );
}
