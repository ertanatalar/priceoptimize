import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { BrowserCaptureForm } from '@/app/capture/browser-capture-form';

export const dynamic = 'force-dynamic';

type Search = { sourceId?: string; pageUrl?: string; price?: string; currency?: string; inStock?: string; title?: string };

export default async function CapturePage({ searchParams }: { searchParams: Promise<Search> }) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  await requireChatGPTUser(`/capture?${query.toString()}`);
  return <BrowserCaptureForm initial={values} />;
}
