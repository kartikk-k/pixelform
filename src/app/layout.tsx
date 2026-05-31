import type { Metadata } from "next";
import { Geist, Geist_Mono, Stack_Sans_Notch } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const stackSansNotch = Stack_Sans_Notch({
  variable: "--font-stack-sans-notch",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pixelform",
  description: "Pixelform is a tool for creating pixel art and exporting as SVG",
  metadataBase: new URL("https://pixelform.vercel.app"),
  openGraph: {
    title: "Pixelform",
    description: "A grid-based SVG painting tool for creating abstract shapes, logos, and graphic design elements.",
    url: "https://pixelform.vercel.app",
    siteName: "Pixelform",
    images: [
      {
        url: "/preview.png",
        width: 1470,
        height: 741,
        alt: "Pixelform — Grid-based SVG painting tool",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pixelform",
    description: "A grid-based SVG painting tool for creating abstract shapes, logos, and graphic design elements.",
    images: ["/preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${stackSansNotch.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
