process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configuración de Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, tiposPermitidos.includes(file.mimetype));
  }
});

// Configuración del correo con fix al certificado autofirmado
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // conexión segura SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // ignora certificados autofirmados
  }
});

// Función para enviar correo al bloquear vendedor
async function enviarCorreoBloqueo(nombreVendedor, serieFallida) {
  const fechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

  const mailOptions = {
    from: `"Eco Solution LG" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_DEST,
    subject: `🔒 Vendedor bloqueado: ${nombreVendedor}`,
    text: `El vendedor "${nombreVendedor}" fue bloqueado tras 3 intentos fallidos.

⏰ Fecha y hora del bloqueo: ${fechaHora}
❌ Última serie ingresada inválida: ${serieFallida}

Verifica los intentos en la base de datos para más detalles.`,
  };

  await transporter.sendMail(mailOptions);
}

app.post('/ventas', upload.single('foto'), async (req, res) => {
  const { vendedor, serie } = req.body;
  const foto = req.file;

  try {
    const { data: bloqueadoData } = await supabase
      .from('vendedores_bloqueados')
      .select('*')
      .eq('nombre_vendedor', vendedor)
      .maybeSingle();

    if (bloqueadoData?.bloqueado) {
      return res.status(403).json({ error: 'Vendedor bloqueado por intentos fallidos.' });
    }

    const { data: serieValida } = await supabase
      .from('series_validas')
      .select('*')
      .eq('codigo_serie', serie)
      .maybeSingle();

    if (!serieValida) {
      if (bloqueadoData) {
        const nuevosIntentos = bloqueadoData.intentos + 1;
        const bloqueado = nuevosIntentos >= 3;

        await supabase
          .from('vendedores_bloqueados')
          .update({
            intentos: nuevosIntentos,
            bloqueado,
            ultima_fecha: new Date()
          })
          .eq('nombre_vendedor', vendedor);

        if (bloqueado) {
          console.log(`🔒 Vendedor ${vendedor} bloqueado por 3 intentos fallidos.`);
          await enviarCorreoBloqueo(vendedor, serie);
        }
      } else {
        await supabase
          .from('vendedores_bloqueados')
          .insert([{ nombre_vendedor: vendedor, intentos: 1 }]);
      }

      return res.status(400).json({ error: 'Número de serie inválido.' });
    }

    // Limpiar estado del vendedor si ya estaba registrado
    if (bloqueadoData) {
      await supabase
        .from('vendedores_bloqueados')
        .update({ intentos: 0, bloqueado: false })
        .eq('nombre_vendedor', vendedor);
    }

    const nombreArchivo = `${Date.now()}-${foto.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from('ventas')
      .upload(nombreArchivo, foto.buffer, {
        contentType: foto.mimetype
      });

    if (uploadError) {
      console.error('❌ Error al subir imagen:', uploadError.message);
      return res.status(500).json({ error: 'Error al subir imagen.' });
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('ventas')
      .getPublicUrl(nombreArchivo);

    const fotoUrl = publicUrlData.publicUrl;

    const insertVenta = await supabase
      .from('ventas')
      .insert([{ nombre_vendedor: vendedor, numero_serie: serie, foto_url: fotoUrl }]);

    if (insertVenta.error) {
      console.error('❌ Error al guardar venta:', insertVenta.error);
      return res.status(500).json({ error: 'Error al guardar la venta.' });
    }

    res.json({ mensaje: '✅ Venta registrada correctamente.' });

  } catch (err) {
    console.error('❌ Error inesperado:', err);
    res.status(500).json({ error: 'Error inesperado en el servidor.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});








