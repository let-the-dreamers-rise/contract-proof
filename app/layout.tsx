import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ContractProof - Bob-Powered API Drift Guard",
  description: "Detect API contract drift across your entire stack before it reaches production. Powered by IBM Bob's full repository understanding.",
  keywords: ["API drift", "contract testing", "IBM Bob", "developer tools", "code analysis"],
  authors: [{ name: "ContractProof Team" }],
  openGraph: {
    title: "ContractProof - Bob-Powered API Drift Guard",
    description: "Detect API contract drift across your entire stack before it reaches production.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}

// Made with Bob
