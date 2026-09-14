import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import mongoose from 'mongoose';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri?.startsWith('mongodb://127.0.0.1:27018/'))
  throw new Error(
    'Tests require the local development database on port 27018.',
  );
const base = 'http://localhost:3000';
const calls = [];
const compiled = ts.transpile(readFileSync('lib/haptics.tsx', 'utf8'), {
  module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX,
});
const context = {
  exports: {},
  navigator: { vibrate: (pattern) => calls.push(pattern) },
  require: () => ({
    createContext: () => ({ Provider: () => null }),
    useCallback: (value) => value,
    useContext: () => null,
    useEffect: () => {},
    useMemo: (value) => value(),
    useState: (value) => [value, () => {}],
  }),
};
vm.runInNewContext(compiled, context);
for (const type of ['light', 'medium', 'success', 'error', 'capture'])
  context.exports.triggerHaptic(type);
assert.equal(
  JSON.stringify(calls),
  JSON.stringify([10, 25, [15, 50, 15], 60, 15]),
);
vm.runInNewContext(compiled + '; exports.triggerHaptic("light");', {
  exports: {},
});
vm.runInNewContext(compiled + '; exports.triggerHaptic("light");', {
  exports: {},
  navigator: { vibrate: false },
});
await mongoose.connect(uri);
const db = mongoose.connection;
const ids = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
const bookingId = new mongoose.Types.ObjectId();
const tokens = ids.map(() => randomBytes(24).toString('hex'));
const photo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK4sAAAAASUVORK5CYII=';
async function call(path, index, body) {
  return fetch(base + path, {
    method: body ? 'PATCH' : 'GET',
    redirect: 'manual',
    headers: {
      Origin: base,
      ...(index === null
        ? {}
        : { Cookie: `royal_mechanics_session=${tokens[index]}` }),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function expectRedirect(path, index) {
  const response = await call(path, index);
  const body = await response.text();
  assert.ok(
    response.status === 307 || body.includes('NEXT_REDIRECT;replace;/;307;'),
    `${path} must redirect unauthorized users`,
  );
  assert.ok(
    !body.includes('Portal verification bike'),
    'Protected vehicle data must not render',
  );
}
try {
  await db
    .collection('users')
    .insertMany(
      ids.map((_id, i) => ({
        _id,
        email: `portal-check-${String(_id)}@example.test`,
        displayName: 'Same Test Name',
        role: ['CUSTOMER', 'MECHANIC', 'MECHANIC', 'ADMIN'][i],
        isAllowed: true,
      })),
    );
  await db
    .collection('sessions')
    .insertMany(
      ids.map((userId, i) => ({
        userId,
        tokenHash: createHash('sha256').update(tokens[i]).digest('hex'),
        expiresAt: new Date(Date.now() + 600000),
      })),
    );
  await db
    .collection('servicerequests')
    .insertOne({
      _id: bookingId,
      requestNumber: `TEST-${String(bookingId)}`,
      customerId: ids[0],
      mechanicId: ids[1],
      vehicleName: 'Portal verification bike',
      serviceCategory: 'General service',
      serviceMode: 'SELF_DROP',
      status: 'ASSIGNED',
      intakePhotos: [],
      faults: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  for (const path of ['/admin', '/admin/billing', '/mechanic'])
    await expectRedirect(path, 0);
  await expectRedirect('/mechanic', 3);
  await expectRedirect('/admin', 1);
  for (const section of [
    '',
    'bookings',
    'mechanics',
    'customers',
    'services',
    'reviews',
    'billing',
    'settings',
  ]) {
    const res = await call('/admin' + (section ? '/' + section : ''), 3);
    assert.equal(res.status, 200, `Registered admin route ${section}`);
    const html = await res.text();
    assert.ok(!html.includes('Main navigation'), 'No customer header in admin');
  }
  const queue = await call('/mechanic', 1);
  assert.equal(queue.status, 200);
  const html = await queue.text();
  assert.ok(html.includes('Portal verification bike'));
  assert.ok(!html.includes('Book a service'));
  const otherJob = await call(`/mechanic/jobs/${String(bookingId)}`, 2);
  const otherHtml = await otherJob.text();
  assert.ok(
    otherJob.status === 404 ||
      otherHtml.includes('NEXT_HTTP_ERROR_FALLBACK;404'),
    'Same name must not share jobs',
  );
  assert.ok(!otherHtml.includes('Portal verification bike'));
  const endpoint = `/api/jobs/${String(bookingId)}`;
  assert.equal(
    (
      await call(endpoint, 0, {
        action: 'intake',
        photos: [photo, photo, photo, photo],
      })
    ).status,
    403,
  );
  assert.equal((await call(endpoint, 2, { action: 'ready' })).status, 403);
  assert.equal(
    (await call(endpoint, 1, { action: 'addFault', text: 'Check brakes' }))
      .status,
    400,
  );
  assert.equal(
    (
      await call(endpoint, 1, {
        action: 'intake',
        photos: [photo, photo, photo],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(endpoint, 1, {
        action: 'intake',
        photos: [photo, photo, photo, photo],
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(endpoint, 1, { action: 'addFault', text: 'Check brakes' }))
      .status,
    200,
  );
  assert.equal(
    (await call(endpoint, 1, { action: 'fault', index: 0, completed: true }))
      .status,
    400,
  );
  assert.equal(
    (await call(endpoint, 1, { action: 'fault', index: 0, beforePhoto: photo }))
      .status,
    200,
  );
  assert.equal(
    (await call(endpoint, 1, { action: 'fault', index: 0, completed: true }))
      .status,
    400,
  );
  assert.equal(
    (
      await call(endpoint, 1, {
        action: 'fault',
        index: 0,
        afterPhoto: photo,
        completed: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(endpoint, 1, { action: 'addFault', text: 'Check chain' }))
      .status,
    200,
  );
  assert.equal((await call(endpoint, 1, { action: 'ready' })).status, 400);
  const saved = await db
    .collection('servicerequests')
    .findOne({ _id: bookingId });
  assert.equal(saved.faults[0].completed, true);
  assert.equal(saved.faults[0].beforePhoto, photo);
  assert.equal(
    (
      await call(endpoint, 1, {
        action: 'fault',
        index: 1,
        beforePhoto: photo,
        afterPhoto: photo,
        completed: true,
      })
    ).status,
    200,
  );
  assert.equal((await call(endpoint, 1, { action: 'ready' })).status, 200);
  assert.equal(
    (await call(endpoint, 1, { action: 'addFault', text: 'Late change' }))
      .status,
    409,
  );
  console.log(
    'PASS: exact haptic patterns and unsupported devices; eight registered admin pages; customer and staff role gates; same-name account isolation; four-photo intake; incremental faults preserve evidence; two-photo completion gate; all-fault readiness gate; ready job locked.',
  );
} finally {
  await db.collection('servicerequests').deleteOne({ _id: bookingId });
  await db.collection('sessions').deleteMany({ userId: { $in: ids } });
  await db.collection('users').deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
}
