import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';
import PwaBoot from '@/components/PwaBoot';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Super M AI — Australian Price Comparison',
  description:
    'AI-powered grocery & product price comparison across Coles, Woolworths, Aldi, IGA, Costco, Harris Farm and Amazon AU.',
  applicationName: 'Super M AI',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.ico', apple: '/apple-icon' },
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Super M AI',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Super M AI',
    description: 'Find the cheapest grocery prices across all major Australian supermarkets.',
    type: 'website',
    url: appUrl,
    siteName: 'Super M AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Super M AI',
    description: 'Find the cheapest grocery prices across major Australian supermarkets.',
  },
};

export const viewport = {
  themeColor: '#0b1530',
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${spaceGrotesk.variable} min-h-screen hero-gradient antialiased`}>
        <PwaBoot />
        {children}
      </body>
    </html>
  );
}
