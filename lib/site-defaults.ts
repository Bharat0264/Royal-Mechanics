export const defaultServices = [
  {
    name: 'General Service',
    description: 'Full inspection, fluids & tune-up',
    price: 899,
  },
  {
    name: 'Brakes & Safety',
    description: 'Pads, discs, fluid & alignment',
    price: 499,
  },
  {
    name: 'Tyres & Battery',
    description: 'Fitment, balancing & health check',
    price: 399,
  },
  {
    name: 'Engine Diagnostics',
    description: 'Expert fault scanning & diagnostics',
    price: 699,
  },
  {
    name: 'Chain & Drivetrain',
    description: 'Clean, adjust & lubricate',
    price: 299,
  },
  {
    name: 'Pickup & Drop',
    description: 'Doorstep care for your two-wheeler',
    price: 199,
  },
];
export const defaultWorkshop = {
  title: 'Craft lives here.',
  description: 'Built by riders. Trusted by riders.',
  about:
    'Precision, patience and a passion for two wheels. We bring thoughtful care to every bike that enters our workshop.',
  photos: [] as string[],
};
export const defaultSettings = {
  hours: 'Mon–Thu & Sat–Sun · 10:00 AM–7:00 PM',
  phone: '+91 91823 72075',
  email: '',
  address:
    'Shop No. 07, Plot No. 05, Sai Raj Building, opposite Gurudwara, Gurudwara Road, New Panvel, Navi Mumbai 410206',
  notifyBookings: true,
  notifyReviews: true,
};
export const bookingStatuses = [
  'BOOKED',
  'ASSIGNED',
  'IN_PROGRESS',
  'AWAITING_APPROVAL',
  'QUALITY_CHECK',
  'COMPLETED',
  'CANCELLED',
];
export const statusLabel = (value: string) =>
  ({
    BOOKED: 'Pending',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In progress',
    AWAITING_APPROVAL: 'Awaiting approval',
    QUALITY_CHECK: 'Quality check',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  })[value] || value;
