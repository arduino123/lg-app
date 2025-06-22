require('dotenv').config();
console.log("🧪 TEST_VARIABLE:", process.env.TEST_VARIABLE);
console.log("🔑 KEY cargada:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "VACÍA");

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Multer para manejar la subida de imágenes
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🟢 Ruta raíz: ping para verificar que el servidor está activo
app.get('/', (req, res) => {
  res.send('Servidor LG Ventas 🟢');
});

// ✅ Ruta pública para subir ventas con imagen
app.post('/ventas', upload.single('foto'), async (req, res) => {
  const { vendedor, serie } = req.body;
  const foto = req.file;

  try {
    if (!foto) {
      return res.status(400).json({ error: 'No se recibió la imagen' });
    }

    const nombreArchivo = `ventas/${Date.now()}-${foto.originalname}`;
    const { error: uploadError } = await supabase
      .storage
      .from('ventas-fotos')
      .upload(nombreArchivo, foto.buffer, {
        contentType: foto.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Error al subir foto:", uploadError.message);
      return res.status(500).json({ error: 'Error al subir la foto', detalle: uploadError.message });
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('ventas-fotos')
      .getPublicUrl(nombreArchivo);
    const fotoUrl = publicUrlData.publicUrl;
    const fechaUTC = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('ventas')
      .insert([{
        nombre_vendedor: vendedor,
        numero_serie: serie,
        foto_url: fotoUrl,
        fecha: fechaUTC,
      }]);

    if (insertError) {
      console.error("❌ Error al guardar venta:", insertError.message);
      return res.status(500).json({ error: 'Error al guardar la venta', detalle: insertError.message });
    }

    res.json({ mensaje: '✅ Venta registrada correctamente' });
  } catch (error) {
    console.error("❌ Error inesperado:", error.message);
    res.status(500).json({ error: 'Error inesperado', detalle: error.message });
  }
});

// 🔐 Ruta protegida para ver ventas (requiere x-api-key en headers)
app.get('/sales', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }

  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      console.error("❌ Error al obtener ventas:", error.message);
      return res.status(500).json({ error: 'Error al obtener ventas', detalle: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error("❌ Error inesperado al obtener ventas:", err.message);
    res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
});

// 🔷 Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});