'use client';

import { useId } from 'react';

export type TrackableBooking = { status: string; estimateApproved?: boolean };
const stages = ['Confirmed', 'Assigned', 'Inspecting', 'Awaiting approval', 'In progress', 'Ready', 'Completed'];

export function bookingStageIndex(booking: TrackableBooking) {
  switch (booking.status) {
    case 'BOOKED': return 0;
    case 'ASSIGNED': return 1;
    case 'IN_PROGRESS': return booking.estimateApproved ? 4 : 2;
    case 'AWAITING_APPROVAL': return 3;
    case 'QUALITY_CHECK': return 5;
    case 'COMPLETED': return 6;
    default: return 0;
  }
}
export function bookingStageLabel(booking: TrackableBooking) {
  return booking.status === 'CANCELLED' ? 'Booking cancelled' : stages[bookingStageIndex(booking)];
}
function point(index: number, radius: number) {
  // Seven evenly spaced stage boundaries across the upper 180-degree arc.
  const angle = (180 + index * (180 / (stages.length - 1))) * (Math.PI / 180);
  return { x: 100 + Math.cos(angle) * radius, y: 105 + Math.sin(angle) * radius };
}

/** A speedometer driven by the persisted booking state. */
export function BookingStatusTracker({ booking, compact = false, transitionKey = 0 }: { booking: TrackableBooking; compact?: boolean; transitionKey?: number }) {
  const arcId = `booking-gauge-arc-${useId().replaceAll(':', '')}`;
  const current = bookingStageIndex(booking);
  const turn = -90 + current * (180 / (stages.length - 1));
  const progress = current / (stages.length - 1);
  return (
    <figure className={`booking-gauge ${compact ? 'booking-gauge-compact' : ''} ${transitionKey ? 'is-advancing' : ''}`} aria-label={`Service status: ${bookingStageLabel(booking)}.`}>
      <svg viewBox="-28 0 256 132" aria-hidden="true">
        <defs>
          <path id={arcId} d="M 16 105 A 84 84 0 0 1 184 105" pathLength="1" />
        </defs>
        <use className="booking-gauge-track" href={`#${arcId}`} />
        <use className="booking-gauge-fill" href={`#${arcId}`} style={{ '--gauge-progress': progress } as React.CSSProperties} />
        {stages.map((label, index) => {
          const tick = point(index, 84), outer = point(index, 92), text = point(index, 110);
          return <g className={index <= current ? 'is-reached' : ''} key={label}>
            <line x1={tick.x} y1={tick.y} x2={outer.x} y2={outer.y} />
            {!compact && <text x={text.x} y={text.y} textAnchor={index === 0 ? 'start' : index === stages.length - 1 ? 'end' : 'middle'}>{label}</text>}
          </g>;
        })}
        {current < stages.length - 1 && (
          <g className="booking-gauge-needle" style={{ '--needle-turn': `${turn}deg` } as React.CSSProperties}>
            <line x1="100" y1="105" x2="100" y2="21" /><circle cx="100" cy="21" r="4" />
          </g>
        )}
      </svg>
      {!compact && <figcaption><span>{bookingStageLabel(booking)}</span><small>Live booking status</small></figcaption>}
    </figure>
  );
}
