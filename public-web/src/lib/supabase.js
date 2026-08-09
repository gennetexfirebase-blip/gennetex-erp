import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zkftykocmqzrgdhgwluu.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZnR5a29jbXF6cmdkaGd3bHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNTAyNDYsImV4cCI6MjEwMTgyNjI0Nn0.FwZ0yK6lS5Ngh3Rd2WaEJw08EA3WGW4Ac_uKNx7oTQ0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/** Hero — сүлжээний GIF + статик poster (Vite public/) */
export const HERO_GIF_URL = '/hero-network.gif';
export const HERO_POSTER_URL = '/hero-network-poster.jpg';

/** @deprecated GIF ашиглана */
export const HERO_IMAGE_URL = HERO_GIF_URL;
export const HERO_VIDEO_URL = HERO_GIF_URL;
