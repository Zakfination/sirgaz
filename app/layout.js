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
  title: 'sirgaZ — AI Matchmaking for Nightlife',
  description:
    'The premium AI matchmaking layer for clubs, festivals, concerts and nightlife.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050505',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased font-sans bg-[--sirgaz-bg] text-white selection:bg-white/15 selection:text-white">
        {children}
      </body>
    </html>
  );
}
