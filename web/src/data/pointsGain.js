// How many points the player just earned, given the balance last seen and the user now.
// Returns 0 for the first sighting, a different account, a spend, or no change, so only a real gain animates.
export function pointsGain(prev, user) {
  if (!user || !prev || prev.id !== user._id) return 0;
  const delta = user.faze_points - prev.points;
  return Number.isFinite(delta) && delta > 0 ? delta : 0;
}
