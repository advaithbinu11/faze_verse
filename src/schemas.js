import { isDeepStrictEqual } from 'node:util';

// JSON-Schema validators + indexes for every collection. ensureSchema() applies them
// idempotently (createCollection, or collMod if the collection already exists), so
// this replaces setup_db.sh and is safe to run on every boot.

const strArray = { bsonType: 'array', items: { bsonType: 'string' } };

export const validators = {
  users: {
    bsonType: 'object',
    required: ['user_name', 'faze_points'],
    properties: {
      user_name: { bsonType: 'string', minLength: 1 },
      steam_id: { bsonType: 'string' },
      email: { bsonType: 'string' },
      password_hash: { bsonType: 'string' },
      // Typed at signup, never trusted: only the Steam OpenID login sets the verified steam_id.
      steam_id_unverified: { bsonType: 'string' },
      favorite_players: strArray,
      profile_color: { bsonType: 'string', pattern: '^#[0-9a-f]{6}$' },
      avatar: { bsonType: 'string' },
      profile_url: { bsonType: 'string' },
      role: { enum: ['user', 'admin'] },
      faze_points: { bsonType: 'int', minimum: 0 },
      watched_history: strArray,
      faze_teams_followed: strArray,
      regions: strArray,
      discord_id: { bsonType: 'string' },
      discord_username: { bsonType: 'string' },
      discord_linked_at: { bsonType: 'date' },
      discord_channel: { bsonType: 'string' },
    },
  },
  events: {
    bsonType: 'object',
    required: [
      'event_id', 'title', 'team_a', 'team_b', 'game_name', 'start_time',
      'status', 'total_points_invested', 'team_a_points', 'team_b_points',
    ],
    properties: {
      event_id: { bsonType: 'string' },
      title: { bsonType: 'string' },
      team_a: { bsonType: 'string' },
      team_b: { bsonType: 'string' },
      game_name: { bsonType: 'string' },
      start_time: { bsonType: 'date' },
      status: { enum: ['upcoming', 'live', 'completed', 'cancelled'] },
      total_points_invested: { bsonType: 'int', minimum: 0 },
      team_a_points: { bsonType: 'int', minimum: 0 },
      team_b_points: { bsonType: 'int', minimum: 0 },
      winner: { enum: ['team_a', 'team_b', null] },
      payout_status: { enum: ['none', 'pending', 'processing', 'done'] },
      payout_multiplier: { bsonType: ['double', 'int', 'null'] },
    },
  },
  parties: {
    bsonType: 'object',
    required: ['game_playing', 'people_count'],
    properties: {
      _id: { bsonType: 'string' },
      discord_channel_link: { bsonType: 'string' },
      game_playing: { bsonType: 'string' },
      region: { bsonType: 'string' },
      people_count: { bsonType: ['int', 'double'], minimum: 0 },
      people: { bsonType: 'array', items: { bsonType: 'objectId' } },
    },
  },
  point_transactions: {
    bsonType: 'object',
    required: ['user_id', 'points', 'source_type', 'timestamp'],
    properties: {
      user_id: { bsonType: 'objectId' },
      event_id: { bsonType: 'string' },
      video_id: { bsonType: 'string' },
      prediction_id: { bsonType: 'objectId' },
      points: { bsonType: 'int' },
      balance_after: { bsonType: 'int' },
      source_type: {
        enum: ['prediction', 'payout', 'refund', 'watch_time', 'redemption', 'signup_bonus', 'merch_purchase', 'signature', 'shorts_bonus', 'post_bonus', 'logo_purchase', 'party_bonus'],
      },
      timestamp: { bsonType: 'date' },
    },
  },
  predictions: {
    bsonType: 'object',
    required: ['user_id', 'event_id', 'team', 'points', 'status', 'created_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      event_id: { bsonType: 'string' },
      team: { enum: ['team_a', 'team_b'] },
      points: { bsonType: 'int', minimum: 1 },
      status: { enum: ['pending', 'won', 'lost', 'refunded'] },
      payout: { bsonType: 'int', minimum: 0 },
      created_at: { bsonType: 'date' },
    },
  },
  redemptions: {
    bsonType: 'object',
    required: ['user_id', 'perk_id', 'code', 'kind', 'cost', 'status', 'created_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      perk_id: { bsonType: 'string' },
      title: { bsonType: 'string' },
      code: { bsonType: 'string' },
      kind: { enum: ['merch_percent', 'merch_amount', 'digital', 'raffle'] },
      cost: { bsonType: 'int', minimum: 1 },
      percent: { bsonType: 'int', minimum: 1, maximum: 100 },
      amount_cents: { bsonType: 'int', minimum: 1 },
      min_spend_cents: { bsonType: 'int', minimum: 0 },
      status: { enum: ['active', 'used'] },
      created_at: { bsonType: 'date' },
      used_at: { bsonType: 'date' },
    },
  },
  // Merch orders are demo orders (no payment is taken). Deliberately no name, email or address: the order only
  // needs to record what was bought and what it did to the points balance.
  orders: {
    bsonType: 'object',
    required: ['user_id', 'number', 'item_id', 'name', 'qty', 'unit_cents', 'subtotal_cents', 'discount_cents', 'total_cents', 'points_earned', 'signature_points', 'created_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      number: { bsonType: 'string' },
      item_id: { bsonType: 'string' },
      name: { bsonType: 'string' },
      size: { bsonType: 'string' },
      qty: { bsonType: 'int', minimum: 1, maximum: 10 },
      unit_cents: { bsonType: 'int', minimum: 0 },
      subtotal_cents: { bsonType: 'int', minimum: 0 },
      discount_cents: { bsonType: 'int', minimum: 0 },
      total_cents: { bsonType: 'int', minimum: 0 },
      coupon_code: { bsonType: 'string' },
      points_earned: { bsonType: 'int', minimum: 0 },
      signature_points: { bsonType: 'int', minimum: 0 },
      created_at: { bsonType: 'date' },
    },
  },
  watch_videos: {
    bsonType: 'object',
    required: ['video_id', 'duration_seconds', 'points', 'active'],
    properties: {
      video_id: { bsonType: 'string' },
      title: { bsonType: 'string' },
      duration_seconds: { bsonType: 'int', minimum: 1 },
      points: { bsonType: 'int', minimum: 1 },
      active: { bsonType: 'bool' },
      kind: { enum: ['video', 'short'] },
      game: { bsonType: 'string' },
      url: { bsonType: 'string' },
    },
  },
  short_views: {
    bsonType: 'object',
    required: ['user_id', 'short_id', 'viewed_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      short_id: { bsonType: 'string' },
      video_id: { bsonType: 'string' },
      viewed_at: { bsonType: 'date' },
    },
  },
  // One row per player per UTC day that the daily party bonus was paid; the unique index makes it once a day.
  party_bonus_days: {
    bsonType: 'object',
    required: ['user_id', 'day', 'created_at'],
    properties: { user_id: { bsonType: 'objectId' }, day: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, created_at: { bsonType: 'date' } },
  },
  // Purchased profile logos: a brand-folder mark on a backdrop colour (src/services/logos.js).
  profile_logos: {
    bsonType: 'object',
    required: ['user_id', 'logo_id', 'backdrop', 'cost', 'created_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      logo_id: { bsonType: 'string' },
      backdrop: { bsonType: 'string', pattern: '^#[0-9a-f]{6}$' },
      cost: { bsonType: 'int' },
      created_at: { bsonType: 'date' },
    },
  },
  // Fan feed: posts and comments are written by users from the `users` collection.
  posts: {
    bsonType: 'object',
    required: ['user_id', 'text', 'created_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      text: { bsonType: 'string', minLength: 1, maxLength: 240 },
      created_at: { bsonType: 'date' },
      seed_key: { bsonType: 'string' },
    },
  },
  post_comments: {
    bsonType: 'object',
    required: ['post_id', 'user_id', 'text', 'created_at'],
    properties: {
      post_id: { bsonType: 'objectId' },
      user_id: { bsonType: 'objectId' },
      text: { bsonType: 'string', minLength: 1, maxLength: 200 },
      created_at: { bsonType: 'date' },
      seed_key: { bsonType: 'string' },
    },
  },
  post_likes: {
    bsonType: 'object',
    required: ['post_id', 'user_id', 'created_at'],
    properties: { post_id: { bsonType: 'objectId' }, user_id: { bsonType: 'objectId' }, created_at: { bsonType: 'date' } },
  },
  // FaZe history PDF, chunked and embedded (src/scripts/ingest-history.js). Read by the fun-fact RAG.
  faze_history_chunks: {
    bsonType: 'object',
    required: ['chunk_id', 'text', 'embedding', 'embedding_model'],
    properties: {
      chunk_id: { bsonType: 'string' },
      text: { bsonType: 'string' },
      heading: { bsonType: 'string' },
      year: { bsonType: 'int' },
      source: { bsonType: 'string' },
      embedding: { bsonType: 'array' },
      embedding_model: { bsonType: 'string' },
    },
  },
  fun_facts: {
    bsonType: 'object',
    required: ['user_id', 'fact', 'created_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      fact: { bsonType: 'string' },
      angle: { bsonType: 'string' },
      chunk_ids: strArray,
      created_at: { bsonType: 'date' },
    },
  },
  short_likes: {
    bsonType: 'object',
    required: ['user_id', 'short_id', 'created_at'],
    properties: {
      user_id: { bsonType: 'objectId' },
      short_id: { bsonType: 'string' },
      created_at: { bsonType: 'date' },
    },
  },
  watch_sessions: {
    bsonType: 'object',
    required: ['user_id', 'video_id', 'state', 'watched_ms'],
    properties: {
      user_id: { bsonType: 'objectId' },
      video_id: { bsonType: 'string' },
      state: { enum: ['CREATED', 'PLAYING', 'PAUSED', 'BUFFERING', 'ENDED'] },
      watched_ms: { bsonType: ['int', 'long'], minimum: 0 },
      completed: { bsonType: 'bool' },
    },
  },
};

const indexes = {
  users: [
    [{ steam_id: 1 }, { unique: true, sparse: true }], // already present; same spec is a no-op
    [{ email: 1 }, { unique: true, sparse: true }],
  ],
  events: [
    [{ event_id: 1 }, { unique: true }],
    [{ status: 1, start_time: 1 }, {}],
    [{ payout_status: 1, closed_at: 1 }, {}],
  ],
  parties: [[{ game_playing: 1, region: 1 }, {}]],
  user_games: [[{ user_id: 1, game_name: 1 }, {}]], // already present; no-op
  point_transactions: [
    [{ user_id: 1, timestamp: -1 }, {}],
    [{ event_id: 1 }, {}],
  ],
  predictions: [
    [{ user_id: 1, event_id: 1 }, { unique: true }],
    [{ event_id: 1, status: 1 }, {}],
  ],
  orders: [
    [{ number: 1 }, { unique: true }],
    [{ user_id: 1, created_at: -1 }, {}],
  ],
  redemptions: [
    [{ code: 1 }, { unique: true }],
    [{ user_id: 1, created_at: -1 }, {}],
  ],
  watch_videos: [[{ video_id: 1 }, { unique: true }]],
  watch_sessions: [[{ user_id: 1, video_id: 1 }, {}]],
  short_views: [
    [{ user_id: 1, short_id: 1 }, { unique: true }], // a short counts once per user
    [{ user_id: 1, viewed_at: -1 }, {}],
  ],
  short_likes: [
    [{ user_id: 1, short_id: 1 }, { unique: true }],
    [{ short_id: 1 }, {}],
  ],
  twitch_watch: [[{ user_id: 1, day: 1 }, { unique: true }]],
  faze_history_chunks: [[{ chunk_id: 1 }, { unique: true }]],
  party_bonus_days: [[{ user_id: 1, day: 1 }, { unique: true }]],
  profile_logos: [[{ user_id: 1, logo_id: 1, backdrop: 1 }, { unique: true }], [{ user_id: 1, created_at: -1 }, {}]],
  posts: [[{ created_at: -1 }, {}], [{ seed_key: 1 }, { unique: true, partialFilterExpression: { seed_key: { $exists: true } } }]],
  post_comments: [[{ post_id: 1, created_at: 1 }, {}], [{ seed_key: 1 }, { unique: true, partialFilterExpression: { seed_key: { $exists: true } } }]],
  post_likes: [[{ post_id: 1, user_id: 1 }, { unique: true }], [{ user_id: 1 }, {}]],
  fun_facts: [[{ user_id: 1, created_at: -1 }, {}]],
};

// Collections this API owns, whose live validator must follow the code (e.g. when a new ledger source type is added).
// Everything else that already exists is left alone, as described below.
const SYNCED_VALIDATORS = ['point_transactions', 'redemptions', 'orders'];

async function syncValidator(db, name) {
  const [info] = await db.listCollections({ name }).toArray();
  const live = info?.options?.validator?.$jsonSchema;
  if (!info || isDeepStrictEqual(live, validators[name])) return;
  await db.command({ collMod: name, validator: { $jsonSchema: validators[name] }, validationLevel: 'strict', validationAction: 'error' });
  console.log(`[schema] updated validator for "${name}"`);
}

// Collections that already exist (users, parties, user_games predate this API) are never modified:
// no validators are applied to them, only missing indexes are added. Validators apply to collections
// this API creates itself.
export async function ensureSchema(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const name of new Set([...Object.keys(validators), ...Object.keys(indexes)])) {
    if (!existing.has(name)) {
      await db.createCollection(name, validators[name]
        ? { validator: { $jsonSchema: validators[name] }, validationLevel: 'strict', validationAction: 'error' }
        : {});
    }
    for (const [keys, options] of indexes[name] ?? []) await db.collection(name).createIndex(keys, options);
  }
  for (const name of SYNCED_VALIDATORS) await syncValidator(db, name);
}
