import { getTranslator } from '@/lib/i18n-server';
import { ArrowRight, CheckCircle2, ShieldCheck, Tags } from 'lucide-react';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { PriceDashboard } from '@/app/price-dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) return <Welcome />;
  return <PriceDashboard userEmail={user.email} />;
}

async function Welcome() {
  const { t, locale } = await getTranslator();

  return (
    <main className="min-h-screen bg-[#07131c] px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#28d7a1] text-[#08201a]"><Tags className="size-5" /></span>
            <div><p className="font-semibold">Price Optimizer</p><p className="text-xs text-slate-400">{t("Rakip fiyat merkezi")}</p></div>
          </div>
          <nav className="flex flex-wrap items-center gap-5 text-sm"><a href="/pricing" className="font-semibold text-[#28d7a1]">{t("Fiyatlandırma · 29 USD / ay")}</a><a href="/auth/login" className="rounded-lg border border-white/20 px-4 py-2 font-semibold hover:bg-white/10">{t("Giriş yap")}</a></nav>
        </header>
        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-4 text-sm font-semibold text-[#28d7a1]">{t("30 GÜN ÜCRETSİZ DENEYİN")}</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-.045em] sm:text-6xl">{t("Rakip fiyatlarını tek panelden güvenle izleyin.")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{t("Müşteri, ürün grubu ve rakip URL’lerini birbirinden ayrılmış kayıtlarla yönetin. Kredi kartı gerekmeden 30 günlük denemenizi başlatın.")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/auth/login?screenHint=signup" className="inline-flex items-center gap-2 rounded-xl bg-[#28d7a1] px-5 py-3 font-semibold text-[#08201a] hover:bg-[#35e7b0]">{t("Ücretsiz kaydol")}{' '}<ArrowRight className="size-4" /></a>
              <a href="/auth/login" className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">{t("Zaten hesabım var")}</a>
            </div>
            <p className="mt-4 text-sm text-slate-400">{t("30 gün · 10 link · Kredi kartı gerekmez. Devam etmek isterseniz aylık 29 USD ile 50 link. Otomatik ücretli geçiş yok.")}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur">
            <p className="text-sm font-semibold text-slate-300">{t("Deneme paketine dahil")}</p>
            <div className="mt-5 space-y-4">
              {[t("Müşteri ve ürün grubu yönetimi"),t("Rakip URL ve fiyat geçmişi"),t("%25 aşırı fiyat düşüş filtresi"),t("Kuruluş bazlı veri ayrımı"),t("Kendi verilerinizi indirme ve silme talebi")].map((item) => (
                <p key={item} className="flex items-center gap-3 text-slate-100"><CheckCircle2 className="size-5 shrink-0 text-[#28d7a1]" />{item}</p>
              ))}
            </div>
            <div className="mt-7 flex items-start gap-3 rounded-2xl bg-black/20 p-4 text-sm text-slate-300"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#28d7a1]" /><p>{t("Parolalar ve ödeme kartı bilgileri Price Optimizer MySQL veritabanında saklanmaz.")}</p></div>
          </div>
        </section>
        <footer className="flex flex-wrap justify-between gap-5 border-t border-white/10 py-5 text-sm text-slate-400"><span>{t("© 2026 Price Optimizer · Ertan Atalar")}</span><nav className="flex flex-wrap gap-5"><a href="/pricing">{t("Fiyatlandırma")}</a><a href="/terms">{t("Kullanım koşulları")}</a><a href="/refunds">{t("İade ve iptal")}</a><a href="/privacy">{t("Gizlilik")}</a><a href="/contact">{t("İletişim")}</a></nav></footer>
      </div>
    </main>
  );
}
