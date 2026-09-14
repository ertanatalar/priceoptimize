import { ArrowRight, CheckCircle2, ShieldCheck, Tags } from 'lucide-react';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { PriceDashboard } from '@/app/price-dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) return <Welcome />;
  return <PriceDashboard userEmail={user.email} />;
}

function Welcome() {
  return (
    <main className="min-h-screen bg-[#07131c] px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#28d7a1] text-[#08201a]"><Tags className="size-5" /></span>
            <div><p className="font-semibold">Price Optimizer</p><p className="text-xs text-slate-400">Rakip fiyat merkezi</p></div>
          </div>
          <a href="/auth/login" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Giriş yap</a>
        </header>
        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-4 text-sm font-semibold text-[#28d7a1]">30 GÜN ÜCRETSİZ DENEYİN</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-.045em] sm:text-6xl">Rakip fiyatlarını tek panelden güvenle izleyin.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Müşteri, ürün grubu ve rakip URL’lerini birbirinden ayrılmış kayıtlarla yönetin. Kredi kartı gerekmeden 30 günlük denemenizi başlatın.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/auth/login?screenHint=signup" className="inline-flex items-center gap-2 rounded-xl bg-[#28d7a1] px-5 py-3 font-semibold text-[#08201a] hover:bg-[#35e7b0]">Ücretsiz kaydol <ArrowRight className="size-4" /></a>
              <a href="/auth/login" className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">Zaten hesabım var</a>
            </div>
            <p className="mt-4 text-sm text-slate-400">Deneme süresi kayıt tamamlandığında başlar ve 30 gün sürer.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur">
            <p className="text-sm font-semibold text-slate-300">Deneme paketine dahil</p>
            <div className="mt-5 space-y-4">
              {['Müşteri ve ürün grubu yönetimi','Rakip URL ve fiyat geçmişi','%25 aşırı fiyat düşüş filtresi','Kuruluş bazlı veri ayrımı','Kendi verilerinizi indirme ve silme talebi'].map((item) => (
                <p key={item} className="flex items-center gap-3 text-slate-100"><CheckCircle2 className="size-5 shrink-0 text-[#28d7a1]" />{item}</p>
              ))}
            </div>
            <div className="mt-7 flex items-start gap-3 rounded-2xl bg-black/20 p-4 text-sm text-slate-300"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#28d7a1]" /><p>Parolalar ve ödeme kartı bilgileri Price Optimizer MySQL veritabanında saklanmaz.</p></div>
          </div>
        </section>
        <footer className="flex flex-wrap justify-between gap-3 border-t border-white/10 py-5 text-xs text-slate-500"><span>© 2026 Price Optimizer</span><a href="/legal" className="hover:text-white">Gizlilik ve veri güvenliği</a></footer>
      </div>
    </main>
  );
}
