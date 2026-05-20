import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secret Claw — Deploy your agent",
  description:
    "Deploy your own private AI agent on SecretVM. Powered by the SecretAI Developer Portal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-portal-bg font-sans text-portal-text antialiased">
        {children}
      </body>
    </html>
  );
}
