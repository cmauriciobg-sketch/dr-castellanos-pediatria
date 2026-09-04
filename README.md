# Residencia Pediátrica

Aplicación web/PWA gratuita para el estudio clínico de Pediatría. Incluye cuestionarios de opción múltiple, explicaciones en tres profundidades, ilustraciones clínicas, rachas, XP, medallas, ruta recomendada y juegos de repaso.

## Contenido

- Cinco módulos y **450 reactivos**: atresia esofágica, atresia intestinal, fisiología pulmonar, cardiopatías congénitas y adenopatías/adenitis cervical.
- Modo invitado gratis: funciona aun sin cuenta y conserva el avance en el dispositivo.
- Cuenta opcional con Supabase: sincroniza de forma privada rachas, badges y progreso entre dispositivos.
- PWA instalable en teléfonos, tabletas y escritorio una vez publicada con HTTPS.

## Publicar con GitHub, Supabase y Vercel

1. Crea un repositorio en GitHub y sube esta carpeta.
2. Crea un proyecto en Supabase. En **SQL Editor**, ejecuta una vez el archivo `db/schema.sql`.
3. En Supabase, abre **Connect** y copia el **Project URL** y la **Publishable key**. Pégalos en `supabase-config.js`.
4. En **Authentication > URL Configuration**, agrega la URL de producción de la aplicación como *Site URL* y *Redirect URL*.
5. Importa el repositorio en Vercel. Elige el preset **Other**: no requiere compilación y publica `index.html` como sitio estático.

La URL y la Publishable key son datos públicos de cliente. Nunca copies una `service_role` o *secret key* en el navegador, en GitHub ni en este archivo. Las reglas de `db/schema.sql` hacen que cada persona solo pueda leer y editar su propio perfil.

## Uso local

Para probar instalación PWA y caché offline, sirve la carpeta por HTTP:

```sh
python3 -m http.server 4173
```

Después abre `http://localhost:4173`.

## Alcance clínico

El contenido es educativo. Debe revisarse y ampliarse por la coordinación académica antes de considerarlo un banco institucional validado; no sustituye protocolos vigentes, juicio profesional ni la valoración de cada paciente. Los distractores del quiz requieren validación docente individual antes de emplearse en una evaluación formal.
