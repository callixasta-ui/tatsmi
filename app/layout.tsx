import "./globals.css";

export const metadata = {
  title: "GDS Command Trainer",
  description: "A browser-based Amadeus-style GDS cryptic command trainer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
