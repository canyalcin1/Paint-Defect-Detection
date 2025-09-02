/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',           // `npx next export` üretir (out/)
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
