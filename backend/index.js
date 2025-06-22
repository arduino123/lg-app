require('dotenv').config();
console.log("🧪 TEST_VARIABLE:", process.env.TEST_VARIABLE);
console.log("🔑 KEY cargada:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "VACÍA");

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 📡 Configuración CORS robusta para móviles y navegadores modernos
const corsOptions = {
  origin: true, // Permitir cualquier origen
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  optionsSuccessStatus: 204
};

// Middleware para aplicar CORS reflejando el origen
app.use(cors((req, cb) => {
  cb(null, corsOptions);
}));

// Importante: manejar preflight correctamente en todas las rutas
app.options('/*', cors(corsOptions)); // Corrección para Express v5 :contentReference[oaicite:4]{index=4}

app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🔹 Ruta ping
app.get('/', (req, res) => {
  res.send('Servidor LG Ventas 🟢');
});

// 🔹 POST /ventas: para enviar ventas con foto
app.post('/ventas', upload.single('foto'), async (req, res) => {
  const { vendedor, serie } = req.body;
  const foto = req.file;

  try {
    if (!foto) return res.status(400).json({ error: 'No se recibió la imagen' });

    const nombreArchivo = `ventas/${Date.now()}-${foto.originalname}`;
    const { error: uploadError } = await supabase
      .storage
      .from('ventas-fotos')
      .upload(nombreArchivo, foto.buffer, {
        contentType: foto.mimetype,
        upsert: false
      });
    if (uploadError) return res.status(500).json({ error: 'Error al subir la foto', detalle: uploadError.message });

    const { data: publicUrlData } = supabase
      .storage
      .from('ventas-fotos')
      .getPublicUrl(nombreArchivo);
    const fotoUrl = publicUrlData.publicUrl;
    const fechaUTC = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('ventas')
      .insert([{ nombre_vendedor: vendedor, numero_serie: serie, foto_url: fotoUrl, fecha: fechaUTC }]);
    if (insertError) return res.status(500).json({ error: 'Error al guardar la venta', detalle: insertError.message });

    res.json({ mensaje: '✅ Venta registrada correctamente' });
  } catch (err) {
    console.error("❌ Error inesperado:", err.message);
    res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
});

// 🔐 GET /sales: requiere API key
app.get('/sales', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) return res.status(403).json({ error: 'Acceso no autorizado' });

  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) return res.status(500).json({ error: 'Error al obtener ventas', detalle: error.message });
    res.json(data);
  } catch (err) {
    console.error("❌ Error inesperado al consultar ventas:", err.message);
    res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}, host 0.0.0.0`);
});