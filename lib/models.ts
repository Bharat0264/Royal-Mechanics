import { Schema, model, models } from 'mongoose';
const userSchema = new Schema(
  {
    googleSubject: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    displayName: String,
    phone: String,
    passwordHash: { type: String, select: false },
    termsAcceptedAt: Date,
    specialties: { type: String, default: '' },
    role: {
      type: String,
      enum: ['ADMIN', 'MECHANIC', 'CUSTOMER'],
      default: 'CUSTOMER',
    },
    isAllowed: { type: Boolean, default: true },
  },
  { timestamps: true },
);
const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);
const inviteSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: Date,
  },
  { timestamps: true },
);
export const User = models.User || model('User', userSchema);
export const Session = models.Session || model('Session', sessionSchema);
export const MechanicInvite =
  models.MechanicInvite || model('MechanicInvite', inviteSchema);

const serviceRequestSchema = new Schema(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vehicleName: { type: String, required: true, trim: true },
    serviceCategory: { type: String, required: true, trim: true },
    serviceMode: {
      type: String,
      enum: ['SELF_DROP', 'PICKUP_DROP'],
      required: true,
    },
    notes: { type: String, default: '' },
    preferredSlot: { type: String, default: '' },
    pickupLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      capturedAt: Date,
      address: {
        line: String,
        area: String,
        city: String,
        state: String,
        pin: String,
      },
    },
    mechanicId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    mechanicEmail: { type: String, lowercase: true, trim: true },
    walkIn: { type: Boolean, default: false },
    customerPhone: { type: String, default: '' },
    intakePhotos: { type: [String], default: [] },
    faults: {
      type: [{ text: String, beforePhoto: String, afterPhoto: String, completed: { type: Boolean, default: false } }],
      default: [],
    },
    readyAt: Date,
    sentAt: Date,
    status: {
      type: String,
      enum: [
        'BOOKED',
        'ASSIGNED',
        'IN_PROGRESS',
        'QUALITY_CHECK',
        'COMPLETED',
        'AWAITING_APPROVAL',
        'CANCELLED',
      ],
      default: 'BOOKED',
      index: true,
    },
  },
  { timestamps: true },
);
serviceRequestSchema.add({
  estimate: { type: Number, min: 0, default: 0 },
  estimateApproved: { type: Boolean, default: false },
  inspectionPhotos: [String],
});
export const ServiceRequest =
  models.ServiceRequest || model('ServiceRequest', serviceRequestSchema);

const serviceCatalogSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, default: '' },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', index: true, unique: true, sparse: true },
    vehicleName: { type: String, default: '' },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    total: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    paymentHandlingFee: { type: Number, default: 0 },
    payableTotal: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID'],
      default: 'UNPAID',
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paymentMethod: { type: String, enum: ['RAZORPAY', 'CASH', 'UPI', 'CARD'] },
    paymentConfirmedAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true },
);
export const ServiceCatalog =
  models.ServiceCatalog || model('ServiceCatalog', serviceCatalogSchema);
export const Invoice = models.Invoice || model('Invoice', invoiceSchema);

const resetSchema = new Schema({
  tokenHash: { type: String, unique: true, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});
const reviewSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    vehicle: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true, maxlength: 1500 },
    approved: { type: Boolean, default: false },
  },
  { timestamps: true },
);
const contentSchema = new Schema(
  {
    key: { type: String, unique: true, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
const throttleSchema = new Schema({
  key: { type: String, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, index: { expires: 0 } },
});
export const PasswordReset =
  models.PasswordReset || model('PasswordReset', resetSchema);
export const Review = models.Review || model('Review', reviewSchema);
export const SiteContent =
  models.SiteContent || model('SiteContent', contentSchema);
export const AuthThrottle =
  models.AuthThrottle || model('AuthThrottle', throttleSchema);
