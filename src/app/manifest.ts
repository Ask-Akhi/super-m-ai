import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Super M AI',
    short_name: 'Super M AI',
    description: 'Australian grocery comparison with smarter product matching and live price search.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07111f',
    theme_color: '#0b1530',
    orientation: 'portrait',
    lang: 'en-AU',
    categories: ['shopping', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
