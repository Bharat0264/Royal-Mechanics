'use client';

import { useId } from 'react';

export type TrackableBooking = { status: string; estimateApproved?: boolean };
const stages = ['Confirmed', 'Assigned', 'Inspecting', 'Awaiting approval', 'In progress', 'Ready', 'Completed'];
const gaugeCenter = { x: 100, y: 105 };
const gaugeRadius = 84;
const startAngle = 180;
const totalSweepAngle = 180;

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
function pointAtAngle(angle: number, radius: number) {
  const radians = angle * (Math.PI / 180);
  return {
    x: gaugeCenter.x + Math.cos(radians) * radius,
    y: gaugeCenter.y + Math.sin(radians) * radius,
  };
}

function angleForProgress(progressPercent: number) {
  return startAngle + (progressPercent / 100) * totalSweepAngle;
}

/** A speedometer driven by the persisted booking state. */
export function BookingStatusTracker({ booking, compact = false, transitionKey = 0 }: { booking: TrackableBooking; compact?: boolean; transitionKey?: number }) {
  const arcId = `booking-gauge-arc-${useId().replaceAll(':', '')}`;
  const hubId = `booking-gauge-hub-${useId().replaceAll(':', '')}`;
  const current = bookingStageIndex(booking);
  const progressPercent = (current / (stages.length - 1)) * 100;
  // One angle controls the entire mechanical indicator at every state.
  const currentAngle = angleForProgress(progressPercent);
  const currentPoint = pointAtAngle(currentAngle, gaugeRadius);
  return (
    <figure className={`booking-gauge ${compact ? 'booking-gauge-compact' : ''} ${transitionKey ? 'is-advancing' : ''}`} aria-label={`Service status: ${bookingStageLabel(booking)}.`}>
      <svg viewBox="-28 0 256 132" aria-hidden="true">
        <defs>
          <path id={arcId} d="M 16 105 A 84 84 0 0 1 184 105" pathLength="1" />
          <radialGradient id={hubId} cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#fff1bc" />
            <stop offset="48%" stopColor="#f3c55f" />
            <stop offset="100%" stopColor="#bd7921" />
          </radialGradient>
        </defs>
        <use className="booking-gauge-track" href={`#${arcId}`} />
        <use className="booking-gauge-fill" href={`#${arcId}`} style={{ '--gauge-progress': progressPercent / 100 } as React.CSSProperties} />
        {stages.map((label, index) => {
          const stagePercent = (index / (stages.length - 1)) * 100;
          const stageAngle = angleForProgress(stagePercent);
          const tick = pointAtAngle(stageAngle, gaugeRadius), outer = pointAtAngle(stageAngle, 92), text = pointAtAngle(stageAngle, 100);
          return <g className={index <= current ? 'is-reached' : ''} key={label}>
            <line x1={tick.x} y1={tick.y} x2={outer.x} y2={outer.y} />
            {!compact && <text x={text.x} y={text.y} textAnchor={index === 0 ? 'end' : index === stages.length - 1 ? 'start' : 'middle'}>{label}</text>}
          </g>;
        })}
        <line className="booking-gauge-needle" x1={gaugeCenter.x} y1={gaugeCenter.y} x2={currentPoint.x} y2={currentPoint.y} />
        <circle className="booking-gauge-hub" cx={gaugeCenter.x} cy={gaugeCenter.y} r="6" fill={`url(#${hubId})`} />
        <circle className="booking-gauge-position-dot" cx={currentPoint.x} cy={currentPoint.y} r="4.6" />
      </svg>
      {!compact && <figcaption><span>{bookingStageLabel(booking)}</span><small>Live booking status</small></figcaption>}
    </figure>
  );
}
