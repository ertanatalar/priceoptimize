'use client';
import { useI18n } from '@/components/i18n-provider';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Building2,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MonitorUp,
  PackagePlus,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { BillingActions } from '@/app/billing-actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserQueue } from '@/lib/browser-queue';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Client = {
  id: number;
  code: string;
  name: string;
  notificationEmail: string | null;
  productCount: number;
  sourceCount: number;
};
type Product = {
  id: number;
  sku: string;
  name: string;
  currency: string;
  maxPriceDropPct: number;
  clientId: number;
  clientCode: string;
  clientName: string;
  sourceCount: number;
  best: { price: number; merchant: string } | null;
};
type Source = {
  id: number;
  merchant: string;
  url: string;
  productId: number;
  productName: string;
  sku: string;
  currency: string;
  clientCode: string;
  clientName: string;
  price: number | null;
  inStock: number | null;
  checkedAt: string | null;
  lastSuccessfulCheckedAt: string | null;
  error: string | null;
  isStale: number | boolean | null;
  isPriceAnomaly: number | null;
  anomalyReason: string | null;
};
type Account = {
  organizationName: string;
  role: string;
  scope: 'organization' | 'client';
  clientId: number | null;
  subscriptionState: string;
  trialEndsAt: string;
  trialDaysRemaining: number;
  databaseEngine: string;
  dataRegion: string;
  billingConfigured: boolean;
  planName: string;
  sourceLimit: number;
};
type DashboardData = {
  clients: Client[];
  products: Product[];
  sources: Source[];
  account?: Account;
  metrics: {
    activeClients: number;
    watchedUrls: number;
    validPrices: number;
    issues: number;
  };
};

const initialData: DashboardData = {
  clients: [],
  products: [],
  sources: [],
  metrics: { activeClients: 0, watchedUrls: 0, validPrices: 0, issues: 0 },
};

export function PriceDashboard({ userEmail }: { userEmail: string }) {
  const { t, locale, intlLocale } = useI18n();

  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'client' | 'product' | 'source' | 'account';
    id: number;
    label: string;
  } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    source: Source;
    targetProductId: number;
  } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const batchResultRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      const next = (await response.json()) as DashboardData & {
        error?: string;
        needsOnboarding?: boolean;
      };
      if (next.needsOnboarding) {
        setOnboardingOpen(true);
        return;
      }
      if (!response.ok) {
        setMessage(next.error ?? t("Veriler yüklenemedi."));
        return;
      }
      setData(next);
      setLastUpdatedAt(new Date());
    } catch {
      setMessage(t("Güvenli veri bağlantısına ulaşılamadı."));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (!data.products.length) {
      setSelectedProductId(null);
      return;
    }
    if (
      !selectedProductId ||
      !data.products.some((product) => product.id === selectedProductId)
    )
      setSelectedProductId(data.products[0].id);
  }, [data.products, selectedProductId]);

  useEffect(() => {
    const modelContext =
      typeof document === 'undefined' ? undefined : document.modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      modelContext.registerTool(
        {
          name: 'add_competitor_watches',
          title: t("Rakip URL’leri ekle"),
          description:
            t("Seçilen müşteriye aynı ürün grubuna ait bir veya daha fazla rakip ürün URL’si ekler."),
          inputSchema: {
            type: 'object',
            properties: {
              clientCode: { type: 'string' },
              rows: {
                type: 'array',
                minItems: 1,
                maxItems: 1000,
                items: {
                  type: 'object',
                  properties: {
                    group: { type: 'string' },
                    name: { type: 'string' },
                    currency: { type: 'string' },
                    merchant: { type: 'string' },
                    url: { type: 'string' },
                    maxPriceDropPct: {
                      type: 'number',
                      minimum: 0,
                      exclusiveMaximum: 100,
                    },
                  },
                  required: ['group', 'name', 'merchant', 'url'],
                  additionalProperties: false,
                },
              },
            },
            required: ['clientCode', 'rows'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          async execute(input: unknown) {
            const response = await fetch('/api/watches', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(input),
            });
            const result = (await response.json()) as {
              error?: string;
              imported?: number;
              status?: string;
            };
            if (!response.ok) throw new Error(result.error ?? t("URL eklenemedi"));
            await load();
            return result;
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [load]);

  const filteredSources = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    if (!query) return data.sources;
    return data.sources.filter((source) =>
      [source.merchant, source.productName, source.clientName, source.sku].some(
        (value) => value.toLocaleLowerCase(locale).includes(query),
      ),
    );
  }, [data.sources, search]);

  const featuredProduct =
    data.products.find((product) => product.id === selectedProductId) ??
    data.products[0];
  const featuredSources = featuredProduct
    ? filteredSources.filter(
        (source) => source.productId === featuredProduct.id,
      )
    : filteredSources;
  const best = featuredProduct?.best ?? bestFromSources(featuredSources);
  const isClientPortal = data.account?.scope === 'client';

  async function addClient(formData: FormData) {
    setSaving(true);
    setMessage(null);
    try {
      const payload = Object.fromEntries(formData);
      await apiRequest(
        '/api/clients',
        { method: 'POST', body: JSON.stringify(payload) },
        t("Müşteri kaydedilemedi."),
      );
      setClientOpen(false);
      setMessage(t("Müşteri kaydedildi."));
      await load();
    } catch (error) {
      setMessage(errorMessage(error, t("Müşteri kaydedilemedi.")));
    } finally {
      setSaving(false);
    }
  }

  async function addWatch(formData: FormData) {
    setSaving(true);
    setMessage(null);
    try {
      const values = Object.fromEntries(formData);
      const payload = {
        clientCode: values.clientCode,
        rows: [
          {
            group: values.group,
            name: values.name,
            currency: values.currency,
            merchant: values.merchant,
            url: values.url,
            maxPriceDropPct: Number(values.maxPriceDropPct),
          },
        ],
      };
      await apiRequest(
        '/api/watches',
        { method: 'POST', body: JSON.stringify(payload) },
        t("Rakip URL kaydedilemedi."),
      );
      setWatchOpen(false);
      setMessage(t("Rakip URL kaydedildi."));
      await load();
    } catch (error) {
      setMessage(errorMessage(error, t("Rakip URL kaydedilemedi.")));
    } finally {
      setSaving(false);
    }
  }

  async function addProduct(formData: FormData) {
    setSaving(true);
    setMessage(null);
    try {
      const values = Object.fromEntries(formData);
      await apiRequest(
        '/api/products',
        {
          method: 'POST',
          body: JSON.stringify({
            clientCode: values.clientCode,
            sku: values.sku,
            name: values.name,
            currency: values.currency,
            maxPriceDropPct: Number(values.maxPriceDropPct),
          }),
        },
        t("Ürün grubu kaydedilemedi."),
      );
      setProductOpen(false);
      setMessage(t("Ürün grubu kaydedildi."));
      await load();
    } catch (error) {
      setMessage(errorMessage(error, t("Ürün grubu kaydedilemedi.")));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!deleteTarget) return;
    setSaving(true);
    setMessage(null);
    const endpoint =
      deleteTarget.kind === 'client'
        ? '/api/clients'
        : deleteTarget.kind === 'product'
          ? '/api/products'
          : deleteTarget.kind === 'source'
            ? '/api/sources'
            : '/api/account';
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body:
        deleteTarget.kind === 'account'
          ? undefined
          : JSON.stringify({ id: deleteTarget.id }),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? t("Kayıt silinemedi."));
      return;
    }
    if (deleteTarget.kind === 'account') {
      window.location.assign('/auth/logout');
      return;
    }
    const kindLabel =
      deleteTarget.kind === 'client'
        ? t("Müşteri")
        : deleteTarget.kind === 'product'
          ? t("Ürün grubu")
          : t("Rakip URL");
    setDeleteTarget(null);
    setMessage(
      t("{0} silindi. Geçmiş denetim kayıtları saklama politikasına göre korunur.", [kindLabel]),
    );
    await load();
  }

  async function moveSource(sourceId: number, targetProductId: number) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/sources', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: sourceId, targetProductId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? t("URL taşınamadı."));
        return;
      }
      const targetName = data.products.find(
        (product) => product.id === targetProductId,
      )?.name;
      setMoveTarget(null);
      setSelectedProductId(targetProductId);
      setMessage(
        t("Rakip URL{0} ürün grubuna taşındı ve görünür durumda.", [targetName ? ` “${targetName}”` : '']),
      );
      await load();
    } catch {
      setMessage(t("URL taşınırken bağlantı hatası oluştu."));
    } finally {
      setSaving(false);
    }
  }

  function requestMove(source: Source) {
    const firstTarget = data.products.find(
      (product) =>
        product.clientCode === source.clientCode &&
        product.id !== source.productId,
    );
    if (!firstTarget) {
      setMessage(t("Bu müşteriye ait başka bir ürün grubu bulunmuyor."));
      return;
    }
    setMoveTarget({ source, targetProductId: firstTarget.id });
  }

  async function importCsv(file: File) {
    setMessage(null);
    const rows = parseCsv(await file.text());
    if (!rows.length) {
      setMessage(t("CSV içinde geçerli URL satırı bulunamadı."));
      return;
    }
    const clientCode = rows[0].clientCode || data.clients[0]?.code;
    if (!clientCode) {
      setMessage(
        t("CSV dosyasında clientCode sütunu bulunmalı veya önce müşteri eklemelisiniz."),
      );
      return;
    }
    setSaving(true);
    const response = await fetch('/api/watches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientCode, rows }),
    });
    const result = (await response.json()) as {
      error?: string;
      imported?: number;
      status?: string;
    };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? t("CSV içe aktarılamadı."));
      return;
    }
    setMessage(t("{0} rakip URL içe aktarıldı.", [result.imported ?? rows.length]));
    await load();
  }

  function downloadBrowserQueue(scope: 'selected' | 'all') {
    const payload = createBrowserQueue(
      data.sources,
      scope === 'selected' && featuredProduct
        ? { productId: featuredProduct.id, locale }
        : { locale },
    );
    if (!payload.sources.length) {
      setMessage(
        scope === 'selected'
          ? t("Seçili ürün grubunda indirilecek URL bulunmuyor.")
          : t("İndirilecek rakip URL bulunmuyor."),
      );
      return;
    }
    if (payload.sources.length > 1000) {
      setMessage(
        t("Tek toplu kontrolde en fazla 1000 URL işlenebilir. URL’leri müşteri bazında bölün."),
      );
      return;
    }
    downloadJson(
      payload,
      `priceoptimize-kontrol-listesi-${scope === 'all' ? 'tum-urunler' : 'secili-urun'}-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setMessage(
      t("{0} ürün grubundaki {1} URL tek kontrol listesine indirildi. Dosyayı Price Optimizer eklentisinde açın.", [payload.productCount, payload.sources.length]),
    );
  }

  async function importBrowserResults(file: File) {
    setMessage(null);
    let payload: { format?: string; results?: unknown[]; failures?: unknown[] };
    try {
      payload = JSON.parse(await file.text()) as typeof payload;
    } catch {
      setMessage(t("Sonuç dosyası geçerli JSON biçiminde değil."));
      return;
    }
    if (
      payload.format !== 'priceoptimize-browser-results-v1' ||
      !Array.isArray(payload.results)
    ) {
      setMessage(t("Bu dosya Price Optimizer toplu tarayıcı sonucu değil."));
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<{
        error?: string;
        imported?: number;
        anomalies?: number;
        emailsSent?: number;
        failures?: Array<{ sourceId: number; error: string }>;
      }>(
        '/api/browser-observations/batch',
        {
          method: 'POST',
          body: JSON.stringify({ observations: payload.results }),
        },
        t("Toplu sonuçlar kaydedilemedi."),
      );
      const failedCount =
        (payload.failures?.length ?? 0) + (result.failures?.length ?? 0);
      setMessage(
        t("{0} fiyat kaydedildi{1}{2}{3}.", [result.imported ?? 0, result.anomalies ? t(", {0} anomali ayrıldı", [result.anomalies]) : '', failedCount ? t("; {0} kayıt inceleme bekliyor", [failedCount]) : '', result.emailsSent ? t("; {0} değişiklik e-postası gönderildi", [result.emailsSent]) : '']),
      );
      await load();
    } catch (error) {
      setMessage(errorMessage(error, t("Toplu sonuçlar kaydedilemedi.")));
    } finally {
      setSaving(false);
    }
  }

  async function createAccount(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const values = Object.fromEntries(formData);
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...values,
        locale,
        acceptedTerms: values.acceptedTerms === 'on',
        acceptedPrivacy: values.acceptedPrivacy === 'on',
        marketingConsent: values.marketingConsent === 'on',
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? t("Hesap oluşturulamadı."));
      return;
    }
    setOnboardingOpen(false);
    setMessage(t("30 günlük deneme hesabınız başladı."));
    await load();
  }

  async function requestPrivacyAction() {
    const response = await fetch('/api/privacy-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestType: 'access', jurisdiction: 'both' }),
    });
    const result = (await response.json()) as {
      error?: string;
      requestId?: string;
    };
    setMessage(
      response.ok
        ? t("Veri erişim talebiniz alındı: {0}", [result.requestId])
        : (result.error ?? t("Talep alınamadı.")),
    );
  }

  async function requestErasureAction() {
    const response = await fetch('/api/privacy-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestType: 'erasure', jurisdiction: 'both' }),
    });
    const result = (await response.json()) as {
      error?: string;
      requestId?: string;
    };
    setMessage(
      response.ok
        ? t("Silme talebiniz alındı: {0}. Kimlik ve yasal saklama kontrolünden sonra en geç 30 gün içinde sonuçlandırılacaktır.", [result.requestId])
        : (result.error ?? t("Silme talebi alınamadı.")),
    );
  }

  return (
    <SidebarProvider>
      <Sidebar
        className="border-r-0 bg-[#0b1720] text-white"
        collapsible="offcanvas"
      >
        <SidebarHeader className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#28d7a1] text-[#08201a] shadow-[0_0_30px_rgba(40,215,161,.24)]">
              <Tag className="size-5" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">
                Price Optimizer
              </p>
              <p className="text-xs text-slate-400">{t("Rakip fiyat merkezi")}</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-[.12em] text-slate-500 uppercase">
              {t("Çalışma alanı")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem
                  icon={<LayoutDashboard />}
                  label={t("Genel görünüm")}
                  active
                />
                {!isClientPortal && (
                  <NavItem
                    icon={<Building2 />}
                    label={t("Müşteriler")}
                    count={String(data.metrics.activeClients)}
                  />
                )}
                <NavItem
                  icon={<Store />}
                  label={t("Ürün grupları")}
                  count={String(data.products.length)}
                />
                <NavItem icon={<Bell />} label={t("Bildirimler")} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem icon={<Settings2 />} label={t("Ayarlar")} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 p-4">
          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white/5 p-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-700 text-xs font-semibold">
              EA
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {isClientPortal ? t("Müşteri hesabı") : t("Yönetici")}
              </p>
              <p className="truncate text-xs text-slate-400">{userEmail}</p>
            </div>
          </div>
          <a
            href="/legal"
            className="mt-3 block text-center text-xs text-slate-400 hover:text-white"
          >
            {t("Gizlilik ve güvenlik")}</a>
          <a
            href="/auth/logout"
            className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-3.5" />
            {' '}{t("Oturumu kapat")}</a>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#f4f7f7]">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur md:px-7">
          <SidebarTrigger className="md:hidden" />
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 border-slate-200 bg-slate-50 pl-9"
              placeholder={t("Ürün veya mağaza ara")}
            />
          </div>
          {!isClientPortal && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importCsv(file);
                  event.target.value = '';
                }}
              />
              <Button
                variant="outline"
                className="h-9 border-slate-200 bg-white"
                disabled={saving}
                onClick={() => fileRef.current?.click()}
              >
                <Upload />
                <span className="hidden lg:inline">{t("CSV yükle")}</span>
              </Button>
              <Button
                variant="outline"
                className="h-9 border-slate-200 bg-white"
                disabled={!data.clients.length}
                onClick={() => setProductOpen(true)}
              >
                <PackagePlus />
                <span className="hidden sm:inline">{t("Yeni ürün")}</span>
              </Button>
              <Button
                className="h-9 bg-[#0b1720] text-white hover:bg-[#15303d]"
                onClick={() => setClientOpen(true)}
              >
                <Plus />
                <span className="hidden sm:inline">{t("Yeni müşteri")}</span>
              </Button>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1480px] p-4 md:p-7">
          {message && (
            <output className="mb-4 block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {t(message ?? '')}
            </output>
          )}
          {data.account && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span>
                {isClientPortal ? (
                  <strong>{t("Müşteri görünümü · yalnızca size ait kayıtlar")}</strong>
                ) : data.account.subscriptionState === 'trialing' ? (
                  <>
                    <strong>{data.account.trialDaysRemaining} {' '}{t("gün")}</strong>{' '}
                    {' '}{t("deneme süreniz kaldı. Bitiş:")}{' '}
                    {new Date(data.account.trialEndsAt).toLocaleDateString(
                      intlLocale,
                    )}
                  </>
                ) : <strong>{t(subscriptionLabel(data.account.subscriptionState))} · {data.metrics.watchedUrls} / {data.account.sourceLimit} {' '}{t("link")}</strong>}
              </span>
              <span className="inline-flex items-center gap-2 font-medium">
                <Database className="size-4" />
                {' '}{t("Aiven MySQL ·")}{' '}{data.account.dataRegion} {' '}{t("veri bölgesi · 30 sn otomatik yenileme ·")}{' '}
                {lastUpdatedAt
                  ? lastUpdatedAt.toLocaleTimeString(intlLocale)
                  : t("yükleniyor")}
              </span>
            </div>
          )}
          {data.account &&
            !isClientPortal &&
            ['owner', 'admin'].includes(data.account.role) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                <div>
                  <p className="font-semibold text-[#0b1720]">
                    {t(data.account.planName)} {' '}{t("· 29 USD / ay ·")}{' '}{data.metrics.watchedUrls} / {data.account.sourceLimit} {' '}{t("link")}</p>
                  <p className="text-xs text-slate-500">
                    <a href="/pricing" className="underline">{t("Paket ayrıntıları")}</a> · <a href="/refunds" className="underline">{t("İade ve iptal")}</a>{t(". Ödeme etkinleştirildiğinde aylık yenilenir.")}</p>
                </div>
                <BillingActions
                  state={data.account.subscriptionState}
                  configured={data.account.billingConfigured}
                />
              </div>
            )}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
                <Activity className="size-4 text-[#0aa77b]" />
                {isClientPortal
                  ? t("Müşteri paneli hazır")
                  : t("Yönetim paneli hazır")}
              </div>
              <h1 className="text-2xl font-semibold tracking-[-.03em] text-[#0b1720] md:text-[32px]">
                {t("Fiyat operasyonu")}</h1>
              <p className="mt-1 text-[15px] text-slate-500">
                {isClientPortal
                  ? t("Rakip fiyatlarınızı, stok ve anomali durumlarını takip edin.")
                  : t("Müşterilerinizin rakip fiyatlarını ve istisnalarını tek yerden yönetin.")}
              </p>
            </div>
            {!isClientPortal && (
              <Button
                onClick={() => setWatchOpen(true)}
                className="w-fit bg-[#0b1720] text-white hover:bg-[#15303d]"
              >
                <Plus />
                {' '}{t("Rakip URL ekle")}</Button>
            )}
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title={t("Aktif müşteri")}
              value={String(data.metrics.activeClients)}
              detail={t("{0} ürün grubu", [data.clients.reduce((sum, client) => sum + Number(client.productCount), 0)])}
              icon={<Building2 />}
            />
            <Metric
              title={t("İzlenen URL")}
              value={String(data.metrics.watchedUrls)}
              detail={t("{0} geçerli fiyat", [data.metrics.validPrices])}
              icon={<Store />}
            />
            <Metric
              title={t("En iyi fiyat")}
              value={
                best
                  ? money(best.price, featuredProduct?.currency ?? 'TRY', locale)
                  : '—'
              }
              detail={best?.merchant ?? t("Henüz fiyat yok")}
              icon={<Tag />}
              accent
            />
            <Metric
              title={t("Dikkat gerekiyor")}
              value={String(data.metrics.issues)}
              detail={t("Erişim veya fiyat anomalisi")}
              icon={<AlertTriangle />}
              warning
            />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="border-0 bg-white shadow-[0_1px_0_rgba(15,23,42,.05),0_12px_32px_rgba(15,23,42,.04)] ring-1 ring-slate-200/80">
              <CardHeader className="border-b border-slate-100 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="active-product"
                      className="mb-1.5 block text-xs text-slate-500"
                    >
                      {t("Görüntülenen ürün grubu")}</Label>
                    <select
                      id="active-product"
                      value={featuredProduct?.id ?? ''}
                      onChange={(event) =>
                        setSelectedProductId(Number(event.target.value))
                      }
                      className="h-9 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0b1720]"
                      disabled={!data.products.length}
                    >
                      {data.products.length ? (
                        data.products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.clientName} — {product.name} ({product.sku}
                            )
                          </option>
                        ))
                      ) : (
                        <option value="">{t("Henüz ürün grubu yok")}</option>
                      )}
                    </select>
                    <CardDescription className="mt-2">
                      {featuredProduct
                        ? t("{0} rakip URL bu gruba bağlı", [featuredProduct.sourceCount])
                        : t("Önce müşteri ve ürün grubu ekleyin")}
                    </CardDescription>
                  </div>
                  {featuredProduct && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        %{featuredProduct.maxPriceDropPct} {' '}{t("düşüş filtresi")}</Badge>
                      {!isClientPortal && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() =>
                            setDeleteTarget({
                              kind: 'product',
                              id: featuredProduct.id,
                              label: featuredProduct.name,
                            })
                          }
                        >
                          <Trash2 />
                          {' '}{t("Ürünü sil")}</Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                      <TableHead className="h-11 pl-5 text-xs font-semibold text-slate-500">
                        {t("Mağaza")}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">
                        {t("Fiyat")}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">
                        {t("Durum")}</TableHead>
                      <TableHead className="hidden text-xs font-semibold text-slate-500 md:table-cell">
                        {t("Son kontrol")}</TableHead>
                      <TableHead className="min-w-40 text-right text-xs font-semibold text-slate-500">
                        {isClientPortal ? t("Bağlantı") : t("Yönet")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {featuredSources.length ? (
                      featuredSources.map((source) => (
                        <SourceRow
                          key={source.id}
                          source={source}
                          best={best}
                          products={data.products}
                          onRequestMove={requestMove}
                          onDelete={() =>
                            setDeleteTarget({
                              kind: 'source',
                              id: source.id,
                              label: t("{0} URL’si", [source.merchant]),
                            })
                          }
                          saving={saving}
                          readOnly={isClientPortal}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-28 text-center text-slate-500"
                        >
                          {t("Bu ürün grubuna henüz URL eklenmedi.")}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="space-y-5">
              <Card className="border-0 bg-[#0b1720] text-white shadow-[0_16px_40px_rgba(11,23,32,.16)] ring-0">
                <CardHeader>
                  <CardDescription className="text-slate-400">
                    {t("En iyi geçerli fiyat")}</CardDescription>
                  <CardTitle className="mt-1 text-[30px] font-semibold tracking-[-.04em]">
                    {best
                      ? money(best.price, featuredProduct?.currency ?? 'TRY', locale)
                      : '—'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {best?.merchant ?? t("Fiyat bekleniyor")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {best
                          ? t("Stokta • Geçerli fiyat")
                          : t("İlk kontrol henüz yapılmadı")}
                      </p>
                    </div>
                    <CheckCircle2 className="size-5 text-[#28d7a1]" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Activity className="size-4 text-[#087e60]" /> {' '}{t("Kontrol takvimi")}</CardTitle>
                  <CardDescription>
                    {t("Açık ürün sayfaları buluttan 6 saatte bir kontrol edilir. “Tarayıcı kontrolü gerekli” satırları Chrome doğrulamasını bekler.")}</CardDescription>
                </CardHeader>
              </Card>
              {!isClientPortal && (
                <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <MonitorUp className="size-4 text-[#087e60]" /> {' '}{t("Toplu tarayıcı kontrolü")}</CardTitle>
                    <CardDescription>
                      {t("Tüm ürün gruplarındaki URL’leri tek kontrol ve tek sonuç dosyasıyla normal Chrome oturumunuzda sırayla kontrol edin.")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <a
                      href="/price-optimizer-browser-extension.zip"
                      download
                      className={buttonVariants({
                        className:
                          'w-full bg-[#0b1720] text-white hover:bg-[#15303d]',
                      })}
                    >
                      <Download />
                      {' '}{t("Chrome eklentisini indir")}</a>
                    <Button
                      className="w-full bg-[#0b1720] text-white hover:bg-[#15303d]"
                      disabled={saving || data.sources.length === 0}
                      onClick={() => downloadBrowserQueue('all')}
                    >
                      <Download />
                      {' '}{t("Tüm ürün gruplarını indir (")}{data.sources.length})
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={saving}
                      onClick={() => downloadBrowserQueue('selected')}
                    >
                      <Download />
                      {' '}{t("Yalnız seçili ürünü indir (")}{' '}{featuredProduct?.sourceCount ?? 0})
                    </Button>
                    <input
                      ref={batchResultRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void importBrowserResults(file);
                        event.target.value = '';
                      }}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={saving}
                      onClick={() => batchResultRef.current?.click()}
                    >
                      <Upload />
                      {' '}{t("Sonuç dosyasını yükle")}</Button>
                    <p className="text-xs leading-5 text-slate-500">
                      {t("Listeyi eklentide başlatın. Eklenti aynı sekmeyi kullanır, siteler arasında bekler ve CAPTCHA’yı aşmadan sorunlu kayıtları ayırır.")}</p>
                  </CardContent>
                </Card>
              )}
              <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="size-4 text-emerald-600" /> {' '}{t("Güvenlik ve gizlilik")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-600">
                    {t("Kuruluş ve müşteri bazlı veri ayrımı, denetim kaydı ve saklama politikası etkin.")}</p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void requestPrivacyAction()}
                  >
                    {t("Verilerime erişim talebi")}</Button>
                  <a
                    href="/api/data-export"
                    download
                    className={buttonVariants({
                      variant: 'outline',
                      className: 'w-full',
                    })}
                  >
                    <Download />
                    {' '}{t("MySQL verilerimi indir")}</a>
                  {isClientPortal ? (
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() =>
                        setDeleteTarget({
                          kind: 'account',
                          id: data.account?.clientId ?? 0,
                          label: t("Hesabınız ve tüm kayıtlarınız"),
                        })
                      }
                    >
                      <Trash2 />
                      {' '}{t("Hesabımı ve verilerimi sil")}</Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => void requestErasureAction()}
                    >
                      <Trash2 />
                      {' '}{t("Kuruluş verilerini silme talebi")}</Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {!isClientPortal && (
            <Card className="mt-5 border-0 bg-white shadow-sm ring-1 ring-slate-200/80">
              <CardHeader>
                <CardTitle>{t("Müşteriler")}</CardTitle>
                <CardDescription>
                  {t("Her müşterinin ürün ve URL kayıtları birbirinden ayrıdır. Bildirim e-postasıyla giriş yapan müşteri yalnızca kendi kayıtlarını görür.")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">{t("Müşteri")}</TableHead>
                      <TableHead>{t("Kod")}</TableHead>
                      <TableHead>{t("E-posta")}</TableHead>
                      <TableHead>{t("Ürün")}</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="w-24 text-right">{t("Yönet")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.clients.length ? (
                      data.clients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="pl-5 font-medium">
                            {client.name}
                          </TableCell>
                          <TableCell>{client.code}</TableCell>
                          <TableCell>
                            {client.notificationEmail ?? '—'}
                          </TableCell>
                          <TableCell>{client.productCount}</TableCell>
                          <TableCell>{client.sourceCount}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              title={t("Müşteriyi sil")}
                              aria-label={t("{0} müşterisini sil", [client.name])}
                              onClick={() =>
                                setDeleteTarget({
                                  kind: 'client',
                                  id: client.id,
                                  label: client.name,
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-slate-500"
                        >
                          {t("Henüz müşteri eklenmedi.")}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </main>
      </SidebarInset>

      <ClientDialog
        open={clientOpen}
        onOpenChange={setClientOpen}
        saving={saving}
        onSubmit={addClient}
      />
      <ProductDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        saving={saving}
        clients={data.clients}
        onSubmit={addProduct}
      />
      <WatchDialog
        open={watchOpen}
        onOpenChange={setWatchOpen}
        saving={saving}
        clients={data.clients}
        onSubmit={addWatch}
      />
      <OnboardingDialog
        open={onboardingOpen}
        saving={saving}
        onSubmit={createAccount}
      />
      <DeleteDialog
        target={deleteTarget}
        saving={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteRecord}
      />
      <MoveSourceDialog
        target={moveTarget}
        products={data.products}
        saving={saving}
        onTargetChange={(targetProductId) =>
          setMoveTarget((current) =>
            current ? { ...current, targetProductId } : null,
          )
        }
        onCancel={() => setMoveTarget(null)}
        onConfirm={() =>
          moveTarget
            ? moveSource(moveTarget.source.id, moveTarget.targetProductId)
            : Promise.resolve()
        }
      />
    </SidebarProvider>
  );
}

function OnboardingDialog({
  open,
  saving,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const { t, locale, intlLocale } = useI18n();

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("30 günlük denemenizi başlatın")}</DialogTitle>
          <DialogDescription>
            {t("Yalnızca hizmet için gerekli kuruluş ve hesap bilgileri saklanır. Pazarlama izni isteğe bağlıdır.")}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <Field
            label={t("Kuruluş adı")}
            name="organizationName"
            placeholder={t("ABC Fiyat Danışmanlığı")}
          />
          <Field
            label={t("Kuruluş kodu")}
            name="organizationCode"
            placeholder="abc-fiyat"
          />
          <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
            <label className="flex items-start gap-3">
              <input
                name="acceptedPrivacy"
                type="checkbox"
                required
                className="mt-1"
              />
              <span><a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">{t("Gizlilik ve aydınlatma metnini")}</a> {' '}{t("okudum.")}</span>
            </label>
            <label className="flex items-start gap-3">
              <input
                name="acceptedTerms"
                type="checkbox"
                required
                className="mt-1"
              />
              <span><a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">{t("Hizmet koşullarını")}</a> {' '}{t("kabul ediyorum. 30 günlük deneme 10 link içerir; otomatik ücretli geçiş yapılmaz.")}</span>
            </label>
            <label className="flex items-start gap-3 text-slate-600">
              <input name="marketingConsent" type="checkbox" className="mt-1" />
              <span>{t("Ürün haberleri almak istiyorum (isteğe bağlı).")}</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? t("Başlatılıyor…") : t("Denemeyi başlat")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientDialog({
  open,
  onOpenChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const { t, locale, intlLocale } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Yeni müşteri")}</DialogTitle>
          <DialogDescription>
            {t("Müşterinin kayıtları benzersiz koduyla ayrılır. Giriş yapacak kişinin doğrulanmış ChatGPT e-postasını bildirim adresi olarak yazın.")}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <Field label={t("Müşteri adı")} name="name" placeholder={t("ABC Kozmetik")} />
          <Field label={t("Müşteri kodu")} name="code" placeholder="abc-kozmetik" />
          <Field
            label={t("Müşteri giriş ve bildirim e-postası")}
            name="email"
            type="email"
            required
            placeholder="fiyatlar@firma.com"
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <strong className="text-slate-800">{t("Kaydedilmeyen bilgiler:")}</strong>{' '}
            {' '}{t("parola, telefon, adres, ödeme/kart bilgisi, kimlik belgesi, ham IP, konum ve özel nitelikli kişisel veriler.")}</div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("Vazgeç")}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Kaydediliyor…' : t("Müşteriyi kaydet")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  saving,
  clients,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  clients: Client[];
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const { t, locale, intlLocale } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Yeni ürün grubu")}</DialogTitle>
          <DialogDescription>
            {t("Bir müşteriye ait ürünü oluşturun; rakip URL’leri daha sonra bu gruba ekleyebilirsiniz.")}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="product-client">{t("Müşteri")}</Label>
            <select
              id="product-client"
              name="clientCode"
              required
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.code}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <Field label={t("Grup kodu")} name="sku" placeholder="IPHONE-17-PROMAX" />
          <Field label={t("Para birimi")} name="currency" defaultValue="TRY" />
          <div className="sm:col-span-2">
            <Field
              label={t("Ürün adı")}
              name="name"
              placeholder={t("iPhone 17 Pro Max 256 GB")}
            />
          </div>
          <Field
            label={t("Düşüş eşiği (%)")}
            name="maxPriceDropPct"
            type="number"
            defaultValue="25"
            min="0"
            max="99.99"
            step="0.01"
          />
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("Vazgeç")}</Button>
            <Button type="submit" disabled={saving || !clients.length}>
              {saving ? 'Kaydediliyor…' : t("Ürünü kaydet")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WatchDialog({
  open,
  onOpenChange,
  saving,
  clients,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  clients: Client[];
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const { t, locale, intlLocale } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{' '}{t("Rakip URL ekle")}</DialogTitle>
          <DialogDescription>
            {t("Aynı ürünün rakip URL’lerinde aynı grup kodunu kullanın.")}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="clientCode">{t("Müşteri")}</Label>
            <select
              id="clientCode"
              name="clientCode"
              required
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.code}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <Field label={t("Grup kodu")} name="group" placeholder="LIORA-50ML" />
          <Field label={t("Para birimi")} name="currency" defaultValue="TRY" />
          <div className="sm:col-span-2">
            <Field
              label={t("Ürün adı")}
              name="name"
              placeholder={t("Liora Kadın Parfüm 50 ml")}
            />
          </div>
          <Field label={t("Mağaza")} name="merchant" placeholder="Trendyol" />
          <Field
            label={t("Düşüş eşiği (%)")}
            name="maxPriceDropPct"
            type="number"
            defaultValue="25"
          />
          <div className="sm:col-span-2">
            <Field
              label={t("Rakip ürün URL’si")}
              name="url"
              type="url"
              placeholder="https://..."
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("Vazgeç")}</Button>
            <Button type="submit" disabled={saving || !clients.length}>
              {saving ? 'Kaydediliyor…' : t("URL’yi kaydet")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target,
  saving,
  onCancel,
  onConfirm,
}: {
  target: {
    kind: 'client' | 'product' | 'source' | 'account';
    id: number;
    label: string;
  } | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t, locale, intlLocale } = useI18n();

  const detail =
    target?.kind === 'account'
      ? t("Müşteri hesabınız, ürünleriniz, URL’leriniz ve fiyat kayıtlarınızdaki tanımlayıcı içerik geri alınamayacak biçimde silinir veya anonimleştirilir. Yalnızca yasal imha kanıtı tutulur.")
      : target?.kind === 'client'
        ? t("Bu müşteriye bağlı tüm ürün grupları ve rakip URL’ler de panelden kaldırılır.")
        : target?.kind === 'product'
          ? t("Bu ürün grubuna bağlı tüm rakip URL’ler de panelden kaldırılır.")
          : t("Bu URL artık izlenmez. Geçmiş denetim kayıtları saklama politikasına göre korunur.");
  return (
    <AlertDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{target?.label} {' '}{t("silinsin mi?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {detail} {' '}{t("Bu işlemden önce doğru kaydı seçtiğinizi kontrol edin.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t("Vazgeç")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => void onConfirm()}
          >
            {saving ? 'Siliniyor…' : t("Evet, sil")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MoveSourceDialog({
  target,
  products,
  saving,
  onTargetChange,
  onCancel,
  onConfirm,
}: {
  target: { source: Source; targetProductId: number } | null;
  products: Product[];
  saving: boolean;
  onTargetChange: (targetProductId: number) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t, locale, intlLocale } = useI18n();

  const targets = target
    ? products.filter(
        (product) =>
          product.clientCode === target.source.clientCode &&
          product.id !== target.source.productId,
      )
    : [];
  const currentProduct = target
    ? products.find((product) => product.id === target.source.productId)
    : null;
  const destination = target
    ? products.find((product) => product.id === target.targetProductId)
    : null;

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Rakip URL’yi başka gruba taşı")}</DialogTitle>
          <DialogDescription>
            {target?.source.merchant ?? t("Bu URL")} {' '}{t("kaydı")}{' '}{currentProduct ? ` “${currentProduct.name}”` : ''} {' '}{t("grubundan seçtiğiniz gruba taşınır. Kayıt silinmez; işlemden sonra hedef grup otomatik olarak açılır.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="move-source-target">{t("Hedef ürün grubu")}</Label>
          <select
            id="move-source-target"
            value={target?.targetProductId ?? ''}
            disabled={saving}
            onChange={(event) => onTargetChange(Number(event.target.value))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {targets.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onCancel}
          >
            {t("Vazgeç")}</Button>
          <Button
            type="button"
            disabled={saving || !destination}
            onClick={() => void onConfirm()}
          >
            <ArrowRightLeft />
            {saving ? t("Taşınıyor…") : t("URL’yi taşı")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required {...props} />
    </div>
  );
}
function NavItem({
  icon,
  label,
  active,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  count?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        className={`h-10 ${active ? 'bg-white/10 text-white hover:bg-white/15 hover:text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
      >
        {icon}
        <span>{label}</span>
        {count && (
          <span className="ml-auto rounded-md bg-white/8 px-1.5 py-0.5 text-xs">
            {count}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
function Metric({
  title,
  value,
  detail,
  icon,
  accent,
  warning,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200/80">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-[26px] font-semibold tracking-[-.04em] text-[#0b1720]">
            {value}
          </p>
          <p
            className={`mt-1 text-xs ${warning ? 'text-amber-700' : accent ? 'text-[#087e60]' : 'text-slate-400'}`}
          >
            {detail}
          </p>
        </div>
        <div
          className={`grid size-10 place-items-center rounded-xl [&>svg]:size-[18px] ${warning ? 'bg-amber-50 text-amber-700' : accent ? 'bg-emerald-50 text-[#087e60]' : 'bg-slate-100 text-slate-500'}`}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
function SourceRow({
  source,
  best,
  products,
  onRequestMove,
  onDelete,
  saving,
  readOnly,
}: {
  source: Source;
  best: { price: number; merchant: string } | null;
  products: Product[];
  onRequestMove: (source: Source) => void;
  onDelete: () => void;
  saving: boolean;
  readOnly: boolean;
}) {
  const { t, locale, intlLocale } = useI18n();

  const isBest =
    best && source.price === best.price && source.merchant === best.merchant;
  const targets = products.filter(
    (product) => product.clientCode === source.clientCode,
  );
  return (
    <TableRow className="h-[62px] border-slate-100">
      <TableCell className="pl-5 font-medium text-slate-800">
        {source.merchant}
      </TableCell>
      <TableCell
        className={
          isBest
            ? 'font-semibold text-[#087e60]'
            : 'font-semibold text-slate-700'
        }
      >
        <div>
          <p>
            {source.price == null ? '—' : money(source.price, source.currency, locale)}
          </p>
          {source.isStale && source.lastSuccessfulCheckedAt && (
            <p className="mt-0.5 text-[11px] font-normal text-amber-700">
              {t("Son geçerli fiyat ·")}{' '}
              {new Date(source.lastSuccessfulCheckedAt).toLocaleString(intlLocale)}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge source={source} isBest={Boolean(isBest)} />
      </TableCell>
      <TableCell className="hidden text-slate-500 md:table-cell">
        {source.checkedAt
          ? new Date(source.checkedAt).toLocaleString(intlLocale)
          : t("Kontrol bekliyor")}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {!readOnly && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || targets.length < 2}
                onClick={() => onRequestMove(source)}
                aria-label={t("{0} URL’sini ürün grubuna taşı", [source.merchant])}
                title={t("URL’yi başka ürün grubuna taşı")}
                className="h-8"
              >
                <ArrowRightLeft />
                {' '}{t("Gruba taşı")}</Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title={t("Tarayıcıdan kontrol et")}
                aria-label={t("{0} fiyatını tarayıcıdan kontrol et", [source.merchant])}
                onClick={() => openBrowserCapture(source.url, source.id)}
              >
                <MonitorUp />
              </Button>
            </>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            title={t("Ürün bağlantısını aç")}
            aria-label={t("{0} bağlantısını aç", [source.merchant])}
            onClick={() =>
              window.open(source.url, '_blank', 'noopener,noreferrer')
            }
          >
            <ExternalLink />
          </Button>
          {!readOnly && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              title={t("Rakip URL’yi sil")}
              aria-label={t("{0} URL’sini sil", [source.merchant])}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
function StatusBadge({ source, isBest }: { source: Source; isBest: boolean }) {
  const { t, locale, intlLocale } = useI18n();

  if (isBest)
    return (
      <Badge className="bg-emerald-100 text-emerald-800">{t("En iyi fiyat")}</Badge>
    );
  if (source.isPriceAnomaly)
    return <Badge variant="destructive">{t("%25 filtresi")}</Badge>;
  if (
    source.error === 'HTTP_403' ||
    source.error === 'ROBOTS_DENIED' ||
    source.error === 'PRICE_NOT_FOUND'
  )
    return (
      <div className="space-y-1">
        <Badge className="bg-amber-100 text-amber-800">
          {t("Tarayıcı kontrolü gerekli")}</Badge>
        {source.isStale && (
          <p className="text-[11px] text-amber-700">
            {t("Gösterilen fiyat güncel değil")}</p>
        )}
      </div>
    );
  if (source.error) return <Badge variant="destructive">{t("Erişim hatası")}</Badge>;
  if (source.inStock === 0)
    return (
      <Badge variant="secondary" className="text-slate-500">
        {t("Stok yok")}</Badge>
    );
  if (source.price == null)
    return <Badge variant="outline">{t("Kontrol bekliyor")}</Badge>;
  return (
    <Badge variant="outline" className="border-slate-200 text-slate-600">
      {t("Stokta")}</Badge>
  );
}
function browserCaptureUrl(rawUrl: string, sourceId: number) {
  const url = new URL(rawUrl);
  url.searchParams.set('priceoptimize_source', String(sourceId));
  return url.toString();
}
function openBrowserCapture(rawUrl: string, sourceId: number) {
  const target = window.open('about:blank', '_blank');
  if (!target) return;
  target.opener = null;
  target.name = `priceoptimize-source-${sourceId}`;
  target.location.replace(browserCaptureUrl(rawUrl, sourceId));
}
function bestFromSources(sources: Source[]) {
  return sources
    .filter(
      (source) =>
        source.price != null &&
        !source.error &&
        source.inStock !== 0 &&
        !source.isPriceAnomaly,
    )
    .reduce<{ price: number; merchant: string } | null>(
      (best, source) =>
        !best || Number(source.price) < best.price
          ? { price: Number(source.price), merchant: source.merchant }
          : best,
      null,
    );
}
function money(value: number, currency: string, locale = 'tr') {
  return new Intl.NumberFormat(({tr:"tr-TR",en:"en-GB",de:"de-DE",fr:"fr-FR",it:"it-IT",es:"es-ES",pt:"pt-PT"} as Record<string,string>)[locale] || locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

async function apiRequest<T extends { error?: string } = { error?: string }>(
  path: string,
  init: RequestInit,
  fallback: string,
) {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const text = await response.text();
  let payload: T = {} as T;
  if (text) {
    try {
      payload = JSON.parse(text) as T;
    } catch {
      /* Sunucu HTML veya boş olmayan geçersiz bir yanıt döndürdü. */
    }
  }
  if (!response.ok)
    throw new Error(payload.error ?? `${fallback} (HTTP ${response.status})`);
  return payload;
}

function downloadJson(payload: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function subscriptionLabel(state: string) {
  if (state === 'trialing') return '30 günlük deneme';
  if (state === 'active') return 'Aktif';
  if (state === 'past_due') return 'Ödeme gecikmiş';
  if (state === 'cancelled') return 'İptal edilmiş';
  return 'Süresi dolmuş';
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = csvCells(lines[0]).map((cell) => cell.trim());
  return lines
    .slice(1)
    .map((line) => {
      const values = csvCells(line);
      return Object.fromEntries(
        headers.map((header, index) => [header, values[index]?.trim() ?? '']),
      );
    })
    .map((row) => ({
      clientCode: row.clientCode || row.client,
      group: row.group || row.sku,
      name: row.name,
      currency: row.currency || 'TRY',
      merchant: row.merchant,
      url: row.url,
      maxPriceDropPct: Number(
        row.maxPriceDropPct || row.max_price_drop_pct || 25,
      ),
    }))
    .filter((row) => row.group && row.name && row.merchant && row.url);
}
function csvCells(line: string) {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      cells.push(value);
      value = '';
    } else value += char;
  }
  cells.push(value);
  return cells;
}

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool(
        tool: {
          name: string;
          title?: string;
          description: string;
          inputSchema: object;
          annotations?: {
            readOnlyHint?: boolean;
            untrustedContentHint?: boolean;
          };
          execute(input: unknown): unknown;
        },
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}
