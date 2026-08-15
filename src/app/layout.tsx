import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LOLE Finans & Muhasebe',
  description: 'LOLE Grup — Finans & Muhasebe Yönetim Sistemi',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'LOLE', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // C6 (WCAG 1.4.4): maximumScale/userScalable kaldırıldı — kullanıcı yakınlaştırma engellenmez
  themeColor: '#0c1322',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
