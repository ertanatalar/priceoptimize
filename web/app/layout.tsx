import './globals.css';
import { getTranslator } from '@/lib/i18n-server';
import { I18nProvider, LanguageSelector } from '@/components/i18n-provider';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { const {t}=await getTranslator();return {title:'Price Optimizer',description:t('Güvenli, çok müşterili rakip fiyat ve URL izleme platformu')}; }
export default async function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  const {locale}=await getTranslator();
  return <html lang={locale}><body><I18nProvider locale={locale}><div className="flex justify-end border-b border-slate-200 bg-white px-5 py-2"><LanguageSelector /></div>{children}</I18nProvider></body></html>;
}
