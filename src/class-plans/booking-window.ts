// How far ahead a class can be booked: 30 x 24 hours from now (spec 0003).
// Session generation creates recurring sessions within this window, and the
// public catalog only shows sessions that start inside it.
export const BOOKING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
