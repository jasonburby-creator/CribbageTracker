import { supabase } from "@/lib/supabase";

// Whether the signed-in user (if any) is one of the two players tied to a
// trip — the only people allowed to score or edit its games. Goes through
// the is_tied_to_trip() Postgres function (see supabase-schema.sql) rather
// than comparing emails client-side, so the client never has to fetch anyone's
// actual email address to decide this.
//
// Fails open (returns true) if the RPC itself errors — e.g. the Phase A
// schema hasn't been run against this Supabase project yet, in which case
// nothing is restricted server-side either, so gating the UI would just be
// confusing. Once the schema is in place this only returns false when the
// signed-in user genuinely isn't tied to the trip.
export async function canEditTrip(tripId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_tied_to_trip", {
    p_trip_id: tripId,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("is_tied_to_trip RPC failed, defaulting to allowed:", error.message);
    return true;
  }
  return !!data;
}
