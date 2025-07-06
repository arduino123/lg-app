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
    // Verifica si el vendedor está bloqueado
    const { data: bloqueado, error: errorBloqueado } = await supabase
      .from('vendedores_bloqueados')
      .select('nombre')
      .eq('nombre', nombreVendedor);

    if (errorBloqueado) throw errorBloqueado;

    if (Array.isArray(bloqueado) && bloqueado.length > 0) {
      return { valido: false, mensaje: '⛔ Vendedor bloqueado. Contacta a administración.' };
    }

    // Verifica si el vendedor está registrado
    const { data: vendedor, error: errorVendedor } = await supabase
      .from('vendedores_registrados')
      .select('nombre')
      .eq('nombre', nombreVendedor);

    if (errorVendedor) throw errorVendedor;

    if (!Array.isArray(vendedor) || vendedor.length === 0) {
      return { valido: false, mensaje: '❌ Vendedor no registrado.' };
    }

    // Verifica si el número de serie es válido
    const { data: serie, error: errorSerie } = await supabase
      .from('series_validas')
      .select('codigo_serie')
      .eq('codigo_serie', numeroSerie);

    if (errorSerie) throw errorSerie;

    if (!Array.isArray(serie) || serie.length === 0) {
      return { valido: false, mensaje: '❌ Número de serie no válido.' };
    }

    return { valido: true };
  } catch (error) {
    console.error('Error en validación:', error);
    return { valido: false, mensaje: 'Error interno en validación' };
  }
}

// Contador de intentos fallidos (temporal en memoria)
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
      await supabase.from('vendedores_bloqueados').insert({ nombre: vendedor });
      return res.status(403).json({ error: '🚫 Has sido bloqueado por 3 intentos fallidos.' });
    }

    return res.status(400).json({ error: `${resultado.mensaje} (Intento ${intentosFallidos[vendedor]}/3)` });
  }

  // Si es válido, reseteamos el contador y seguimos
  intentosFallidos[vendedor] = 0;

  // Aquí puedes guardar la venta o la imagen si quieres

  return res.json({ mensaje: '✅ Venta registrada correctamente' });
});

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
});