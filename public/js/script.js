// Theme toggle
const toggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme');
const githubLogo = document.getElementById('github-logo');
const linkedinLogo = document.getElementById('linkedin-logo');

if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    toggleBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    githubLogo.src = currentTheme === 'dark' ? 'assets/github-logo-dark.png' : 'assets/github-logo.png';
    linkedinLogo.src = currentTheme === 'dark' ? 'assets/linkedin-logo-dark.png' : 'assets/linkedin-logo.png';
}

toggleBtn.addEventListener('click', () => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    githubLogo.src = theme === 'dark' ? 'assets/github-logo-dark.png' : 'assets/github-logo.png';
    linkedinLogo.src = theme === 'dark' ? 'assets/linkedin-logo-dark.png' : 'assets/linkedin-logo.png';
});

fetch('/api/projects')
    .then(res => res.json())
    .then(projects => {
        const container = document.getElementById('projects-grid');
        projects.forEach(proj => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
        <h3>${proj.name}</h3>
        <p>${proj.description || 'No description available.'}</p>
        <a href="${proj.html_url}" target="_blank">View on GitHub</a>
      `;
            container.appendChild(card);
        });
    })
    .catch(err => console.error('Error loading projects:', err));


// Scroll tilt effect for mobile
let lastScrollY = window.scrollY;
let lastTime = Date.now();

function handleScrollTilt() {
    if (window.innerWidth >= 768) return; // Solo en móvil

    const now = Date.now();
    const deltaY = window.scrollY - lastScrollY;
    const deltaTime = now - lastTime;

    const velocity = deltaY / deltaTime;

    const maxTiltSmall = 1500; // skills
    const maxTiltLarge = 10; // projects
    const tiltSmall = Math.max(Math.min(velocity * 500, maxTiltSmall), -maxTiltSmall);
    const tiltLarge = Math.max(Math.min(velocity * 10, maxTiltLarge), -maxTiltLarge);

    // Aplicar tilt y sombra dinámica
    document.querySelectorAll('.skill-card').forEach(card => {
        card.classList.add('tilt');
        card.style.transform = `rotateX(${tiltSmall * -1}deg)`; // invertimos para que se levante
    });

    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.add('tilt');
        card.style.transform = `rotateX(${tiltLarge * -1}deg)`;
    });

    lastScrollY = window.scrollY;
    lastTime = now;

    // Reset suave
    clearTimeout(handleScrollTilt.resetTimeout);
    handleScrollTilt.resetTimeout = setTimeout(() => {
        document.querySelectorAll('.skill-card, .project-card').forEach(card => {
            card.style.transform = `rotateX(0deg)`;
            card.classList.remove('tilt');
        });
    }, 150);
}

window.addEventListener('scroll', handleScrollTilt);

const container = document.getElementById('projects-grid');

container.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${mouseX}%`);
    card.style.setProperty('--mouse-y', `${mouseY}%`);
});

container.addEventListener('mouseleave', (e) => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    card.style.setProperty('--mouse-x', `50%`);
    card.style.setProperty('--mouse-y', `50%`);
});


const form = document.getElementById('contact-form');
const submitButton = form.querySelector('button');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Deshabilitar botón
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    try {
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        });

        const data = await res.json();

        if (data.success) {
            alert('Mensaje enviado correctamente');
            form.reset();
        } else {
            alert('Error al enviar: ' + (data.error || 'Intenta más tarde'));
        }
    } catch (err) {
        alert('Error al enviar mensaje');
    } finally {
        // Reactivar botón (por si quieres permitir otro envío después)
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar';
    }
});
