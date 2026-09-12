import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PriceDashboard } from '@/app/price-dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireChatGPTUser('/');
  return <PriceDashboard userEmail={user.email} />;
}
