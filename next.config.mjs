/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://3.108.220.238:15000/:path*',
      },
    ];
  },
};

export default nextConfig;
