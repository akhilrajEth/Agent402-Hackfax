import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSupabaseClient } from './utils/supabase_client';

type Bindings = {
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CDP_API_KEY_ID: string;
  CDP_API_KEY_SECRET: string;
};

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

export default app;
