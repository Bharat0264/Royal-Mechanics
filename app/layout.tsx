import type { Metadata } from 'next';
import './globals.css';
import { PublicHeader } from './components/public-header';
import { InternalFeedback } from './components/internal-feedback';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <InternalFeedback />
        <PublicHeader />
        {children}
        <script
          id="royal-mechanics-local-business"
          type="application/ld+json"
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
