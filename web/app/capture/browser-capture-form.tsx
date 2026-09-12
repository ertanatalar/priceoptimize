'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, MonitorUp, ShieldCheck } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Initial = {
  sourceId?: string;
  pageUrl?: string;
  price?: string;
  currency?: string;
  inStock?: string;
  title?: string;
};

type Candidate = {
  id: number;
  clientCode: string;
  clientName: string;
  productName: string;
  merchant: string;
};

export function BrowserCaptureForm({ initial }: { initial: Initial }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [saved, setSaved] = useState<{ anomaly: boolean; message?: string } | null>(null);

  async function save(formData: FormData) {
    setSaving(true);
    setError(null);
    const rawPrice = String(formData.get('price') ?? '').trim();
    const normalizedPrice = rawPrice.includes(',')
      ? rawPrice.replaceAll('.', '').replace(',', '.')
      : rawPrice;
    const selectedSourceId = String(formData.get('sourceId') ?? initial.sourceId ?? '').trim();
    const response = await fetch('/api/browser-observations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceId: Number(selectedSourceId),
        pageUrl: initial.pageUrl,
        price: Number(normalizedPrice),
        currency: formData.get('currency'),
        inStock: formData.get('inStock') === 'on',
      }),
    });
    const result = await response.json() as {
      error?: string;
      isPriceAnomaly?: boolean;
      anomalyReason?: string;
      candidates?: Candidate[];
    };
    setSaving(false);
    if (!response.ok) {
      if (result.candidates?.length) setCandidates(result.candidates);
      setError(result.error ?? 'Fiyat kaydedilemedi.');
      return;
    }
    setSaved({ anomaly: Boolean(result.isPriceAnomaly), message: result.anomalyReason });
  }

  if (saved) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f7] p-5">
        <Card className="w-full max-w-lg border-0 shadow-xl ring-1 ring-slate-200">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#0b1720]">Fiyat kaydedildi</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {saved.anomaly ? saved.message : 'Tarayıcıdan doğrulanan fiyat karşılaştırmaya dahil edildi.'}
              </p>
            </div>
            <a href="/" className={buttonVariants({ className: 'w-full bg-[#0b1720] text-white' })}>Panele dön</a>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f7] p-5">
      <Card className="w-full max-w-lg border-0 shadow-xl ring-1 ring-slate-200">
        <CardHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <MonitorUp className="size-5" />
          </div>
          <CardTitle>Tarayıcı fiyatını doğrula</CardTitle>
          <CardDescription>Fiyatı ürün sayfasıyla karşılaştırın. Siz onaylamadan kayıt yapılmaz.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={save} className="space-y-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="line-clamp-2 font-medium text-slate-800">{initial.title || 'Rakip ürün'}</p>
              <p className="mt-2 truncate text-xs text-slate-500">{initial.pageUrl}</p>
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Görünen fiyat</Label>
                <Input id="price" name="price" type="text" inputMode="decimal" defaultValue={initial.price} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Para birimi</Label>
                <Input id="currency" name="currency" maxLength={3} defaultValue={(initial.currency || 'TRY').toUpperCase()} required />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input name="inStock" type="checkbox" defaultChecked={initial.inStock !== 'false'} />
              <span>Ürün stokta görünüyor</span>
            </label>
            {candidates.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <Label htmlFor="sourceId">Fiyatın ait olduğu kayıt</Label>
                <select id="sourceId" name="sourceId" required defaultValue="" className="h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm text-slate-900">
                  <option value="" disabled>Müşteri ve ürünü seçin</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.clientName} — {candidate.productName} — {candidate.merchant}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3 text-sm leading-5 text-emerald-900">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <span>Kayıt müşteri hesabınızla eşleştirilir ve %25 aşırı düşüş kontrolünden geçirilir.</span>
            </div>
            <div className="flex gap-3">
              <a href="/" className={buttonVariants({ variant: 'outline', className: 'flex-1' })}><ArrowLeft />Vazgeç</a>
              <Button type="submit" disabled={saving} className="flex-1 bg-[#0b1720] text-white">
                {saving ? 'Kaydediliyor…' : 'Fiyatı kaydet'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
