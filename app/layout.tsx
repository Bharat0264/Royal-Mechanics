import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import './globals.css';
import { InternalFeedback } from './components/internal-feedback';
import { WorkshopThemeProvider } from './components/workshop-theme-provider';
import { HapticsProvider } from '@/lib/haptics';

export const metadata: Metadata = {
  title: 'Royal Mechanics | Two-Wheeler Service & Repair',
  description:
    'Trusted two-wheeler servicing with transparent digital inspections and approvals.',
  keywords: [
    'bike service',
    'scooter repair',
    'two-wheeler workshop',
    'Royal Mechanics',
  ],
};

// Controls the browser chrome as well as the document background. Keeping this
// charcoal prevents a browser-provided purple theme strip above the app.
export const viewport: Viewport = {
  themeColor: '#090b0f',
  colorScheme: 'dark',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const nonce = (await headers()).get('x-nonce') || undefined;
  const initialLight = cookieStore.get('royal-mechanics-theme')?.value === 'light';
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <WorkshopThemeProvider initialLight={initialLight}>
          <HapticsProvider>
            <InternalFeedback />
            {children}
          </HapticsProvider>
        </WorkshopThemeProvider>
        <script
          id="royal-mechanics-local-business"
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'AutomotiveBusiness',
              name: 'Royal Mechanics',
              description: 'Two-wheeler service and repair workshop.',
              url: '/',
              serviceType: 'Two-wheeler servicing and repair',
              address: {
                '@type': 'PostalAddress',
                streetAddress:
                  'Shop No. 07, Plot No. 05, Sai Raj Building, opposite Gurudwara, Gurudwara Road',
                addressLocality: 'New Panvel, Navi Mumbai',
                addressRegion: 'Maharashtra',
                postalCode: '410206',
                addressCountry: 'IN',
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
