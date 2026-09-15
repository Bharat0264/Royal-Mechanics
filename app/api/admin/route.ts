import { NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { getViewer, requestThrottle, sameOrigin } from '@/lib/auth';
import { adminData, guestAdminData } from '@/lib/admin-data';
import {
  ServiceCatalog,
  ServiceRequest,
  Review,
  SiteContent,
  User,
  Session,
} from '@/lib/models';
import { bookingStatuses, defaultServices } from '@/lib/site-defaults';
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
const text = (value: unknown, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const urls = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter(
          (v): v is string =>
            typeof v === 'string' &&
            (v.startsWith('https://') ||
              /^data:image\/(?:jpeg|png|webp);base64,/i.test(v)) &&
            v.length < 2_000_000,
        )
        .slice(0, 12)
    : [];
export async function GET() {
  try {
    const viewer = await getViewer();
    if (viewer?.role !== 'ADMIN')
      return fail('Admin access required.', 403);
    if (viewer.isGuest) return NextResponse.json(guestAdminData());
    return NextResponse.json(await adminData());
  } catch {
    return fail(
      'Unable to load workshop data. Check the database connection.',
      503,
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('Invalid request origin.', 403);
  try {
    const viewer = await getViewer();
    if (viewer?.role !== 'ADMIN' || viewer.isGuest)
      return fail(viewer?.isGuest ? 'Sign in to make changes.' : 'Admin access required.', 403);
    if (!(await requestThrottle(request, 'admin-write', 60, viewer.id)))
      return fail('Too many requests. Please try again later.', 429);
    const body = await request.json().catch(() => ({}));
    const { section, action, id } = body;
    const data = body.data || {};
    if (id && !isValidObjectId(id)) return fail('Invalid record ID.');
    if (section === 'walkin') {
      const name = text(data.customerName, 100), phone = text(data.phone, 30), vehicleName = text(data.vehicleName, 100), serviceCategory = text(data.serviceCategory, 100);
      if (!name || !phone || !vehicleName || !serviceCategory) return fail('Customer name, phone, vehicle and service are required.');
      const email = text(data.email, 254).toLowerCase();
      // A returning walk-in gets another booking on their existing account.
      // Neither their phone nor their email can create a duplicate customer.
      let customer = await User.findOne({
        $or: [{ phone }, ...(email ? [{ email }] : [])],
      });
      if (!customer) {
        const accountEmail = email || `walkin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@royal-mechanics.local`;
        customer = await User.create({ displayName: name, phone, email: accountEmail, role: 'CUSTOMER', isAllowed: true });
      } else {
        customer.displayName = customer.displayName || name; customer.phone = phone; await customer.save();
      }
      await ServiceRequest.create({ requestNumber: `RM-W${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`, customerId: customer._id, customerPhone: phone, vehicleName, serviceCategory, serviceMode: 'SELF_DROP', notes: text(data.notes, 1500), walkIn: true, status: 'BOOKED' });
    } else if (section === 'bookings') {
      if (
        !id ||
        !bookingStatuses.includes(data.status) ||
        !Number.isFinite(data.estimate) ||
        data.estimate < 0
      )
        return fail('A valid status and estimate are required.');
      const mechanic = data.mechanicId
        ? await User.findOne({
            _id: data.mechanicId,
            role: 'MECHANIC',
            isAllowed: true,
          })
        : null;
      if (data.mechanicId && !mechanic)
        return fail('Choose an active mechanic.');
      const found = await ServiceRequest.findByIdAndUpdate(
        id,
        {
          $set: {
            status: data.status,
            estimate: data.estimate,
            estimateApproved: data.estimateApproved === true,
            notes: text(data.notes, 1500),
            inspectionPhotos: urls(data.inspectionPhotos),
            mechanicId: mechanic ? mechanic._id : null,
            mechanicEmail: mechanic ? mechanic.email : null,
            completedAt: data.status === 'COMPLETED' ? new Date() : null,
          },
        },
        { runValidators: true },
      );
      if (!found) return fail('Booking not found.', 404);
    } else if (section === 'services') {
      if (!(await SiteContent.exists({ key: 'catalogueInitialized' }))) {
        for (const service of defaultServices)
          await ServiceCatalog.updateOne(
            { name: service.name },
            { $setOnInsert: service },
            { upsert: true },
          );
        await SiteContent.updateOne(
          { key: 'catalogueInitialized' },
          { $set: { value: true } },
          { upsert: true },
        );
      }
      if (action === 'delete') {
        if (!id && !text(data.originalName, 100))
          return fail('Select a service.');
        await ServiceCatalog.updateOne(
          id ? { _id: id } : { name: text(data.originalName, 100) },
          { $set: { active: false } },
        );
      } else {
        if (
          !text(data.name, 100) ||
          !text(data.description) ||
          !Number.isFinite(data.price) ||
          data.price < 0
        )
          return fail('Name, description and a valid price are required.');
        const values = {
          name: text(data.name, 100),
          description: text(data.description),
          price: data.price,
          active: true,
        };
        await ServiceCatalog.findOneAndUpdate(
          id
            ? { _id: id }
            : { name: text(data.originalName, 100) || values.name },
          { $set: values },
          { upsert: !id, runValidators: true },
        );
      }
    } else if (section === 'reviews') {
      if (!id) return fail('Select a review.');
      await Review.updateOne(
        { _id: id },
        { $set: { approved: data.approved === true } },
      );
    } else if (section === 'staff' || section === 'accounts') {
      if (!id) return fail('Choose a registered account.');
      const role = section === 'staff' ? 'MECHANIC' : data.role;
      if (!['ADMIN', 'CUSTOMER', 'MECHANIC'].includes(role))
        return fail('Choose a valid role.');
      if (id === viewer.id && (role !== 'ADMIN' || data.isAllowed === false))
        return fail('You cannot remove your own admin access.');
      const user = await User.findById(id);
      if (!user) return fail('Account not found.', 404);
      user.role = role;
      user.specialties = text(data.specialties);
      user.isAllowed = data.isAllowed !== false;
      if (text(data.displayName, 100))
        user.displayName = text(data.displayName, 100);
      await user.save();
      await Session.deleteMany({ userId: id });
    } else if (section === 'workshop') {
      if (!text(data.title, 100) || !text(data.description))
        return fail('Title and introduction are required.');
      await SiteContent.updateOne(
        { key: 'workshop' },
        {
          $set: {
            value: {
              title: text(data.title, 100),
              description: text(data.description),
              about: text(data.about, 4000),
              photos: urls(data.photos),
            },
          },
        },
        { upsert: true },
      );
    } else if (section === 'settings') {
      const feeMode = (value: unknown) => value === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT';
      const feeValue = (value: unknown) => Math.min(100_000, Math.max(0, Number(value || 0)));
      await SiteContent.updateOne(
        { key: 'settings' },
        {
          $set: {
            value: {
              hours: text(data.hours),
              phone: text(data.phone, 30),
              email: text(data.email, 254),
              gstin: text(data.gstin, 30).toUpperCase(),
              address: text(data.address),
              notifyBookings: data.notifyBookings === true,
              notifyReviews: data.notifyReviews === true,
              fees: {
                platform: { mode: feeMode(data.platformFeeMode), value: feeValue(data.platformFeeValue), absorbed: data.platformFeeAbsorbed !== false },
                gateway: { mode: feeMode(data.gatewayFeeMode), value: feeValue(data.gatewayFeeValue), absorbed: data.gatewayFeeAbsorbed !== false },
                taxRate: Math.min(28, Math.max(0, Number(data.taxRate || 0))),
              },
            },
          },
        },
        { upsert: true },
      );
    } else return fail('Unknown management section.');
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { code?: number; keyPattern?: Record<string, number> }).code === 11000) {
      const field = Object.keys((e as { keyPattern?: Record<string, number> }).keyPattern || {})[0];
      return fail(field === 'email' ? 'That email already belongs to an account. Use the existing customer or leave email blank.' : 'This record already exists. Please try saving again.', 409);
    }
    return fail('Unable to save changes. Check the fields and try again.', 503);
  }
}
