require('dotenv').config();
console.log("🧪 TEST_VARIABLE:", process.env.TEST_VARIABLE);
console.log("🔑 KEY cargada:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "VACÍA");

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors()); // O personaliza: cors({ origin: 'https://lg-app-tau.vercel.app' }));
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get('/', (req, res) => {
  res.send('✅ API activa — usa POST /ventas');
});

app.post('/ventas', upload.single('foto'), async (req, res) => {
  const { vendedor, serie } = req.body;
  const foto = req.file;

  try {
    if (!foto) return res.status(400).json({ error: 'No se recibió la imagen' });

    const nombreArchivo = `ventas/${Date.now()}-${foto.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from('ventas-fotos')
      .upload(nombreArchivo, foto.buffer, {
        contentType: foto.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Error al subir foto:", uploadError.message);
      return res.status(500).json({ error: 'Error al subir la foto', detalle: uploadError.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from('ventas-fotos')
      .getPublicUrl(nombreArchivo);
    const fotoUrl = publicUrlData.publicUrl;
    const fechaUTC = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('ventas')
      .insert([{ nombre_vendedor: vendedor, numero_serie: serie, foto_url: fotoUrl, fecha: fechaUTC }]);

    if (insertError) {
      console.error("❌ Error al guardar venta:", insertError.message);
      return res.status(500).json({ error: 'Error al guardar la venta', detalle: insertError.message });
    }

    res.json({ mensaje: '✅ Venta registrada correctamente' });
  } catch (error) {
    console.error("❌ Error inesperado:", error.message);
    res.status(500).json({ error: 'Error inesperado en el servidor', detalle: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});