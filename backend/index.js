require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Usa la clave correcta del archivo .env
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuración de multer para manejo de archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta POST para registrar ventas
app.post('/ventas', upload.single('foto'), async (req, res) => {
  const { vendedor, serie } = req.body;
  const foto = req.file;

  try {
    if (!foto) {
      return res.status(400).json({ error: 'No se recibió la imagen' });
    }

    const nombreArchivo = `ventas/${Date.now()}-${foto.originalname}`;

    // ✅ Subir imagen a Supabase Storage (bucket: ventas-fotos)
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

    // Obtener URL pública de la imagen
    const { data: publicUrlData } = supabase.storage
      .from('ventas-fotos')
      .getPublicUrl(nombreArchivo);
    const fotoUrl = publicUrlData.publicUrl;

    const fechaUTC = new Date().toISOString();

    // ✅ Insertar datos en la tabla ventas
    const { error: insertError } = await supabase
      .from('ventas')
      .insert([
        {
          nombre_vendedor: vendedor,
          numero_serie: serie,
          foto_url: fotoUrl,
          fecha: fechaUTC,
        },
      ]);

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

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});






















