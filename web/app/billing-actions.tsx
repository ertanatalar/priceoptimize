'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PaddleInstance = {
  Environment: { set: (environment: 'sandbox') => void };
  Initialize: (options: {
    token: string;
    eventCallback?: (event: { name?: string }) => void;
  }) => void;
  Checkout: {
    open: (options: {
      items: Array<{ priceId: string; quantity: number }>;
      customer: { email: string };
      customData: { checkout_ref: string };
      settings: {
        displayMode: 'overlay';
        theme: 'light';
        locale: 'tr';
        allowLogout: false;
      };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleInstance;
  }
}

export function BillingActions({
  state,
  configured,
}: {
  state: string;
  configured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = ['active', 'past_due', 'cancelled'].includes(state);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' });
      const payload = (await response.json()) as {
        error?: string;
        environment?: 'sandbox' | 'production';
        clientToken?: string;
        priceId?: string;
        checkoutRef?: string;
        customerEmail?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? 'Ödeme başlatılamadı.');
      const paddle = await loadPaddle();
      if (payload.environment === 'sandbox') paddle.Environment.set('sandbox');
      paddle.Initialize({
        token: payload.clientToken!,
        eventCallback: (event) => {
          if (event.name === 'checkout.completed') window.location.reload();
        },
      });
      paddle.Checkout.open({
        items: [{ priceId: payload.priceId!, quantity: 1 }],
        customer: { email: payload.customerEmail! },
        customData: { checkout_ref: payload.checkoutRef! },
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          locale: 'tr',
          allowLogout: false,
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Ödeme başlatılamadı.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const payload = (await response.json()) as {
        error?: string;
        url?: string;
      };
      if (!response.ok || !payload.url)
        throw new Error(payload.error ?? 'Abonelik portalı açılamadı.');
      window.location.assign(payload.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Abonelik portalı açılamadı.',
      );
      setBusy(false);
    }
  }

  if (!configured)
    return (
      <p className="text-xs font-medium text-amber-700">
        Ödeme hesabı yapılandırması bekleniyor.
      </p>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        className="bg-[#0b1720] text-white hover:bg-[#15303d]"
        disabled={busy}
        onClick={() => void (paid ? openPortal() : startCheckout())}
      >
        {busy ? (
          <Loader2 className="animate-spin" />
        ) : paid ? (
          <ExternalLink />
        ) : (
          <CreditCard />
        )}
        {paid ? 'Aboneliği ve faturaları yönet' : 'Starter pakete geç'}
      </Button>
      {error && (
        <span className="text-xs font-medium text-red-700">{error}</span>
      )}
    </div>
  );
}

async function loadPaddle(): Promise<PaddleInstance> {
  if (window.Paddle) return window.Paddle;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-priceoptimize-paddle]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Ödeme ekranı yüklenemedi.')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.dataset.priceoptimizePaddle = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Ödeme ekranı yüklenemedi.'));
    document.head.appendChild(script);
  });
  if (!window.Paddle) throw new Error('Ödeme ekranı başlatılamadı.');
  return window.Paddle;
}
