import { getViewer } from './auth';
import {
  Invoice,
  Review,
  ServiceCatalog,
  ServiceRequest,
  SiteContent,
  User,
} from './models';
import {
  defaultServices,
  defaultSettings,
  defaultWorkshop,
} from './site-defaults';
export async function adminData() {
  const viewer = await getViewer();
  if (viewer?.role !== 'ADMIN') throw new Error('Admin access required.');
  const [bookings, users, services, reviews, content, invoices] =
    await Promise.all([
      ServiceRequest.find()
        .sort({ createdAt: -1 })
        .populate('customerId', 'displayName email phone')
        .lean(),
      User.find()
        .select('displayName email phone role specialties isAllowed createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      ServiceCatalog.find({ active: true }).sort({ createdAt: 1 }).lean(),
      Review.find().sort({ createdAt: -1 }).lean(),
      SiteContent.find().lean(),
      Invoice.find().sort({ createdAt: -1 }).lean(),
    ]);
  const catalogueInitialized = content.some(
    (x) => x.key === 'catalogueInitialized',
  );
  return JSON.parse(
    JSON.stringify({
      bookings,
      users,
      services:
        services.length || catalogueInitialized ? services : defaultServices,
      reviews,
      invoices,
      workshop:
        content.find((x) => x.key === 'workshop')?.value || defaultWorkshop,
      settings:
        content.find((x) => x.key === 'settings')?.value || defaultSettings,
    }),
  );
}
