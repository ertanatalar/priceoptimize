import type { NextConfig } from 'next';

// Only official checkout endpoints; production never authorizes sandbox hosts.
const paddleSandbox = process.env.PADDLE_ENVIRONMENT !== 'production';
const paddleCdn = 'https://cdn.paddle.com';
const paddleApi = paddleSandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
const paddleBuy = paddleSandbox ? 'https://sandbox-buy.paddle.com' : 'https://buy.paddle.com';
const paddleCheckout = paddleSandbox ? 'https://sandbox-create-checkout.paddle.com' : 'https://create-checkout.paddle.com';
const paddleStyles = paddleSandbox ? `${paddleCdn} https://sandbox-cdn.paddle.com` : paddleCdn;

const securityHeaders = [
  { key: 'Content-Security-Policy', value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' ${paddleStyles}; script-src 'self' ${paddleCdn}; connect-src 'self' ${paddleApi} ${paddleCheckout}; frame-src ${paddleBuy} ${paddleCheckout}; upgrade-insecure-requests` },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  async headers() { return [{ source: '/(.*)', headers: securityHeaders }, ...['/', '/pricing', '/terms', '/privacy', '/refunds', '/contact', '/capture', '/language'].map(source => ({ source, headers: [{key:'Cache-Control',value:'private, no-store'},{key:'Vary',value:'Cookie, Accept-Language'}] })), { source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'Vary', value: 'Cookie, Accept-Language' }] }, { source: '/auth/(.*)', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }]; },
};

export default nextConfig;
