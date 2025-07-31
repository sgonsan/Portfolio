# Sergio González Sánchez – Portfolio

Portfolio personal que muestra mis **habilidades, proyectos y logros profesionales**.  
Construido con **HTML, CSS y JavaScript** para el frontend, y **Node.js + Express** para el backend.  
Carga los proyectos de **GitHub en tiempo real** mediante la API de GitHub y permite contacto directo mediante un formulario con **Nodemailer**.

---

## Características principales

- **Diseño moderno y responsive**
  - Dark/Light mode con almacenamiento en `localStorage`.
  - Animaciones sutiles y tilt 3D en scroll/hover.
- **Carga dinámica de proyectos**
  - Obtiene información de repositorios desde GitHub.
  - Cache local en servidor para evitar rate limits.
- **Formulario de contacto**
  - Envío mediante Gmail usando Nodemailer.
  - Rate limit para prevenir spam (1 mensaje por minuto).
- **Optimizado para móvil**
  - Efectos de inclinación y animaciones suaves para pantallas pequeñas.

---

## Tecnologías utilizadas

### Frontend

- HTML5 semántico
- CSS3 con variables para modo claro/oscuro
- JavaScript vanilla (sin frameworks)

### Backend

- Node.js con Express
- Nodemailer para correo
- API de GitHub para cargar proyectos
- Express Rate Limit para protección anti-spam

---

## Configuración del entorno

Este proyecto usa un archivo `.env` para variables sensibles.  
Un ejemplo de configuración se encuentra en `.env.example`:

```plaintext
GITHUB_TOKEN=your_github_token_here
MAIL_USER=your_email_here
MAIL_PASS=your_app_password_here
```

1. Copia `.env.example` a `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` y añade tus valores reales.

---

## Ejecución en local

Para ejecutar el proyecto en tu máquina local, sigue estos pasos:

1. Clona el repositorio

   ```bash
   git clone https://github.com/sgonsan/portfolio.git
   cd portfolio
   ```

2. Instala las dependencias

   ```bash
   npm install
   ```

3. Inicia el servidor

   ```bash
   npm start
   ```

El proyecto estará disponible en `http://localhost:3000`.

---

## Estructura del proyecto

```plaintext
portfolio/
├── public/ # Archivos frontend (HTML, CSS, JS, imágenes)
├── projects.json # Lista de repositorios de GitHub a mostrar
├── server.js # Servidor Express
├── .env.example # Plantilla de variables de entorno
├── package.json # Dependencias y scripts
└── package-lock.json # Lockfile de dependencias
```

---

## Licencia

Este proyecto es de uso personal. Si deseas usarlo como base, reemplaza las imágenes y credenciales con las tuyas propias.

---

## Autor

**Sergio González Sánchez**  
[https://www.elbiti.com](https://www.elbiti.com)
