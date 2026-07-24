import './globals.css';
import { Inter, Instrument_Serif } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

export const metadata = {
  title: 'MAXE CLASS · Anniversary — Powered by sirgaZ',
  description:
    'The official digital experience for MAXE CLASS Anniversary. Connect. Celebrate. Together.',
  icons: {
    icon: '/brand/maxe-class-logo.png',
    shortcut: '/brand/maxe-class-logo.png',
    apple: '/brand/maxe-class-logo.png',
  },
  openGraph: {
    title: 'MAXE CLASS · Anniversary',
    description: 'The official digital experience for MAXE CLASS Anniversary.',
    images: ['/brand/maxe-class-logo.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#09090B',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased font-sans bg-[--sirgaz-bg] text-white selection:bg-[#C4FF00]/25 selection:text-white">
        {children}
      </body>
    </html>
  );
}
