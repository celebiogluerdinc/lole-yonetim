import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lole Yönetim',
  description: 'Çok şirketli personel ve görev yönetimi',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Lole' },
  icons: { apple: '/icons/icon-192.png' }
};

export const viewport: Viewport = {
  themeColor: '#1C1C1E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' // iOS: enables env(safe-area-inset-*) under the home indicator
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
