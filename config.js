// Öffentliche Konfiguration. Der anon-Schlüssel ist bewusst öffentlich (er gibt ohne Admin-Anmeldung
// dank RLS keinerlei Control-Center-Daten frei). Geheime Schlüssel gehören NIE hierher.
export const CONFIG = {
  appName: "JOPML Nexus",
  supabaseUrl: "https://qeomooxbfpwvcprvmows.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlb21vb3hiZnB3dmNwcnZtb3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzYyNjAsImV4cCI6MjEwODYxMjI2MH0.zMz_jQZKvLJlBrRFaZgGGdd_drllyoEyjTS7cnzGDGE",
  pollSeconds: 60,
  version: "2.0.0",
};
