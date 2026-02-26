# Deploy Plan (Render + Custom Domain)

## 1) GitHub'a push et
```bash
git add .
git commit -m "Production deploy setup"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 2) Render'da servis oluştur
- Render dashboard -> New -> Blueprint
- GitHub repo'yu seç
- `render.yaml` otomatik okunacak
- Deploy başlat

## 3) Ortam değişkeni kontrolü (Render)
`DJANGO_SUPERUSER_PASSWORD` değerini elle gir (zorunlu).

## 4) Domain bağlama (`www.priceoptimize.ai`)
Render service -> Settings -> Custom Domains:
- `www.priceoptimize.ai` ekle
- Render'ın verdiği hedefe DNS CNAME oluştur

Apex domain (`priceoptimize.ai`) için:
- ya ALIAS/ANAME kullan
- ya DNS sağlayıcında URL redirect ile `https://www.priceoptimize.ai` adresine yönlendir

## 5) HTTPS kontrol
DNS yayıldıktan sonra:
- `https://www.priceoptimize.ai`
- `https://www.priceoptimize.ai/admin/`

## 6) İlk admin girişi
Render shell/SSH ile:
```bash
python manage.py createsuperuser
```

## Not
- Bu kurulum şu an SQLite kullanır.
- Sonraki adımda MySQL'e geçebiliriz (`mysqlclient` + `DATABASES` env ayarı).
