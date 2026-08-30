/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@NexusKey/shared'],
  async headers() {
    // Safe, low-risk security headers that don't restrict script/connect
    // sources -- a strict Content-Security-Policy is deliberately NOT set
    // here, since RainbowKit/WalletConnect's modal and relay connections
    // need careful CSP tuning to avoid silently breaking wallet-connect
    // flows, and that tuning needs its own dedicated test pass (see
    // docs/SECURITY.md, "Known limitations").
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  webpack: (config) => {
    // wagmi's Coinbase Smart Wallet connector pulls in @coinbase/cdp-sdk,
    // which optionally imports @x402/* payment-protocol subpackages behind
    // a try/catch for a feature this app doesn't use (x402 payments). Those
    // subpackages aren't installed and don't need to be -- stub them out so
    // webpack doesn't fail resolving an intentionally-optional import.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@x402/evm/upto/client': false,
      '@x402/evm/exact/client': false,
      '@x402/core/client': false,
      '@x402/svm/exact/client': false,
      '@x402/evm': false,
      // MetaMask SDK's optional React Native storage backend, and
      // WalletConnect's optional pretty-printer for its pino logger --
      // neither is used in a browser/Next.js context.
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };
    return config;
  },
};

module.exports = nextConfig;
