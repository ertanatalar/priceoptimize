# Güvenlik geçişi — kontrollü uygulama planı

18 Kasım 2026 tarihinde Render yönetim ekranından doğrulandı:

- Kaynak: `ertanatalar/priceoptimize`, dal: `codex/aiven-mysql-test`.
- Web ve veritabanı API servislerinin son başarılı dağıtımı: `05c6dbe2a0877258e7c8210eead2ef7186d3d7da`.
- Yerel `web` HEAD'i `00437f7`; canlı kaynakla aynı değil. Bu çalışma ağacı doğrudan canlı dalın üzerine yazılmamalı.
- Canlı commit'in Auth0 kodu tam yapılandırma durumunda platform başlığına geri dönüşü zaten engelliyor. Önceki yerel bulgu canlıda doğrulanmış bir istismar olarak okunmamalı. Yerel ek kontrol Render ve kısmi Auth0 yapılandırmasını da kapsar.
- Canlıda iki aktif `chatgpt` kullanıcısı var; otomatik e-posta eşleştirmesini kaldırmadan önce Auth0 kimlikleri bağımsız doğrulanmalı.

## 1. Kimlik eşleştirme kanıtı

Auth0 yönetim paneline tenant sahibi olarak giriş yap. Tenant: `dev-2pq2yw3olibhha8v`. Eşlenecek kullanıcının doğrulanmış Auth0 subject bilgisini ve eski hesap sahipliğine ilişkin kanıtı incele. E-posta eşitliği tek başına otomatik yönetici yetkisi vermez. Yeni subject değerini SHA-256 ile özetle; oturum anahtarı veya erişim tokenı rapora koyma.

- Her kullanıcı için eski uygulama UUID'si ve eski sağlayıcı/hash, yeni Auth0 subject hash'i ve inceleme kaydı referansı hazırlanır.
- Mevcut kullanıcı UUID'si korunur; müşteri kayıtları, kuruluş üyeliği ve hukuki kayıtlar taşınmaz veya kopyalanmaz.
- Diğer kullanıcı adına, sadece operatör kendi hesabına giriş yaptı diye eşleme yapılmaz. İkinci hesabın sahipliği ayrıca doğrulanır.
- Canlı başvurusu olmayan Auth0 kimliği tahmin edilmez; hesapların aynı kişiye ait olduğu varsayılmaz.

İncelenmiş eşlemeler için çevrimdışı araç:

```text
node backend/security/prepare-transition.mjs --inventory /private/path/users.json --mappings /private/path/verified-mappings.json --out /private/path/new-plan.json
```

Envanter biçimi: `[{"id":"UUID","status":"active","identity_provider":"chatgpt","identity_subject_hash":"64-char-sha256"}]`.

Eşleme biçimi: `[{"userId":"UUID","oldProvider":"chatgpt","oldSubjectHash":"64-char-sha256","newProvider":"auth0","newSubjectHash":"64-char-sha256","verificationReference":"operator-reviewed-reference"}]`.

Araç ağ bağlantısı kurmaz veya veritabanını değiştirmez; `--apply` desteklemez. Özel dosya yeni olmalı; mevcut dosyanın üzerine yazılmaz ve çıktı izinleri 0600'dür. `verificationReference` alanının dolu olması kanıtın gerçekten doğrulandığını yazılımsal olarak ispatlamaz; operatör incelemesi şarttır.

Gerçek uygulamada satırlar işlem içinde tekrar okunup kilitlenmeli; koşullu güncelleme tam bir satırı etkilemeli; çakışmada işlem geri alınmalı; aynı işlemde operatör ve doğrulama referansıyla denetim kaydı tutulmalı. Çıktıdaki SQL tek başına otomatik uygulama aracı değildir. Geri alma da daha sonraki kimlik değişikliklerine karşı yeniden denetlenmelidir.

## 2. Sınırlı yetkili veritabanı çalışma hesabı

`backend/security/runtime-grants.review.sql`, parolasız inceleme taslağıdır; çalıştırılmadı. Yeni, başka yetkisi olmayan `priceopt_runtime` hesabı içindir. Mevcut yöneticinin yetkileri değiştirilmez. `GRANT` eski geniş yetkileri kaldırmaz; yeni hesabın global yetki, rol ve GRANT OPTION taşımadığı ayrıca doğrulanır.

- Tabloya özel SELECT/INSERT; ihtiyaç duyulan tablolarda UPDATE.
- Canlı sürümde `observations`, `audit_events`, `erasure_records` üzerinde DELETE gerekir: toplayıcı bu üç kategori için süre sonu temizliği yapar; imha kaydında legal_hold=FALSE koşulu vardır. Diğer tablolar için DELETE verilmez. `users` üzerindeki UPDATE mevcut kayıt/giriş işlemini korur.
- Canlı commit'teki Paddle faturalandırma tabloları da plana dahil edildi; ödeme/webhook işlevlerinin kesilmesi önlenmeli.
- CREATE/ALTER/DROP/FILE ve global yetkiler yok.
- Şema kurulumu ayrı yönetici kimliğiyle yürütülür. Normal başlangıçta otomatik migration'ı kaldıran kod önce canlı sürümle birleştirilip dağıtılmalı; aksi halde yeni dar yetkili bağlantıyla başlangıç başarısız olur.
- Kullanıcı oluşturma, parola belirleme ve Render DATABASE_URL değişikliği bu çalışmada yapılmadı. Parolayı sohbete veya SQL dosyasına yazma.

## 3. Yayın ve doğrulama sırası

1. Mevcut canlı commit'i temel alan ayrı bir güvenlik dalı hazırla; Paddle, bildirim ve tarayıcı kuyruk değişikliklerini koru.
2. Gerçek kimlik eşlemelerini bağımsız doğrula ve geri alma planını incele.
3. Şema kurulumundan ayrılmış servis başlangıcını ve web güvenlik kontrollerini test ortamında doğrula.
4. Gerekli hesap eşleme işlemlerini koşullu ve denetim kayıtlı işlemle uygula.
5. Yeni sınırlı veritabanı hesabını hazırla, yetkilerini kontrol et ve bağlantıyı kontrollü değiştir.
6. Giriş, iki kuruluşun ayrılması, mevcut ürünler, hizmet bildirimleri, Paddle webhook işleme ve gözlem saklama işlevlerini doğrula. Gerçek e-posta/ödeme/silme denemesi yerine izole test verisi kullan.
7. Yetki daraltma ve MFA'yı ayrıca kaydet. Eski yönetici sırrının kaldırılması/döndürülmesi için geri dönüş gereksinimini gözet.

## Güncel durum

Auth0 Dashboard girişi tamamlandı ve doğru tenant doğrulandı. Ertan Atalar hesabının doğrulanmış Google kimliği ve kullanıcı MFA kaydı görüldü. İkinci eski hesap için Auth0 listesinde karşılık görülmedi; bu hesap eşlenmedi. Ertan hesabı için özel geçici dosyalarda uygulanmamış bir koşullu geçiş planı hazırlandı; kimlik değerleri bu belgeye veya Git'e alınmadı.

Canlı commit temelinde izole güvenlik paketi hazırlandı. Mevcut Paddle, tarayıcı toplu kontrol ve bildirim işlevleri korundu; önceki yeni hukuki kayıt kapatma değişiklikleri pakete dahil edilmedi. Web güvenlik testleri 8/8, güncel backend/toplayıcı testleri 15/15 ve geçiş planı testleri 4/4 başarılı; TypeScript ve üretim derlemesi başarılı.

GitHub bağlantısı `create_branch` isteğini 403 Resource not accessible by integration yanıtıyla reddetti. Yeni dal/PR oluşturulamadı. `reports/security-auth0-transition-20261118.patch` dosyası 27 dosyalık incelenebilir pakettir; canlıdaki kaynakla temiz uygulanabilirliği kontrol edildi. Canlı kimlikler, parolalar ve yetkiler değiştirilmedi. Sonraki ihtiyaç, bu depoya yazma yetkili GitHub bağlantısıdır; ardından geçiş paketinin incelenmesi ve kontrollü yayın/hesap eşlemesi yapılabilir.
