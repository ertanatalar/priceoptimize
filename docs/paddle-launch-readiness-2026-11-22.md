# Price Optimizer — Paddle satışa hazırlık kaydı

Tarih: 22 Kasım 2026. İncelenen canlı dal: `codex/aiven-mysql-test`, başlangıç commit'i `8d9c1c3ce25d4a779f81501c5b701db0857df0f1`.

Durum: **Canlı ücretli satışa henüz hazır değil.** Bu belge Paddle onayı veya hukuki/vergi uygunluğu belgesi değildir. Eksikler tamamlandıkça kanıtla güncellenmelidir.

## Bireysel başvuru

Paddle'ın hesap doğrulama belgesi bireyler ve sole trader başvuruları için şirket doğrulaması istemediğini, kimlik doğrulamasının gerektiğini açıklar. Türkiye yayımlanan desteklenmeyen ülkeler listesinde değil; bu, tekil başvurunun kabul garantisi değildir. Satıcı kayıt, domain, kimlik ve ödeme alma hesabı incelemelerinin sonuçları Paddle hesabında ayrıca doğrulanmalı.

Paddle bir ürün mağazası olarak müşteri getirme garantisi vermez. Ürün kendi alan adında sunulur; Paddle ödeme ve abonelik altyapısı sağlar. Türkiye'deki gelir vergisi, faaliyet sınıflandırması, belge düzeni ve banka tahsilatı yükümlülükleri satıcının durumuna göre ayrıca değerlendirilmelidir. Mobil uygulama veya içerik üreticisi istisnasının bu web SaaS ürününe otomatik uygulandığı varsayılmamalı.

Kaynaklar:
- https://www.paddle.com/help/start/account-verification/what-is-account-verification
- https://www.paddle.com/help/start/account-verification/what-is-identity-verification
- https://www.paddle.com/help/start/account-verification/which-countries-are-supported-by-paddle
- https://www.gib.gov.tr/mevzuat/kanun/433/ozelge/39127 (başka bir faaliyete ilişkin özelge; doğrudan bu ürün için görüş değildir)

## Eksik ve kabul ölçütleri

| Öncelik | Konu | İnceleme sonucu | Tamamlanma kanıtı |
|---|---|---|---|
| Satış engeli | Satıcı hesabı | Hesap ve onay durumu bilinmiyor | Individual/sole trader seçimi gerçek duruma uygun; domain ve kimlik onayı tamam |
| Satış engeli | Ticari paket | Tutar, para birimi, aylık/yıllık dönem ve URL limitleri belirlenmedi | Kullanıcı tarafından onaylanmış paket; Paddle fiyatıyla aynı kamuya açık fiyat |
| Satış engeli | Kamuya açık sayfalar | Canlı kaynakta landing mevcut; ayrı fiyat, şartlar ve iade sayfaları yok | Giriş yapmadan ürün, fiyat/dönem, dahil özellikler, iptal/iade, gizlilik ve destek bağlantıları okunabilir |
| Satış engeli | Gerçek satıcı bilgileri | `/legal` teknik özet; veri sorumlusu ve aktarım ayrıntılarının tamamlanmasını istiyor | Doğru satıcı adı ve iletişim, işleyenler/aktarım bilgileriyle tutarlı metinler |
| Satış engeli | Ödeme yapılandırması | Önceki canlı panel ödeme yapılandırması bekliyor diyordu; güncel Paddle paneli incelenmedi | Sandbox ve live ürün/fiyat, client token, API anahtarı, webhook sırları ayrı ve doğru |
| Satış engeli | CSP | Eski `script-src 'self'` Paddle JS'yi; default-src ise dış checkout iframe'ini engelliyordu | Hazırlanan dar izin listesi sandbox'ta gerçek checkout ile doğrulanır |
| Satış engeli | Webhook eşzamanlılığı | Duplicate ve eski olay kontrolü SQL işlemi dışında; yarış koşuluna açık | Aynı/kesişen olaylarda tek işlem ve doğru son durum; DB üzerinde eşzamanlılık testi |
| Satış engeli | Webhook kayıp eşleşme | Eşleşmeyen olay işlendi olarak kaydedilip 200 dönüyor; checkout referansı 30 dakika sonra eşleşmiyor | Gecikmiş/sırası değişmiş olaylar kurtarılır; tekrar işleme/uzlaştırma mekanizması doğrulanır |
| Satış engeli | Plan doğrulaması | Webhook ilk item fiyatını kaydedip planı starter yapıyor; izin verilen fiyatla açık eşleştirme yok | Yanlış fiyat/ürün/miktar erişim vermez; doğru fiyat doğru plana eşlenir |
| Satış engeli | Abonelik yaşam döngüsü | Transaction olayları da abonelik durumunu değiştiriyor; ücretli trial yerel trial tarihini kullanıyor | Ödeme, trial, yenileme, gecikme, duraklatma, iptal ve yeniden abonelik sandbox testleri |
| Satış engeli | Gerçek fiyat hizmeti | Önceki incelemede eski fiyatlar ve ürün–URL uyuşmazlığı görüldü | Yeni müşteriyle doğru ürün üzerinde taze fiyat; erişim hatası ve eski veri açık gösterilir |
| Önemli | Kayıt/sözleşme kabulü | Canlı onboarding ve hukuki onay akışı uçtan uca doğrulanmadı | Doğrulanmış e-posta, açık kabul, metin sürümü, hesap/kuruluş izolasyonu ve giriş testi |
| Önemli | Paket limitleri | Fiyat kararı yok; limit uygulaması ayrıca denetlenecek | URL/müşteri/kullanıcı limitleri sunucuda uygulanır; satış metniyle aynı |
| Önemli | İptal sonrası erişim | Portal var; iptal ve yeniden başlatma davranışı doğrulanmadı | İptal dönem sonuna kadar erişimi korur; gerçek bitişte keser; tekrar satın alma çalışır |
| Önemli | Destek ve bildirim | Test domainli Resend göndereni önceki yapılandırmada var | Doğrulanmış gönderen alan adı; müşteriye değişiklik/bildirim teslimatı |
| Önemli | İşletim | Yedekten geri yükleme, alarm ve tahsilat uzlaştırması kanıtı yok | Geri yükleme denemesi, webhook hata alarmı, başarısız tarama ve abonelik uzlaştırma raporu |

## Bu turda hazırlanan teknik değişiklikler

- Sandbox/client token ile production/client token uyuşmazlığı ödeme sistemini hazır gösteremez.
- Eksik/boş sırlar, bilinmeyen ortam veya yanlış fiyat kimliği öneki checkout'u etkinleştiremez.
- Paddle JS, CSS, API ve iframe için yalnız resmi, açıkça listelenmiş adresler izinli; production CSP sandbox alan adlarını içermez. Resmi Paddle JS dosyasındaki adresler incelendi; geliştirme/staging ve isteğe bağlı ProfitWell adresleri eklenmedi. Sandbox'ta gerçek checkout hâlâ gerekli.
- Daha önce CI dışında kalan webhook imzası ve web birim testleri CI'a eklendi.
- Yerel 6 web birim testi, 11 güvenlik testi ve TypeScript kontrolü geçti. Sandbox ödeme yapılmadı; canlı ödeme etkinleştirilmedi.

## Sandbox kabul senaryoları

1. Yeni bağımsız kuruluş: kayıt → e-posta doğrulama → onboarding → ürün ve rakip URL → taze gözlem.
2. Checkout doğru fiyat, para birimi ve dönemi gösterir. Vazgeçme ve başarısız ödeme erişim açmaz.
3. Başarılı test ödemesi: imzalı webhook doğru kuruluşa erişim verir; frontend `checkout.completed` tek başına yetki vermez.
4. Değiştirilmiş/eksik/eski imza reddedilir. Aynı olay iki kez ve eşzamanlı geldiğinde çift kayıt veya durum gerilemesi olmaz.
5. Olaylar ters sırada veya 30 dakikadan geç gelirse doğru müşteri/kuruluşla eşleşir; ağ/DB kesintisinden sonra tekrar teslim ve uzlaştırma çalışır.
6. Yanlış Paddle fiyatı, tek seferlik işlem, farklı müşteri veya ikinci kuruluş aboneliği erişim açamaz.
7. Yenileme, past_due, ödeme düzeltme, ücretli trial sonu, scheduled cancellation, kesin iptal, pause/resume ve yeniden abonelik denenir.
8. Portalda ödeme yöntemi, fatura ve iptal görünür; farklı kuruluş aynı portalı açamaz.
9. Tam/kısmi iade ve ödeme itirazının erişim politikası belirlenir ve sandbox'ta uygulanır.
10. CSP konsol hataları incelenir; yalnız gerekli resmi adresler eklenir. Gerçek kart kullanılmaz.

## Kullanıcıdan beklenen ticari bilgiler

- Paddle hesabının mevcut aşaması ve başvurulacak ülke; birey mi kayıtlı şahıs işletmesi mi?
- İlk paket tutarı, para birimi ve ödeme dönemi; dahil URL/müşteri/kullanıcı sınırları.
- Sitede gösterilecek satıcı adı/markası ve destek iletişimi; adres gibi kişisel bilgiler sohbet yerine uygun güvenli alanda tamamlanmalı.
- İade/iptal tercihleri, hedeflenen müşteri ülkeleri ve hizmet dili; zorunlu tüketici hakları daraltılamaz.

Kimlik belgeleri, API anahtarları ve banka bilgileri Git'e veya sohbet mesajına yazılmaz. Kimlik/ödeme hesabı adımları doğrudan Paddle'ın güvenli ekranlarında kullanıcı tarafından tamamlanır. Yasal sözleşmeler kullanıcı tarafından kabul edilir.

## Yayına geçiş sırası

1. Ticari kararlar ve gerçek satıcı bilgileri tamamlanır.
2. Kamuya açık fiyat/şartlar/iade/gizlilik/destek sayfaları hazırlanır ve gözden geçirilir.
3. Webhook engelleri giderilir; ayrı sandbox yapılandırmasında tüm kabul senaryoları kanıtlanır.
4. Domain ve bireysel kimlik doğrulaması, ödeme alma ve yerel vergi hazırlığı tamamlanır.
5. Ayrı live kimlikleri ve onaylı domain yapılandırılır. Kullanıcı gerçek para tahsilatı için son adımı yönetir.
6. İlk satış sonrası ödeme–webhook–erişim–fatura eşleşmesi ve izleme alarmları doğrulanır.

Resmi entegrasyon kaynakları:
- https://www.paddle.com/help/start/account-verification/what-is-domain-verification
- https://developer.paddle.com/build/go-live-checklist/
- https://developer.paddle.com/build/subscriptions/provision-access-webhooks/
- https://developer.paddle.com/paddle-js/about/client-side-tokens/
- https://www.paddle.com/legal/refund-policy
