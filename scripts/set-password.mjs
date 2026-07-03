// One-off admin script: sets/changes the password for the single app user
// directly via the Supabase Admin API, bypassing email entirely (no rate
// limit). Run locally, never commit the service role key.
//
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key from Project Settings > API>"
//   $env:EMAIL="vos@ejemplo.com"
//   $env:PASSWORD="tu-contraseña-elegida"
//   node scripts/set-password.mjs

import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL, PASSWORD } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EMAIL || !PASSWORD) {
  console.error(
    "Faltan variables. Necesitás SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL, PASSWORD."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Error listando usuarios:", listError.message);
  process.exit(1);
}

const user = usersPage.users.find((u) => u.email === EMAIL);
if (!user) {
  console.error(`No se encontró ningún usuario con email ${EMAIL}`);
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  password: PASSWORD,
});

if (updateError) {
  console.error("Error seteando la contraseña:", updateError.message);
  process.exit(1);
}

console.log(`Contraseña actualizada para ${EMAIL}.`);
