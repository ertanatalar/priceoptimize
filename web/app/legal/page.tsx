import {
  ArrowLeft,
  CreditCard,
  Database,
  FileKey2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

export const metadata = {
  title: 'Gizlilik ve Güvenlik | Price Optimizer',
  description: 'Price Optimizer veri işleme, saklama ve güvenlik özeti',
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#f4f7f7] px-5 py-10 text-slate-700">
      <div className="mx-auto max-w-4xl">
        <a
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="size-4" />
          Panele dön
        </a>
        <div className="rounded-3xl bg-[#0b1720] p-7 text-white md:p-10">
          <p className="text-sm font-semibold text-[#28d7a1]">
            Gizlilik merkezi · Sürüm 12 Eylül 2026
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Verinizin amacı, süresi ve kontrolü açık olmalı.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Price Optimizer, rakip fiyat izleme hizmetini sunmak için gerekli en
            az veriyi işler. Özel nitelikli kişisel veri, parola, ödeme kartı,
            telefon, posta adresi, kesin konum, kimlik belgesi veya ham IP
            adresi uygulama veritabanında tutulmaz.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Policy icon={<Database />} title="Saklanan veriler">
            Kuruluş adı ve kodu, doğrulanmış hesap e-postası, üyelik rolü,
            müşteri adı/kodu ve giriş-bildirim e-postası, rakip ürün URL’leri,
            fiyat gözlemleri, sözleşme kabul kayıtları ve güvenlik denetim
            olayları.
          </Policy>
          <Policy icon={<FileKey2 />} title="İşleme amaçları">
            Hizmeti sunmak, müşteriyi kendi kaydıyla eşleştirmek, kullanıcı
            yetkisini doğrulamak, fiyat takibi ve bildirim üretmek, kötüye
            kullanımı önlemek, yasal talepleri yanıtlamak ve güvenlik olaylarını
            araştırmak.
          </Policy>
          <Policy icon={<Trash2 />} title="Saklama ve imha">
            Fiyat gözlemleri varsayılan 730 gün; denetim ve imha kanıtları 1.095
            gün tutulur. Müşteri “Hesabımı ve verilerimi sil” dediğinde
            tanımlayıcı alanlar ve fiyat içeriği hemen silinir veya
            anonimleştirilir; yalnızca takma adlı imha kanıtı kalır.
          </Policy>
          <Policy icon={<ShieldCheck />} title="Güvenlik kontrolleri">
            Kuruluş ve müşteri bazlı erişim ayrımı, sunucu tarafı rol denetimi,
            aktarımda TLS, gizli bağlantı bilgileri, sorgu parametreleme,
            güvenlik başlıkları, olay ve imha kayıtları ile en az yetki
            yaklaşımı uygulanır.
          </Policy>
          <Policy icon={<CreditCard />} title="Ödeme ve faturalandırma">
            Kart ve ödeme bilgileri Price Optimizer MySQL veritabanında
            tutulmaz. Abonelik ödemesi, vergi hesaplama, fatura, yenileme,
            başarısız ödeme ve iptal işlemleri ödeme hizmeti sağlayıcısı Paddle
            tarafından yürütülür. Uygulama yalnızca sağlayıcı müşteri/abonelik
            kimliklerini ve hizmete erişim için gerekli abonelik durumunu
            saklar.
          </Policy>
        </div>
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-950">
            Haklarınız ve başvuru
          </h2>
          <p className="mt-3 leading-7">
            GDPR ve KVKK kapsamındaki erişim, düzeltme, silme, işlemeyi
            kısıtlama, veri taşınabilirliği ve itiraz taleplerinizi paneldeki
            “Verilerime erişim talebi” üzerinden veya{' '}
            <a
              className="font-medium text-emerald-700 underline"
              href="mailto:admin@priceoptimize.ai"
            >
              admin@priceoptimize.ai
            </a>{' '}
            adresinden iletebilirsiniz. Kimlik doğrulamasından sonra talep en
            geç 30 gün içinde sonuçlandırılmak üzere kayda alınır.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Bu sayfa ürünün teknik veri işleme özetidir; tek başına hukuki uyum
            veya sertifika garantisi değildir. Şirket unvanı, veri
            sorumlusu/temsilci bilgileri, alt işleyenler, uluslararası aktarım
            mekanizması, VERBİS durumu ve ülkeye özel yasal süreler hukuk
            danışmanınız tarafından tamamlanmalıdır.
          </p>
        </section>
      </div>
    </main>
  );
}

function Policy({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 [&>svg]:size-5">
        {icon}
      </div>
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
    </section>
  );
}
