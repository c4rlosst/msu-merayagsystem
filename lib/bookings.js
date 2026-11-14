// Loads the scheduled visits that fall between two dates (Manila time), for the nurse calendar.
// Kept free of any UI imports so both the page and the "load more months" server action can use it.

const PAGE = 500;

/**
 * @param db   a Supabase client acting as the signed-in nurse
 * @param from first day to include, "YYYY-MM-DD"
 * @param to   first day NOT included, "YYYY-MM-DD"
 * @returns visits as plain objects with millisecond timestamps, ready to send to the browser
 */
export async function fetchBookings(db, from, to) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.from('appointments')
      .select('id, reference_number, reason, requested_start, requested_end, status')
      .in('status', ['confirmed', 'checked_in', 'completed', 'no_show'])
      .lt('requested_start', to + 'T00:00:00+08:00')
      .gt('requested_end', from + 'T00:00:00+08:00')
      .order('requested_start').order('id').range(offset, offset + PAGE - 1);
    if (error) throw new Error('Could not load the appointment calendar.');
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows.map((row) => ({
    id: row.id, reference: row.reference_number, reason: row.reason, status: row.status,
    start: Date.parse(row.requested_start), end: Date.parse(row.requested_end)
  }));
}
