// js/supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://qihzvglznpkytolxkuxz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaHp2Z2x6bnBreXRvbHhrdXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTc4NDIsImV4cCI6MjA3NTUzMzg0Mn0.VHyy3_Amr-neYoudHudoW-TJwNPfhkRV2TTCfVgY_zM";

// We create and export the client here
export const supabase = createClient(supabaseUrl, supabaseKey);
