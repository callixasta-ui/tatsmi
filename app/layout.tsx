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
      </body>
    </html>
  );
}
