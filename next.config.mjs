/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-leaflet@4 mis-handles React 18 Strict Mode's double-mount in dev,
  // throwing "Map container is already initialized." We disable strict mode
  // here so the dev UX is clean. Re-enable when we upgrade to react-leaflet@5.
  reactStrictMode: false,
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
