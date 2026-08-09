import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xhxyrzzgmksjlibfrmlx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeHlyenpnbWtzamxpYmZybWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODEwMjYsImV4cCI6MjA5ODQ1NzAyNn0.nYWs_N09RLHvhmEUCdbS6M8yvthsKJ5TkXjdRv4VMag';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/** Hero — сүлжээний GIF + статик poster (Vite public/) */
export const HERO_GIF_URL = '/hero-network.gif';
export const HERO_POSTER_URL = '/hero-network-poster.jpg';

/** @deprecated GIF ашиглана */
export const HERO_IMAGE_URL = HERO_GIF_URL;
export const HERO_VIDEO_URL = HERO_GIF_URL;
