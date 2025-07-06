const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Función para validar nombre y serie
async function validarDatos(nombreVendedor, numeroSerie) {
  try {
    const { data: bloqueado, error: errorBloqueado } = await supabase
      .from('vendedores_bloqueados')
      .select('nombre_vendedor')
      .eq('nombre_vendedor', nombreVendedor);

    if (errorBloqueado) throw errorBloqueado;
    if (bloqueado && bloqueado.length > 0) {
      return { valido: false, mensaje: '⛔ Vendedor bloqueado. Contacta a administración.' };
    }

    const { data: vendedor, error: errorVendedor } = await supabase
      .from('vendedores_registrados')
      .select('nombre')
      .eq('nombre', nombreVendedor);

    if (errorVendedor) throw errorVendedor;
    if (!vendedor || vendedor.length === 0) {
      return { valido: false, mensaje: '❌ Vendedor no registrado.' };
    }

    const { data: serie, error: errorSerie } = await supabase
      .from('series_validas')
      .select('codigo_serie')
      .eq('codigo_serie', numeroSerie);

    if (errorSerie) throw errorSerie;
    if (!serie || serie.length === 0) {
      return { valido: false, mensaje: '❌ Número de serie no válido.' };
    }

    return { valido: true };
  } catch (error) {
    console.error('Error validando datos:', error.message);
    return { valido: false, mensaje: '❌ Error interno en validación.' };
  }
}

const intentosFallidos = {};

app.post('/ventas', upload.single('foto'), async (req, res) => {
  const { vendedor, serie } = req.body;
  const foto = req.file;

  if (!vendedor || !serie || !foto) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  const resultado = await validarDatos(vendedor, serie);

  if (!resultado.valido) {
    intentosFallidos[vendedor] = (intentosFallidos[vendedor] || 0) + 1;

    if (intentosFallidos[vendedor] >= 3) {
      await supabase.from('vendedores_bloqueados').insert({ nombre_vendedor: vendedor });
      return res.status(403).json({ error: '🚫 Has sido bloqueado por 3 intentos fallidos.' });
    }

    return res.status(400).json({ error: `${resultado.mensaje} (Intento ${intentosFallidos[vendedor]}/3)` });
  }

  intentosFallidos[vendedor] = 0;

  // Guardar la foto en Supabase Storage
  const timestamp = Date.now();
  const fileName = `${vendedor}_${timestamp}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('fotos_ventas')
    .upload(fileName, foto.buffer, {
      contentType: foto.mimetype,
      upsert: false,
    });

  if (uploadError) {
    console.error('Error al subir imagen:', uploadError.message);
    return res.status(500).json({ error: '❌ Error al subir la imagen a Supabase Storage.' });
  }

  // Obtener URL pública
  const { data: publicUrlData } = supabase.storage
    .from('fotos_ventas')
    .getPublicUrl(fileName);

  const fotoUrl = publicUrlData?.publicUrl || '';

  // Registrar la venta en Supabase con URL de foto y fecha
  const { error: errorInsert } = await supabase.from('ventas').insert({
    nombre_vendedor: vendedor,
    numero_serie: serie,
    foto_local: fileName,
    foto_url: fotoUrl,
    fecha: new Date().toISOString()
  });

  if (errorInsert) {
    console.error('Error al registrar la venta:', errorInsert.message);
    return res.status(500).json({ error: '❌ Error al registrar la venta en la base de datos.' });
  }

  return res.json({ mensaje: '✅ Venta registrada correctamente' });
});

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
});