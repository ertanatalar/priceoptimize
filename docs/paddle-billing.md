# Paddle abonelik kurulumu

Price Optimizer ödeme kartı verisi saklamaz. Ödeme, vergi hesaplama, fatura,
yenileme, başarısız ödeme ve iptal akışları Paddle tarafından yürütülür. MySQL'de
yalnızca kuruluşa bağlı Paddle müşteri/abonelik kimlikleri ile güncel abonelik
durumu tutulur; tam webhook gövdeleri saklanmaz.

## Önce sandbox

1. Paddle Sandbox'ta `Starter` adlı yinelenen bir ürün/fiyat oluşturun. Tutarı
   ticari karar verildikten sonra Paddle panelinde belirleyin.
2. Bir client-side token ve en az `customer_portal_session.write` yetkili API
   anahtarı oluşturun.
3. Bildirim hedefi olarak
   `https://www.priceoptimize.ai/api/billing/webhook` adresini ekleyin.
4. En az şu olayları seçin: `transaction.completed`,
   `transaction.payment_failed`, `subscription.created`,
   `subscription.updated`, `subscription.canceled`, `subscription.paused` ve
   `subscription.resumed`.
5. Render `priceoptimize-web` servisine aşağıdaki değişkenleri ekleyin:

   - `PADDLE_ENVIRONMENT=sandbox`
   - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
   - `PADDLE_API_KEY`
   - `PADDLE_WEBHOOK_SECRET`
   - `PADDLE_PRICE_ID_STARTER`

Anahtarları Git'e veya destek mesajlarına yapıştırmayın. Render'ın secret
alanlarını kullanın.

## Canlıya geçiş kapısı

Sandbox ödeme, yenileme, başarısız ödeme, portal, fatura indirme ve iptal
senaryoları doğrulanmadan `PADDLE_ENVIRONMENT=production` yapılmamalıdır. Canlı
Paddle hesabı onaylandıktan sonra bütün kimlikler canlı değerlerle değiştirilir;
sandbox ve canlı anahtarlar karıştırılmaz.

## Beklenen davranış

- Deneme hesabı `Starter pakete geç` düğmesini görür.
- Başarılı ödeme ancak imzalı webhook işlendiğinde aboneliği `active` yapar.
- Başarısız ödeme `past_due` olur ve yazma işlemleri durur.
- Müşteri Paddle portalından kartını günceller, faturalarını indirir ve iptal
  işlemini yapar.
- Webhook olay kimliği tekrar işlenmez; daha eski olay yeni abonelik durumunun
  üzerine yazamaz.
