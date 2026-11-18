import { readFile, writeFile } from 'node:fs/promises';
import { identityTransitionPlan, runtimeGrantPlan } from './transition-plan.mjs';

const args = process.argv.slice(2);
function option(name) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
try {
  if (args.includes('--apply')) throw Error('This tool is offline/dry-run only; --apply is intentionally unsupported.');
  const inventory = option('--inventory'), mappings = option('--mappings'), output = option('--out');
  if (!inventory || !mappings || !output) throw Error('Usage: node security/prepare-transition.mjs --inventory <private-json> --mappings <verified-json> --out <new-private-plan-json>');
  const users = JSON.parse(await readFile(inventory, 'utf8'));
  const verified = JSON.parse(await readFile(mappings, 'utf8'));
  const plan = { generatedAt: new Date().toISOString(), mode: 'offline-review-only', identity: identityTransitionPlan(users, verified), runtime: runtimeGrantPlan({ database: option('--database') || 'defaultdb', username: option('--runtime-user') || 'priceopt_runtime' }) };
  await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Review-only plan prepared for ${plan.identity.length} identities. No external service was contacted or changed.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
