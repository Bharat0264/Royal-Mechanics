// One-time operational cleanup. Run deliberately with `npm run cleanup:non-admin`.
// It preserves ADMIN users and removes all other accounts plus their records.
import mongoose from 'mongoose';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required.');
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const retainedAdmins = await users.find({ role: 'ADMIN' }, { projection: { _id: 1 } }).toArray();
  if (!retainedAdmins.length) throw new Error('Refusing cleanup: no ADMIN account exists.');
  const removed = await users.find({ role: { $ne: 'ADMIN' } }, { projection: { _id: 1 } }).toArray();
  const userIds = removed.map((user) => user._id);
  const bookings = await db.collection('servicerequests').find({ $or: [{ customerId: { $in: userIds } }, { mechanicId: { $in: userIds } }] }, { projection: { _id: 1 } }).toArray();
  const bookingIds = bookings.map((booking) => booking._id);
  await Promise.all([
    db.collection('sessions').deleteMany({ userId: { $in: userIds } }),
    db.collection('passwordresets').deleteMany({ userId: { $in: userIds } }),
    db.collection('reviews').deleteMany({ customerId: { $in: userIds } }),
    db.collection('invoices').deleteMany({ $or: [{ customerId: { $in: userIds } }, { bookingId: { $in: bookingIds } }] }),
    db.collection('servicerequests').deleteMany({ _id: { $in: bookingIds } }),
    db.collection('mechanicinvites').deleteMany({}),
    db.collection('mechanicinivites').deleteMany({}),
    users.deleteMany({ _id: { $in: userIds } }),
  ]);
  console.log(`Cleanup complete: retained ${retainedAdmins.length} admin account(s), removed ${userIds.length} non-admin account(s) and ${bookingIds.length} related booking(s).`);
} finally { await mongoose.disconnect(); }
