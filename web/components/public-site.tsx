import { getTranslator } from '@/lib/i18n-server';
import { Tags } from 'lucide-react';

export const seller = { name: 'Ertan Atalar', brand: 'Price Optimizer', email: 'admin@priceoptimize.ai' };

export async function PublicSite({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getTranslator();

  return <div className="min-h-screen bg-[#f4f7f7] text-[#0b1720]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-5">
      <a href="/" className="flex items-center gap-3 font-semibold"><span className="grid size-10 place-items-center rounded-xl bg-[#28d7a1]"><Tags className="size-5" /></span>Price Optimizer</a>
      <nav aria-label={t("Ana menü")} className="flex flex-wrap items-center gap-5 text-sm font-medium"><a href="/pricing">{t("Fiyatlandırma")}</a><a href="/contact">{t("Destek")}</a><a href="/auth/login" className="rounded-lg bg-[#0b1720] px-4 py-2.5 text-white">{t("Giriş yap")}</a></nav>
    </div></header>
    {children}
    <footer className="mt-16 border-t border-slate-200 bg-white"><div className="mx-auto max-w-6xl px-5 py-8"><p className="text-sm font-medium">{t("Price Optimizer · Ertan Atalar")}</p><nav aria-label={t("Yasal bilgiler")} className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600"><a href="/pricing">{t("Fiyatlandırma")}</a><a href="/terms">{t("Kullanım koşulları")}</a><a href="/refunds">{t("İade ve iptal")}</a><a href="/privacy">{t("Gizlilik")}</a><a href="/contact">{t("İletişim")}</a></nav><p className="mt-5 text-sm text-slate-500">{t("© 2026 Price Optimizer.")}{' '}<a href={`mailto:${seller.email}`} className="underline">{seller.email}</a></p></div></footer>
  </div>;
}

export async function PolicyPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  const { t, locale } = await getTranslator();

  return <PublicSite><main className="mx-auto max-w-3xl px-5 py-14"><p className="text-sm font-semibold text-emerald-700">{t("Price Optimizer · 22 Kasım 2026")}</p><h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1><p className="mt-5 text-lg leading-8 text-slate-600">{intro}</p><div className="mt-9 space-y-8 rounded-3xl bg-white p-6 leading-7 shadow-sm ring-1 ring-slate-200 md:p-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:text-emerald-800 [&_a]:underline">{children}</div></main></PublicSite>;
}
