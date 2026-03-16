import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const now = new Date()
  const notified: string[] = []

  // Get all profiles with push subscriptions
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, push_subscription, notify_expiry_days, notify_low_qty')
    .not('push_subscription', 'is', null)

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ message: 'No subscribers' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  for (const profile of profiles) {
    // Get households for this user
    const { data: memberships } = await supabase
      .from('household_members')
      .select('household_id, households(name)')
      .eq('user_id', profile.id)

    if (!memberships || memberships.length === 0) continue

    for (const membership of memberships) {
      const householdId = membership.household_id
      const householdName = (membership.households as { name: string } | null)?.name || 'Аптечка'

      const daysAhead = profile.notify_expiry_days || 30
      const futureDate = new Date(now)
      futureDate.setDate(futureDate.getDate() + daysAhead)

      // Find expiring medicines
      const { data: expiringMeds } = await supabase
        .from('medicines')
        .select('name, expires_at, quantity, low_qty_threshold')
        .eq('household_id', householdId)
        .lte('expires_at', futureDate.toISOString().split('T')[0])
        .gte('expires_at', now.toISOString().split('T')[0])

      // Find low quantity medicines
      const { data: allMeds } = await supabase
        .from('medicines')
        .select('name, quantity, low_qty_threshold')
        .eq('household_id', householdId)

      const lowQtyMeds = profile.notify_low_qty
        ? (allMeds || []).filter(m => m.quantity <= m.low_qty_threshold)
        : []

      if (!expiringMeds?.length && !lowQtyMeds.length) continue

      // Build notification body
      const parts: string[] = []
      if (expiringMeds?.length) {
        const names = expiringMeds.slice(0, 2).map(m => m.name).join(', ')
        parts.push(`${names} истекает`)
      }
      if (lowQtyMeds.length) {
        const names = lowQtyMeds.slice(0, 2).map(m => m.name).join(', ')
        parts.push(`${names} заканчивается`)
      }

      const payload = {
        title: `MedBag: ${householdName}`,
        body: parts.join(' · '),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: `/app/${householdId}` },
      }

      // Send push notification (simplified — in production use web-push library)
      try {
        const subscription = profile.push_subscription as {
          endpoint: string
          keys: { auth: string; p256dh: string }
        }

        // This is a simplified implementation
        // In production, use the web-push library with proper VAPID signing
        await sendPushNotification(subscription, payload)
        notified.push(profile.id)
      } catch (e) {
        console.error('Push failed for', profile.id, e)
      }
    }
  }

  return new Response(JSON.stringify({ message: 'Done', notified }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function sendPushNotification(
  subscription: { endpoint: string; keys: { auth: string; p256dh: string } },
  payload: object
) {
  // In production, implement proper VAPID-signed Web Push
  // This requires implementing the Web Push protocol with ECDH key agreement
  // Consider using a library like web-push via npm in a different runtime
  console.log('Sending push to', subscription.endpoint, JSON.stringify(payload))
}
