import './globals.css'

export const metadata = {
  title: 'sirgaZ — Kalo Lu Sir, Ya Gazz',
  description: 'AI Matchmaking for clubs, festivals, concerts and nightlife.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
