import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Price Optimizer',
  description: 'Güvenli, çok müşterili rakip fiyat ve URL izleme platformu',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
