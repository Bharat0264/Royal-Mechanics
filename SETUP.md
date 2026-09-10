# Royal Mechanics setup

Run `npm.cmd run dev` on Windows (or `npm run dev` elsewhere).

The local `.env.local` uses a local MongoDB database on port 27018. Keep MongoDB running before using accounts or management pages. The public site still renders if the database is unavailable; account operations show an error.

## Production configuration

Set these values in a private environment file or your hosting environment:

```
MONGODB_URI=mongodb://your-database/royal_mechanics
APP_URL=https://your-domain.example
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=Royal Mechanics <accounts@your-verified-domain.example>
ADMIN_EMAIL=your-workshop-owner@example.com
```

Register every live site URL followed by `/api/auth/google/callback` as an authorized Google OAuth redirect URI. For example, the current Vercel deployment needs `https://royal-mechanics-one.vercel.app/api/auth/google/callback`; local development needs `http://localhost:3000/api/auth/google/callback`. Google sign-in and reset email intentionally return an unavailable message until configured. Reset links expire after 30 minutes; password changes revoke existing sessions. Email/password signups always receive the CUSTOMER role. The configured owner email receives ADMIN access only after Google verifies its ownership.

Alternatively, bootstrap the first administrator on your own database with the script below after creating its account. Additional accounts and roles can then be managed through Admin → Settings.

```
node --env-file=.env.local scripts/promote-admin.mjs owner@example.com
```

Admin portal: `/admin`. Customer/mechanic account: `/dashboard`. No public admin bypass is provided. Services, approved reviews, workshop text/photo URLs, business details, and in-app notification preferences are persisted in MongoDB. Revenue uses paid invoices; charts do not invent revenue. Mechanic profiles are created by assigning a registered customer account the mechanic role. Photos currently use hosted HTTPS image URLs.

Before using an existing database, run `node --env-file=.env.local scripts/migrate-auth.mjs` once to migrate the old Google-only unique index to a sparse index. Back up production data first.

The Terms and Privacy pages are starter notices describing these features. The business should review and replace them before launch. Existing example environment values should not be used as production credentials.
