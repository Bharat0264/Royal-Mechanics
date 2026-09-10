import { NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { getViewer, sameOrigin } from '@/lib/auth';
import { adminData } from '@/lib/admin-data';
import {
  ServiceCatalog,
  ServiceRequest,
  Review,
  SiteContent,
  User,
  Session,
  MechanicInvite,
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
            v.startsWith('https://') &&
            v.length < 2048,
        )
        .slice(0, 12)
    : [];
export async function GET() {
  try {
    if ((await getViewer())?.role !== 'ADMIN')
      return fail('Admin access required.', 403);
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
    if (viewer?.role !== 'ADMIN') return fail('Admin access required.', 403);
    const body = await request.json().catch(() => ({}));
    const { section, action, id } = body;
    const data = body.data || {};
    if (id && !isValidObjectId(id)) return fail('Invalid record ID.');
    if (section === 'bookings') {
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
      // Remove legacy invites so an old Google login cannot re-promote a demoted mechanic.
      if (role !== 'MECHANIC')
        await MechanicInvite.deleteMany({ email: user.email });
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
      await SiteContent.updateOne(
        { key: 'settings' },
        {
          $set: {
            value: {
              hours: text(data.hours),
              phone: text(data.phone, 30),
              email: text(data.email, 254),
              address: text(data.address),
              notifyBookings: data.notifyBookings === true,
              notifyReviews: data.notifyReviews === true,
            },
          },
        },
        { upsert: true },
      );
    } else return fail('Unknown management section.');
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      return fail('A record with this name already exists.', 409);
    return fail('Unable to save changes. Check the fields and try again.', 503);
  }
}
