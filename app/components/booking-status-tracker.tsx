'use client';

import {
  Check,
  ClipboardCheck,
  CreditCard,
  Gauge,
  ShieldCheck,
  UserCheck,
  Wrench,
} from 'lucide-react';

export type TrackableBooking = {
  status: string;
  estimateApproved?: boolean;
};

const stages = [
  { label: 'Booking Confirmed', icon: Check },
  { label: 'Mechanic Assigned', icon: UserCheck },
  { label: 'Inspection in Progress', icon: ClipboardCheck },
  { label: 'Awaiting Your Approval', icon: ShieldCheck },
  { label: 'Work in Progress', icon: Wrench },
  { label: 'Vehicle Ready', icon: Gauge },
  { label: 'Paid & Completed', icon: CreditCard },
] as const;

/** Maps persisted job state and approval data to the customer journey. */
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
  return booking.status === 'CANCELLED'
    ? 'Booking cancelled'
    : stages[bookingStageIndex(booking)].label;
}

export function BookingStatusTracker({
  booking,
  compact = false,
  transitionKey = 0,
}: {
  booking: TrackableBooking;
  compact?: boolean;
  transitionKey?: number;
}) {
  const current = bookingStageIndex(booking);
  const cancelled = booking.status === 'CANCELLED';
  return (
    <div
      className={`booking-tracker ${compact ? 'booking-tracker-compact' : ''} ${transitionKey ? 'is-advancing' : ''}`}
      aria-label={`Service status: ${bookingStageLabel(booking)}`}
    >
      <div className="booking-tracker-line" aria-hidden="true">
        <i
          style={
            { '--progress': `${(current / (stages.length - 1)) * 100}%` } as React.CSSProperties
          }
        />
      </div>
      <ol>
        {stages.map(({ label, icon: Icon }, index) => {
          const state = cancelled
            ? 'is-upcoming'
            : index < current
              ? 'is-complete'
              : index === current
                ? 'is-current'
                : 'is-upcoming';
          return (
            <li className={state} key={label}>
              <span className="booking-tracker-icon" key={`${transitionKey}-${label}`}>
                {index < current ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}
              </span>
              <b>{label}</b>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
