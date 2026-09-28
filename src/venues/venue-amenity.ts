/**
 * Fixed list of amenities a venue can offer. Kept in code (not a database
 * table) for the MVP; the frontend maps each value to a translated label.
 * Stored as strings in Venue.amenityIds.
 */
export enum VenueAmenity {
  SHOWER = 'SHOWER',
  CHANGING_ROOM = 'CHANGING_ROOM',
  LOCKERS = 'LOCKERS',
  PARKING = 'PARKING',
  TOWELS = 'TOWELS',
  EQUIPMENT = 'EQUIPMENT',
  WIFI = 'WIFI',
  ACCESSIBLE = 'ACCESSIBLE',
  WATER = 'WATER',
  MAT_PROVIDED = 'MAT_PROVIDED',
}
