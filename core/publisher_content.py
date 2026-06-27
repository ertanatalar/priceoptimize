"""Original editorial content used by the public information and guide pages."""


PUBLISHER_CONTENT = {
    "about": {
        "tr": {
            "title": "PriceOptimize.ai Hakkında",
            "description": "PriceOptimize.ai'nin amacı, kullandığı modeller ve fiyat önerilerinin sınırları hakkında ayrıntılı bilgi.",
            "sections": [
                {
                    "heading": "Neden bu platformu geliştirdik?",
                    "paragraphs": [
                        "Perakende işletmeleri fiyat değişikliklerinin satış adedini ve kârlılığı nasıl etkileyeceğini çoğu zaman deneme yanılma yoluyla öğrenir. PriceOptimize.ai, işletmenin elindeki basit satış verilerini anlaşılır bir matematik modeline dönüştürerek bu denemeleri daha ölçülebilir hale getirmek için geliştirildi.",
                        "Platformun amacı kullanıcı adına ticari karar vermek değil; farklı fiyat senaryolarının olası sonuçlarını görünür hale getirmektir. Böylece kullanıcı, kendi pazar bilgisiyle matematiksel sonucu birlikte değerlendirebilir.",
                    ],
                },
                {
                    "heading": "Kimler kullanabilir?",
                    "paragraphs": [
                        "Araçlar; küçük mağazalar, çevrim içi satıcılar, ürün yöneticileri ve fiyat değişikliğini geçmiş satışlarla karşılaştırmak isteyen ekipler için tasarlanmıştır. İstatistik veya yazılım bilgisi gerekmez. Kullanıcının farklı fiyatlarda gerçekleşen satış adetlerini bilmesi yeterlidir.",
                    ],
                    "bullets": [
                        "Yeni fiyat denemesi öncesinde olası talebi değerlendirmek isteyen satıcılar",
                        "İndirim kampanyasının kâra etkisini görmek isteyen işletmeler",
                        "Fiyat, maliyet ve talep ilişkisini eğitim amacıyla inceleyen kullanıcılar",
                    ],
                },
                {
                    "heading": "Hesaplamalar nasıl çalışır?",
                    "paragraphs": [
                        "Fiyat ve Satış Hesaplayıcısı iki fiyat-talep noktasından doğrusal bir talep eğrisi kurar. Birim maliyet girildiğinde gelir yerine kâr fonksiyonunu optimize eder. İndirim Etki Motoru ise fiyat düşüşü başına gözlenen satış artışını kullanarak farklı indirim adımlarını karşılaştırır.",
                        "Her iki model de girilen verilerin gelecekte benzer davranışı temsil ettiği varsayımına dayanır. Mevsimsellik, rakip kampanyaları, stok kesintileri veya reklam harcaması gibi dış etkenler ayrıca değerlendirilmelidir.",
                    ],
                },
                {
                    "heading": "Veri yaklaşımımız ve sorumluluk",
                    "paragraphs": [
                        "Hesaplama alanlarına girilen değerler sonucu üretmek için işlenir. Uygulama ödeme kartı bilgisi istemez ve hesaplama sonucu tek başına finansal ya da ticari danışmanlık değildir.",
                        "Önerileri önce sınırlı bir ürün grubu veya kısa bir test dönemi üzerinde denemenizi, gerçekleşen sonuçları kaydetmenizi ve yeni verilerle modeli yeniden çalıştırmanızı öneririz.",
                    ],
                },
            ],
        },
        "en": {
            "title": "About PriceOptimize.ai",
            "description": "Detailed information about the purpose, models, and limitations of PriceOptimize.ai.",
            "sections": [
                {
                    "heading": "Why we built this platform",
                    "paragraphs": [
                        "Retail businesses often learn how price changes affect demand and profit through trial and error. PriceOptimize.ai turns simple historical sales observations into an understandable mathematical model so those experiments can be measured more consistently.",
                        "The platform does not make a commercial decision on behalf of the user. It makes the likely consequences of alternative prices visible, allowing business knowledge and model output to be evaluated together.",
                    ],
                },
                {
                    "heading": "Who can use it?",
                    "paragraphs": [
                        "The calculators are designed for small retailers, online sellers, product managers, and teams comparing price changes with historical demand. No statistics or programming background is required; users only need observations of quantity sold at different prices.",
                    ],
                    "bullets": [
                        "Sellers assessing demand before testing a new price",
                        "Businesses estimating how a discount campaign may affect profit",
                        "Learners exploring the relationship between price, cost, and demand",
                    ],
                },
                {
                    "heading": "How the calculations work",
                    "paragraphs": [
                        "The Price and Sales Calculator estimates a linear demand curve from two price-demand points. When unit cost is supplied, it optimizes profit rather than revenue. The Discount Impact Engine compares discount steps by using the observed increase in sales for each reduction in price.",
                        "Both models assume that the supplied observations are representative of future behavior. Seasonality, competitor campaigns, stock shortages, and advertising changes should be considered separately.",
                    ],
                },
                {
                    "heading": "Data approach and responsibility",
                    "paragraphs": [
                        "Values entered into calculator fields are processed to produce the requested result. The application does not request payment-card information, and a calculated result is not financial or commercial advice.",
                        "We recommend testing suggestions on a limited product group or short period, recording the actual outcome, and running the model again with the new evidence.",
                    ],
                },
            ],
        },
    },
    "how-to": {
        "tr": {
            "title": "PriceOptimize.ai Nasıl Kullanılır?",
            "description": "Satış verilerini hazırlama, doğru motoru seçme ve sonuçları güvenli biçimde yorumlama rehberi.",
            "sections": [
                {
                    "heading": "1. Veriyi hazırlayın",
                    "paragraphs": [
                        "Aynı ürünün farklı fiyatlarda gerçekleşen satış adetlerini kullanın. Mümkünse karşılaştırılan dönemlerin uzunluğu, mağaza sayısı, reklam bütçesi ve stok durumu benzer olsun. Aksi halde satış farkının tamamını fiyat değişikliğine bağlamak yanıltıcı olabilir.",
                    ],
                    "bullets": [
                        "Fiyat ve satış adetlerini aynı para birimi ve dönem uzunluğunda tutun.",
                        "Stokta olmayan günleri veya sıra dışı kampanya dönemlerini ayırın.",
                        "Birim maliyete ürün, komisyon ve değişken işlem maliyetlerini dahil edin.",
                    ],
                },
                {
                    "heading": "2. Doğru motoru seçin",
                    "paragraphs": [
                        "Elinizde iki farklı fiyat ve bu fiyatlardaki satış adetleri varsa Fiyat ve Satış Hesaplayıcısını kullanın. Bir indirimin satış adedini ne kadar artırdığını biliyor ve farklı indirim adımlarını karşılaştırmak istiyorsanız İndirim Etki Motorunu kullanın.",
                    ],
                },
                {
                    "heading": "3. Alanları doldurun",
                    "paragraphs": [
                        "Ondalık değerlerde nokta veya virgül kullanabilirsiniz. Talep sayısı, seçilen dönemde satılan toplam ürün adedidir. Birim maliyet sıfır bırakılırsa sonuç gelir odaklı görünür; gerçek kâr hesabı için maliyeti doğru girmek önemlidir.",
                    ],
                },
                {
                    "heading": "4. Sonucu okuyun",
                    "paragraphs": [
                        "Optimum fiyat modelin en yüksek kâr ürettiği tahmini noktadır. Beklenen talep bu fiyatta öngörülen satış adedini, maksimum kâr ise birim maliyet düşüldükten sonraki tahmini sonucu gösterir. Grafik, girilen noktaları ve modelin önerdiği noktayı birlikte görmenizi sağlar.",
                    ],
                },
                {
                    "heading": "5. Küçük bir test yapın",
                    "paragraphs": [
                        "Önerilen fiyatı bütün ürünlere bir anda uygulamak yerine sınırlı bir grupta deneyin. Test sırasında stok, reklam ve rakip fiyatlarını kaydedin. Gerçek satışlar modelden farklıysa yeni veri noktalarını ekleyerek varsayımlarınızı güncelleyin.",
                    ],
                },
            ],
        },
        "en": {
            "title": "How to Use PriceOptimize.ai",
            "description": "A practical guide to preparing sales data, selecting a calculator, and interpreting results safely.",
            "sections": [
                {
                    "heading": "1. Prepare comparable data",
                    "paragraphs": [
                        "Use quantities sold for the same product at different prices. Whenever possible, compare periods with similar duration, store coverage, advertising spend, and stock availability. Otherwise, the full demand difference may be incorrectly attributed to price.",
                    ],
                    "bullets": [
                        "Keep price and quantity observations in the same currency and period length.",
                        "Separate stock-out days and unusual promotion periods.",
                        "Include product, commission, and variable transaction expenses in unit cost.",
                    ],
                },
                {
                    "heading": "2. Select the right engine",
                    "paragraphs": [
                        "Use the Price and Sales Calculator when you have two prices and their observed sales quantities. Use the Discount Impact Engine when you know how much demand changed after a discount and want to compare additional reduction steps.",
                    ],
                },
                {
                    "heading": "3. Complete the fields",
                    "paragraphs": [
                        "Demand quantity means total units sold during the selected period. If unit cost is left at zero, the output behaves more like a revenue calculation; accurate cost is necessary for a useful profit estimate.",
                    ],
                },
                {
                    "heading": "4. Read the result",
                    "paragraphs": [
                        "Optimal price is the estimated point where the model produces its highest profit. Expected demand is the projected quantity at that price, while maximum profit subtracts unit cost. The chart places supplied observations and the model recommendation in the same view.",
                    ],
                },
                {
                    "heading": "5. Run a controlled test",
                    "paragraphs": [
                        "Test the recommendation on a limited product group instead of changing every listing at once. Record stock, advertising, and competitor prices during the test. If actual sales differ from the estimate, update the model with the new evidence.",
                    ],
                },
            ],
        },
    },
    "faq": {
        "tr": {
            "title": "Sık Sorulan Sorular",
            "description": "Fiyat optimizasyonu, veri kalitesi, sonuç güvenilirliği ve gizlilik hakkında sık sorulan sorular.",
            "sections": [
                {"heading": "Sonuç kesin bir satış garantisi midir?", "paragraphs": ["Hayır. Sonuç, girilen veriler ve seçilen matematik modeline dayalı bir tahmindir. Pazar koşulları değiştiğinde gerçek sonuç farklı olabilir. Öneriyi kontrollü bir testin başlangıç noktası olarak kullanın."]},
                {"heading": "Neden en az iki veri noktası gerekiyor?", "paragraphs": ["Tek bir fiyat ve satış adedi, fiyat değiştiğinde talebin hangi yönde ve ne kadar hareket edeceğini göstermez. İki farklı gözlem modelin eğimini hesaplamasını sağlar. Daha geniş ve temiz veri, ayrı analizlerde daha güçlü sonuç üretir."]},
                {"heading": "Birim maliyete neleri eklemeliyim?", "paragraphs": ["Ürün alış veya üretim maliyetine satış başına değişen komisyon, paketleme, ödeme ve kargo katkılarını ekleyin. Sabit kira gibi ürün adediyle değişmeyen giderler ayrı bir işletme analizinde ele alınabilir."]},
                {"heading": "Talep fiyat yükseldiğinde artıyorsa ne olur?", "paragraphs": ["Bu durum sıra dışı bir kampanya, stok sorunu, dönem farkı veya farklı müşteri kitlesi bulunduğunu gösterebilir. Model hata verebilir veya ekonomik olarak anlamsız sonuç üretebilir. Veri dönemlerini yeniden kontrol edin."]},
                {"heading": "Sonuçları ne sıklıkla güncellemeliyim?", "paragraphs": ["Satış yapısı değiştiğinde, yeni bir kampanya başladığında veya yeterli yeni gözlem oluştuğunda modeli yeniden çalıştırın. Hızlı değişen pazarlarda aylık; daha durağan ürünlerde dönemsel güncelleme uygun olabilir."]},
                {"heading": "Verilerim saklanıyor mu?", "paragraphs": ["Mevcut sürümde hesaplama girdileri sonucu üretmek için kullanılır. Üyelik veya kayıt geçmişi özelliği bulunmadığı için kullanıcıya bağlı kalıcı bir hesaplama arşivi oluşturulmaz. Ayrıntılar Gizlilik Politikası'nda yer alır."]},
                {"heading": "Bu araç finansal danışmanlık verir mi?", "paragraphs": ["Hayır. Araç yalnızca fiyat ve talep senaryolarını karşılaştırmaya yardımcı olur. Vergi, nakit akışı, sözleşme ve yatırım kararlarında ilgili uzman görüşü alınmalıdır."]},
            ],
        },
        "en": {
            "title": "Frequently Asked Questions",
            "description": "Common questions about pricing models, data quality, reliability, and privacy.",
            "sections": [
                {"heading": "Is the result a sales guarantee?", "paragraphs": ["No. The result is an estimate based on the supplied observations and selected mathematical model. Actual performance may differ when market conditions change. Use the recommendation as the starting point for a controlled test."]},
                {"heading": "Why are at least two observations required?", "paragraphs": ["A single price and quantity cannot show how demand moves when price changes. Two distinct observations allow the model to estimate the direction and rate of change."]},
                {"heading": "What belongs in unit cost?", "paragraphs": ["Include purchase or production cost plus per-sale commission, packaging, payment, and shipping contributions. Fixed expenses such as rent may require a separate business analysis."]},
                {"heading": "What if demand increases with price?", "paragraphs": ["This may indicate a promotion, stock constraint, period mismatch, or different customer group. The model can return an economically weak result. Recheck whether the observations are truly comparable."]},
                {"heading": "How often should I update the analysis?", "paragraphs": ["Run it again when the sales pattern changes, a campaign begins, or enough new observations become available. Monthly review may suit fast-moving markets, while stable products can be reviewed less often."]},
                {"heading": "Are my inputs stored?", "paragraphs": ["The current version uses calculator inputs to produce the result. Because there is no account or calculation-history feature, it does not create a permanent user-linked archive. See the Privacy Policy for details."]},
                {"heading": "Is this financial advice?", "paragraphs": ["No. The tools compare price and demand scenarios only. Tax, cash-flow, contract, and investment decisions should involve the appropriate professional advice."]},
            ],
        },
    },
    "contact": {
        "tr": {
            "title": "İletişim",
            "description": "PriceOptimize.ai için destek, geri bildirim ve veri gizliliği iletişim bilgileri.",
            "sections": [
                {
                    "heading": "Bize ulaşın",
                    "paragraphs": [
                        "Hesaplama motorları, teknik sorunlar, içerik düzeltmeleri veya gizlilik talepleri için admin@priceoptimize.ai adresine yazabilirsiniz. Mesajınız doğrudan proje yöneticisine ulaşır.",
                        "Size daha hızlı yardımcı olabilmemiz için kullandığınız sayfanın adresini, karşılaştığınız sorunu ve mümkünse örnek girdileri paylaşın. Şifre, kart bilgisi veya ticari sır niteliğinde veri göndermeyin.",
                    ],
                },
                {
                    "heading": "Hangi konularda yazabilirsiniz?",
                    "bullets": [
                        "Hesaplama sonucunun açıklanması veya hata bildirimi",
                        "Mobil görünüm ve erişilebilirlik geri bildirimi",
                        "Yeni hesaplama motoru önerisi",
                        "Gizlilik, çerez veya kişisel veri talebi",
                        "İş birliği ve kurumsal kullanım soruları",
                    ],
                },
                {
                    "heading": "Yanıt ve güvenlik",
                    "paragraphs": [
                        "Mesajları mümkün olan en kısa sürede inceliyoruz; yoğunluğa göre yanıt süresi değişebilir. PriceOptimize.ai destek ekibi e-posta ile parola, kart numarası veya tek kullanımlık doğrulama kodu istemez.",
                    ],
                },
            ],
        },
        "en": {
            "title": "Contact",
            "description": "Support, feedback, and privacy contact information for PriceOptimize.ai.",
            "sections": [
                {
                    "heading": "Contact us",
                    "paragraphs": [
                        "For questions about calculators, technical problems, content corrections, or privacy requests, email admin@priceoptimize.ai. Your message reaches the project administrator.",
                        "To help us investigate quickly, include the page address, a description of the problem, and non-sensitive example inputs. Do not send passwords, card details, or confidential business data.",
                    ],
                },
                {
                    "heading": "Topics we can help with",
                    "bullets": [
                        "Explanation of a calculator result or error report",
                        "Mobile layout and accessibility feedback",
                        "Suggestions for a new calculation engine",
                        "Privacy, cookie, or personal-data requests",
                        "Collaboration and business-use questions",
                    ],
                },
                {
                    "heading": "Response and security",
                    "paragraphs": [
                        "We review messages as soon as practical; response time can vary with volume. PriceOptimize.ai support will not request a password, full card number, or one-time authentication code by email.",
                    ],
                },
            ],
        },
    },
    "price-demand-guide": {
        "tr": {
            "title": "Fiyat ve Talep Optimizasyonu Rehberi",
            "description": "İki satış noktasından talep denklemi, optimum fiyat ve maksimum kâr hesabının ayrıntılı açıklaması.",
            "sections": [
                {
                    "heading": "Modelin amacı",
                    "paragraphs": [
                        "Bu model, aynı ürünün iki farklı satış fiyatında gözlenen talep adetlerini kullanarak fiyat ile talep arasındaki ilişkiyi yaklaşık olarak ifade eder. Amaç yalnızca en yüksek satış adedini bulmak değildir; birim maliyet dikkate alındığında en yüksek tahmini kârı üreten fiyatı bulmaktır.",
                        "Düşük fiyat genellikle daha fazla satış getirir, fakat her satıştan elde edilen katkıyı azaltır. Yüksek fiyat ise birim başına katkıyı yükseltirken talebi düşürebilir. Optimum fiyat bu iki etkinin dengelendiği noktadır.",
                    ],
                },
                {
                    "heading": "Talep denklemi nasıl kurulur?",
                    "paragraphs": [
                        "İki veri noktası (fiyat 1, talep 1) ve (fiyat 2, talep 2) olarak alınır. Doğrusal yaklaşımda talep = a + b × fiyat biçiminde yazılır. b katsayısı fiyat değiştiğinde talebin ne kadar değiştiğini, a katsayısı ise doğrunun başlangıç düzeyini temsil eder.",
                        "Fiyat arttığında talebin azalması bekleniyorsa b negatiftir. Katsayının pozitif çıkması, karşılaştırılan dönemlerin eşdeğer olmadığını veya üründe farklı bir pazar davranışı bulunduğunu gösterebilir.",
                    ],
                },
                {
                    "heading": "Kâr fonksiyonu",
                    "paragraphs": [
                        "Birim maliyet c, fiyat p ve tahmini talep q(p) olduğunda kâr (p − c) × q(p) olarak hesaplanır. Model bu fonksiyonun en yüksek olduğu fiyatı arar. Talep negatif olamayacağı için ekonomik olarak geçersiz bölgeler değerlendirme dışı bırakılır.",
                    ],
                },
                {
                    "heading": "Sayısal örnek",
                    "paragraphs": [
                        "Bir ürünün 100 TL fiyatla 100 adet, 75 TL fiyatla 110 adet sattığını ve birim maliyetinin 40 TL olduğunu düşünün. Bu iki nokta talebin fiyat düştükçe arttığını gösterir. Motor önce talep doğrusunu kurar, ardından her olası fiyat için tahmini talep ve kârı karşılaştırır.",
                        "Sonuç ekranı optimum fiyatı, bu fiyatta beklenen talebi ve maksimum tahmini kârı birlikte gösterir. Grafik üzerindeki mavi noktalar gerçek girdileri, farklı renkteki optimal nokta model önerisini temsil eder.",
                    ],
                },
                {
                    "heading": "Sonucu kullanma ve doğrulama",
                    "paragraphs": [
                        "Model önerisini doğrudan kesin fiyat olarak değil, test edilecek bir hipotez olarak değerlendirin. Önerilen fiyat mevcut gözlemlerin çok dışındaysa kademeli geçiş yapın. Test süresince stok, reklam, sezon ve rakip fiyatlarını not ederek gerçek talep değişimini ayırmaya çalışın.",
                    ],
                    "bullets": [
                        "Karşılaştırılan satış dönemlerinin sürelerini eşitleyin.",
                        "Birim maliyeti güncel tutun.",
                        "Yeni fiyat sonucunu modele üçüncü bir kontrol noktası olarak kaydedin.",
                        "Talep eğrisinin zaman içinde değişebileceğini unutmayın.",
                    ],
                },
                {
                    "heading": "Modelin sınırları",
                    "paragraphs": [
                        "İki noktalı doğrusal model basit ve açıklanabilir olduğu için kullanışlıdır, ancak bütün ürünlerde talep doğrusal değildir. Çok büyük fiyat değişiklikleri, yeni ürünler, sınırlı stok, marka etkisi veya rakip tepkileri için daha fazla veri ve farklı modeller gerekebilir.",
                    ],
                },
            ],
        },
        "en": {
            "title": "Price and Demand Optimization Guide",
            "description": "A detailed explanation of estimating demand, optimal price, and maximum profit from two sales observations.",
            "sections": [
                {
                    "heading": "Purpose of the model",
                    "paragraphs": [
                        "The model uses observed demand for the same product at two selling prices to approximate the relationship between price and quantity. Its goal is not simply to maximize units sold; after unit cost is supplied, it searches for the price with the highest estimated profit.",
                        "A lower price may increase sales while reducing contribution per unit. A higher price can improve unit contribution but reduce demand. The optimum is the estimated balance between those effects.",
                    ],
                },
                {
                    "heading": "Building the demand equation",
                    "paragraphs": [
                        "The observations are represented as (price 1, demand 1) and (price 2, demand 2). In a linear approximation, demand is written as a + b × price. The coefficient b describes how demand changes with price, while a determines the intercept of the estimated line.",
                        "When demand decreases as price rises, b is negative. A positive value can indicate non-comparable periods or unusual market behavior and should prompt a review of the data.",
                    ],
                },
                {
                    "heading": "Profit function",
                    "paragraphs": [
                        "With unit cost c, price p, and estimated demand q(p), profit is calculated as (p − c) × q(p). The engine searches for the price where this function is highest and excludes regions that imply negative demand.",
                    ],
                },
                {
                    "heading": "Worked example",
                    "paragraphs": [
                        "Suppose a product sells 100 units at 100 TRY and 110 units at 75 TRY, with unit cost of 40 TRY. These observations indicate that demand increased when price fell. The engine estimates the demand line and then compares projected demand and profit across feasible prices.",
                        "The result presents optimal price, expected demand at that price, and maximum estimated profit. On the chart, supplied observations are shown separately from the model's optimal point.",
                    ],
                },
                {
                    "heading": "Using and validating the result",
                    "paragraphs": [
                        "Treat the recommendation as a hypothesis to test rather than a guaranteed price. If it lies far outside the observed price range, move gradually. Record stock, advertising, seasonality, and competitor prices so their influence can be separated from the price effect.",
                    ],
                    "bullets": [
                        "Compare sales periods of equal length.",
                        "Keep unit cost current.",
                        "Record the new result as an additional validation point.",
                        "Remember that demand can change over time.",
                    ],
                },
                {
                    "heading": "Limitations",
                    "paragraphs": [
                        "A two-point linear model is useful because it is simple and explainable, but demand is not linear for every product. Large price changes, new products, limited inventory, brand effects, or competitor reactions may require more observations and different methods.",
                    ],
                },
            ],
        },
    },
    "discount-guide": {
        "tr": {
            "title": "İndirim ve Maksimum Kâr Rehberi",
            "description": "İndirim adımlarının satış, gelir ve kâr üzerindeki etkisini değerlendirme rehberi.",
            "sections": [
                {
                    "heading": "İndirim neden her zaman daha fazla kâr getirmez?",
                    "paragraphs": [
                        "İndirim satış adedini artırabilir, ancak ürün başına kazanılan tutarı düşürür. Ek satışlardan gelen katkı, fiyat düşüşünden doğan kaybı karşılamıyorsa toplam gelir artsa bile kâr azalabilir. Bu nedenle yalnızca satış adedine bakmak yeterli değildir.",
                    ],
                },
                {
                    "heading": "Motorun kullandığı bilgiler",
                    "paragraphs": [
                        "Motor en az iki satış gözlemini karşılaştırır: normal fiyat ve satış adedi ile indirimli fiyat ve satış adedi. İndirim adımı, fiyat her azaltıldığında satışın kaç adet arttığına ilişkin gözlemi temsil eder.",
                    ],
                    "bullets": [
                        "Normal dönemde satılan ürün sayısı ve fiyat",
                        "İndirimli dönemde satılan ürün sayısı ve fiyat",
                        "Uygulanan veya planlanan indirim bedeli",
                        "Kâr hesabı için güncel birim maliyet",
                    ],
                },
                {
                    "heading": "Hesaplama mantığı",
                    "paragraphs": [
                        "Fiyat fonksiyonu her indirim adımında fiyatın ne kadar düştüğünü, miktar fonksiyonu satış adedinin ne kadar arttığını ifade eder. Gelir fiyat ile miktarın çarpımıdır. Birim maliyet miktarla çarpılarak toplam değişken maliyet bulunur; kâr ise gelirden bu maliyetin çıkarılmasıyla hesaplanır.",
                        "Ortaya çıkan ikinci dereceden kâr fonksiyonunun tepe noktası, model varsayımları altında en yüksek kârı veren indirim adımını gösterir.",
                    ],
                },
                {
                    "heading": "Sayısal örnek",
                    "paragraphs": [
                        "Bir ürünün 100 TL fiyatla 100 adet sattığını düşünün. Fiyat 95 TL olduğunda satış 110 adede çıkıyorsa 5 TL indirim başına 10 adet ek satış gözlenmiştir. Motor mevcut fiyatı, gözlenen indirimli fiyatı ve devam eden indirim adımlarını aynı model içinde karşılaştırır.",
                        "Beklenen çıktı; önerilen indirim tutarı, tahmini satış adedi, indirim sonrası fiyat ve en yüksek kârdır. Sonuç tablosunda mevcut fiyat senaryosu da gösterildiği için indirim yapmamanın daha iyi olduğu durumlar görülebilir.",
                    ],
                },
                {
                    "heading": "Kampanyayı nasıl test etmelisiniz?",
                    "paragraphs": [
                        "İndirim testinde yalnızca ciroyu değil, brüt kârı ve stok tüketimini izleyin. Test grubu ile normal fiyat grubunu aynı günlerde karşılaştırmak mevsim ve trafik farkını azaltır. Kampanya sonrasında müşterilerin normal fiyata dönüş davranışını da takip edin.",
                    ],
                },
                {
                    "heading": "Sınırlamalar ve riskler",
                    "paragraphs": [
                        "Her ek indirim adımında satışın aynı miktarda artacağı varsayımı yalnızca belirli bir aralıkta geçerli olabilir. Çok düşük fiyatlarda stok, kapasite ve marka algısı modeli bozar. Rakiplerin eş zamanlı kampanyaları veya reklam harcaması değişiklikleri ayrıca değerlendirilmelidir.",
                    ],
                },
            ],
        },
        "en": {
            "title": "Discount and Maximum Profit Guide",
            "description": "A practical guide to evaluating how discount steps affect quantity, revenue, and profit.",
            "sections": [
                {
                    "heading": "Why a discount does not always increase profit",
                    "paragraphs": [
                        "A discount can increase units sold while reducing contribution per unit. If the additional sales contribution does not cover the loss caused by the lower price, profit can fall even when revenue or quantity rises. Quantity alone is therefore not enough to judge a campaign.",
                    ],
                },
                {
                    "heading": "Information used by the engine",
                    "paragraphs": [
                        "The engine compares at least two observations: normal price and quantity, then discounted price and quantity. The discount step represents the observed increase in sales for each reduction in price.",
                    ],
                    "bullets": [
                        "Quantity and price during the normal period",
                        "Quantity and price during the discounted period",
                        "Applied or planned discount amount",
                        "Current unit cost for a meaningful profit calculation",
                    ],
                },
                {
                    "heading": "Calculation logic",
                    "paragraphs": [
                        "The price function describes how price falls at each discount step, while the quantity function describes the associated increase in units. Revenue is price multiplied by quantity. Variable cost is unit cost multiplied by quantity, and profit subtracts that cost from revenue.",
                        "The peak of the resulting quadratic profit function identifies the discount step with the highest estimated profit under the model assumptions.",
                    ],
                },
                {
                    "heading": "Worked example",
                    "paragraphs": [
                        "Suppose a product sells 100 units at 100 TRY. At 95 TRY, sales rise to 110 units, indicating 10 additional units for a 5 TRY reduction. The engine compares the current price, observed discount, and further discount steps in one model.",
                        "The output includes recommended discount, projected quantity, discounted price, and maximum estimated profit. Because the current-price scenario is retained, the result can also show that no discount is preferable.",
                    ],
                },
                {
                    "heading": "How to test a campaign",
                    "paragraphs": [
                        "Track gross profit and inventory use, not revenue alone. Comparing a test group and normal-price group on the same dates reduces seasonal and traffic differences. After the campaign, observe whether customers return to the normal price.",
                    ],
                },
                {
                    "heading": "Limitations and risks",
                    "paragraphs": [
                        "The assumption that every discount step produces the same sales increase may hold only within a limited range. Very low prices, capacity constraints, stock, brand perception, competitor campaigns, and advertising changes can all weaken the estimate.",
                    ],
                },
            ],
        },
    },
}
