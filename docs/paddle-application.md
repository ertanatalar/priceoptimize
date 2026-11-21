# Paddle başvuru dosyası — Price Optimizer

22 Kasım 2026. Kullanıcı tarafından onaylanan ticari bilgiler:

- Satıcı: **Ertan Atalar**, Türkiye’de ikamet eden birey. Kayıtlı şirket varmış gibi beyan yapılmaz.
- Marka: **Price Optimizer**.
- Destek: **admin@priceoptimize.ai** (gelen kutusunun teslim/alım kontrolü ayrıca yapılmalı).
- Ücretli paket: **Başlangıç / Starter — 29 USD, aylık, 50 aktif rakip link**.
- Deneme: 30 gün, 10 link, kartsız; otomatik ücretli geçiş yok.
- Yıllık paket, kullanım aşım ücreti veya başka ücretli paket açılmaz.

## Site incelemesinde kullanılacak adresler

- Ürün: https://www.priceoptimize.ai/
- Fiyat: https://www.priceoptimize.ai/pricing
- Kullanım koşulları: https://www.priceoptimize.ai/terms
- İade/iptal: https://www.priceoptimize.ai/refunds
- Gizlilik: https://www.priceoptimize.ai/privacy
- İletişim: https://www.priceoptimize.ai/contact

## İngilizce ürün açıklaması

Price Optimizer is a subscription-based competitor price monitoring application for online sellers. Customers add competitor product-page URLs and organize them into product groups. The application provides price comparisons, observation history, price-change email notifications and anomaly filtering. Supported public pages are checked on a six-hour target schedule. Pages requiring browser interaction may require customer-confirmed Chrome checks; authentication and CAPTCHA are not bypassed. The software does not change prices in customer stores or marketplaces. The Starter plan costs USD 29 per month and includes up to 50 active competitor URLs. A 30-day card-free trial includes 10 URLs and does not automatically convert to a paid subscription.

## Paddle panelinde tanımlanacak ürün

- Product name: Price Optimizer Starter.
- Description: Competitor price monitoring for up to 50 active URLs.
- Price: USD 29.00 (API amount `2900`).
- Billing interval: month, frequency 1; recurring quantity 1.
- Vergi kategorisi ve vergi dahil/hariç seçimi gerçek hizmete göre Paddle panelinde doğrulanmalı. Sitedeki fiyat tabanı ile checkout toplamının açıklaması tutarlı olmalı.
- Uygulama denemesi kartsızdır; Paddle ürününe ayrıca otomatik ücretli trial eklenmemeli.
- Sandbox ve live fiyatları/anahtarları ayrıdır. API anahtarı portal oturumu oluşturma ve fiyat okuma yetkilerine ihtiyaç duyar; daha geniş yetki verilmemeli.

## Yayınlanan kodun kapsamı

Genel fiyat/yasal/destek sayfaları ve menü bağlantıları, panelde paket bilgisi, tenant bazında 50 aktif link / trial için 10 link kontrolü, toplu içe aktarmanın tek işlemde geri alınması, Paddle fiyatının 29 USD/ay olarak doğrulanması hazırlanır. Satın alma sırları olmadan ödeme açılamaz. Kod yayını Paddle hesabı/onayı veya gerçek tahsilat değildir.

## Başvuru ve canlı tahsilat için hâlâ kullanıcı/harici kanıt gerekenler

- Paddle hesabı açılmadı. Kullanıcı doğrudan resmi Paddle ekranında bireysel başvuru yapmalı; sözleşmeleri kendisi kabul etmeli.
- Kimlik, gerçek ikamet/tebligat adresi, varsa vergi bilgisi ve ödeme alma hesabı Paddle'ın güvenli ekranında tamamlanmalı. Belgeler Git veya sohbete konmamalı.
- Gerekli satıcı/aydınlatma adresinin kamuya açık metne nasıl dahil edileceği ve yurt dışı veri aktarım mekanizmaları gerçek bilgilerle hukuken tamamlanmalı. Genel sayfaların varlığı tek başına KVKK/GDPR uygunluğu değildir.
- Domain incelemesi ve kimlik/payout onayı Paddle tarafından verilmeli.
- Türkiye’de faaliyetin vergi ve belge düzeni mali müşavirle netleştirilmeli.
- Sandbox ürün/fiyat, anahtarlar, webhook hedefi tanımlanıp başarılı ödeme, portal, yenileme, iptal ve iade testleri yapılmalı.
- Önceki hazırlık raporundaki webhook eşzamanlılık, gecikmiş olay kurtarma, plan/fiyat eşleştirme ve ücretli trial durum testleri tamamlanmadan canlı tahsilat açılmamalı.
- Mevcut gerçek fiyat takip linkleriyle güncellik ve ürün eşleşmesi yeniden doğrulanmalı; gözlem başarı testi yapılmadan her sitede otomatik takip vaat edilmemeli.

## Yayın sırası

Backend yeni quota korumalı işlemi önce desteklemeli, ardından web yayını doğrulanmalı. Her iki Render servisi aynı yeni commit'e ulaştıktan sonra kaynak sınırı ve sayfalar canlıda kontrol edilir. Veritabanında yeni şema veya kullanıcı verisi silme işlemi gerekmez. Daha önce limiti aşmış hesapların kayıtları silinmez; yeni link içe aktarmaları sınır içine dönülene kadar reddedilir.
