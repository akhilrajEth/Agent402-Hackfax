import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSupabaseClient } from './utils/supabase_client';

type Bindings = {
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CDP_API_KEY_ID: string;
  CDP_API_KEY_SECRET: string;
  ZKP2P_API_KEY: string;
};

// --- App ---

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('/*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Agent402 API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      wallets_register: '/wallets/register',
    },
  });
});

// Example endpoint that uses Supabase
app.get('/test-db', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('test')
      .select('*')
      .limit(1);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// --- Wallet Registration ---

app.post('/wallets/register', async (c) => {
  try {
    const { privyUserId, walletAddress } = await c.req.json();

    if (!privyUserId || !walletAddress) {
      return c.json({ error: 'Missing privyUserId or walletAddress' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Upsert the embedded wallet address into Supabase
    const { error: upsertError } = await supabase.from('users').upsert(
      {
        privy_user_id: privyUserId,
        wallet_address: walletAddress,
        spend_wallet_address: walletAddress,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'privy_user_id' }
    );

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return c.json({ error: upsertError.message }, 500);
    }

    return c.json({ success: true, walletAddress });
  } catch (error) {
    console.error('Wallet register error:', error);
    return c.json({ error: (error as Error).message }, 500);
  }
});

export default app;
