require('dotenv').config();
console.log("🧪 TEST DE ENV");

console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "CARGADA ✅" : "VACÍA ❌");