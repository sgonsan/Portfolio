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

fetch('/api/zen')
    .then(res => res.json())
    .then(data => {
        const zenElement = document.getElementById('zen-quote');
        zenElement.textContent = `"${data.quote}"`;
        zenElement.classList.add('visible');
    })
    .catch(err => console.error('Error loading zen quote:', err));

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
    if (window.innerWidth >= 768) return; // only for mobile

    const now = Date.now();
    const deltaY = window.scrollY - lastScrollY;
    const deltaTime = now - lastTime;

    const velocity = deltaY / deltaTime;

    const maxTiltSmall = 1500; // skills
    const maxTiltLarge = 10; // projects
    const tiltSmall = Math.max(Math.min(velocity * 500, maxTiltSmall), -maxTiltSmall);
    const tiltLarge = Math.max(Math.min(velocity * 10, maxTiltLarge), -maxTiltLarge);

    // Apply tilt effect
    document.querySelectorAll('.skill-card').forEach(card => {
        card.classList.add('tilt');
        card.style.transform = `rotateX(${tiltSmall * -1}deg)`;
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

    // Validate fields
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !email || !message) {
        return alert('Please fill in all fields');
    }
    if (!/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
        return alert('Please enter a valid email address');
    }

    // Deactivate button to prevent multiple submissions
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        });

        const data = await res.json();

        if (data.success) {
            alert('Message sent successfully!');
            form.reset();
        } else {
            alert('Error sending: ' + (data.error || 'Please try again later'));
        }
    } catch (err) {
        alert('Error sending message');
    } finally {
        // Reactivate button
        submitButton.disabled = false;
        submitButton.textContent = 'Send';
    }
});

fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
        const stats = document.getElementById('site-stats');
        stats.textContent = `Visits: ${data.visits} | Last update: ${data.lastCommit}`;
    })
    .catch(err => console.error('Error loading stats:', err));

const openBtn = document.getElementById('open-terminal');
const modal = document.getElementById('terminal-modal');
const closeBtn = document.getElementById('close-terminal');
const output = document.getElementById('terminal-output');
const input = document.getElementById('terminal-input');

let terminalInitialized = false;
let currentPath = '/';

// Open terminal
openBtn.addEventListener('click', () => {
    if (!terminalInitialized) {
        modal.style.display = 'flex';
        input.focus();
        printLine('Type "help" for commands.');
    } else {
        modal.style.display = 'none';
        output.innerHTML = '';
        currentPath = '/';
    }
    terminalInitialized = !terminalInitialized;
});

// Close terminal
closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    output.innerHTML = '';
    terminalInitialized = false;
    currentPath = '/';
});

// Basic terminal commands
const commands = {
    help: () => {
        printLine('<span class="color-blue">Available commands:</span>');
        printLine('<span class="color-green">help</span> - Show this help menu');
        printLine('<span class="color-green">about</span> - Display portfolio info');
        printLine('<span class="color-green">projects</span> - List portfolio projects');
        printLine('<span class="color-green">zen</span> - Get a random GitHub Zen quote');
        printLine('<span class="color-green">visits</span> - Show visit count and last commit');
        printLine('<span class="color-green">clear</span> - Clear the terminal');
        printLine('<span class="color-green">exit</span> - Close the terminal');
        printLine('<span class="color-green">echo &lt;text&gt;</span> - Print text');
        printLine('<span class="color-green">ls</span> - Fake directory listing');
    },
    about: () => {
        const ascii = `
<pre class="color-purple">
  ____       _ _   _      
 |  _ \\ ___ | | |_| | ___ 
 | |_) / _ \\| | __| |/ _ \\
 |  __/ (_) | | |_| |  __/
 |_|   \\___/|_|\\__|_|\\___|
</pre>`;

        printLine(ascii);
        printLine('<span class="color-green">Name:</span> Sergio González');
        printLine('<span class="color-green">Role:</span> C++ & Python Developer');
        printLine('<span class="color-green">Projects:</span> Check the Projects section above');
    },
    projects: () => {
        printLine('Check my projects in the section above or at: /#projects');
    },
    zen: async () => {
        printLine('Fetching Zen quote...');
        try {
            const res = await fetch('/api/zen');
            const data = await res.json();
            printLine(data.quote || 'No quote available.');
        } catch {
            printLine('Error fetching Zen quote.');
        }
        scrollToBottom();
    },
    visits: async () => {
        printLine('Fetching stats...');
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            printLine(`Visits: ${data.visits}`);
            printLine(`Last commit: ${data.lastCommit}`);
        } catch {
            printLine('Error fetching stats.');
        }
    },
    clear: () => {
        output.innerHTML = '';
    },
    exit: () => {
        terminalInitialized = false;
        modal.style.display = 'none';
        output.innerHTML = '';
        currentPath = '/';
    },
    echo: (args) => {
        printLine(args.join(' '));
    },
    pwd: () => {
        printLine(currentPath);
    },
    ls: async (args) => {
        await listDir(args[0]);
    },
    cd: async (args) => {
        await changeDir(args[0]);
    }

};

const commandList = Object.keys(commands);
let history = [];
let historyIndex = -1;

// Handle input
input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
        terminalInitialized = false;
        modal.style.display = 'none';
        output.innerHTML = '';
        currentPath = '/';
    } else if (e.key === 'Enter') {
        const raw = input.value.trim();
        const [cmd, ...args] = raw.split(' ');
        const command = cmd.toLowerCase();

        if (command) {
            if (history[history.length - 1] !== raw) {
                history.push(raw);
            }
            historyIndex = history.length;
            printLine(`${currentPath}> ${raw}`);
            if (commands[command]) {
                commands[command](args);
            } else {
                printLine(`Command not found: ${command}`);
            }
        } else {
            printLine(`${currentPath}> `);
        }
        input.value = '';
        scrollToBottom();
    } else if (e.key === 'Tab') {
        e.preventDefault();

        const { command, dir, partial } = splitPathForAutocomplete(input.value.trim());

        if (command === 'cd' || command === 'ls') {
            // Autocompletion for cd and ls commands
            const targetPath = dir ? `${currentPath}/${dir}` : currentPath;

            // Filter
            getEntriesForPath(targetPath).then(entries => {
                const matches = entries
                    .filter(entry => entry.name.startsWith(partial))
                    .filter(entry => command === 'cd' ? entry.type === 'dir' : true)
                    .map(entry => entry.name);

                if (matches.length === 1) {
                    // Autocomplete single match
                    const entry = entries.find(e => e.name === matches[0]);
                    if (entry && entry.type === 'dir') {
                        const newPath = dir ? `${dir}/${matches[0]}/` : `${matches[0]}/`;
                        input.value = `${command} ${newPath}`;
                    } else {
                        const newPath = dir ? `${dir}/${matches[0]}` : matches[0];
                        input.value = `${command} ${newPath}`;
                    }
                } else if (matches.length > 1) {
                    // Show options
                    const matchedText = matches.reduce((acc, name) => {
                        let i = 0;
                        while (i < acc.length && i < name.length && acc[i] === name[i]) {
                            i++;
                        }
                        return acc.slice(0, i);
                    });
                    input.value = dir ? `${command} ${dir}/${matchedText}` : `${command} ${matchedText}`;
                    const line = document.createElement('div');
                    matches.forEach((name, idx) => {
                        const entry = entries.find(e => e.name === name);
                        const span = document.createElement('span');
                        span.textContent = name + (idx < matches.length - 1 ? '   ' : '');
                        span.style.marginRight = '5px';
                        span.style.color = entry && entry.type === 'dir' ? '#4EA1FF' : 'var(--color-text)';
                        line.appendChild(span);
                    });
                    output.appendChild(line);
                    scrollToBottom();
                }
            });
        } else {
            // Autocompletion for other commands
            const matches = commandList.filter(c => c.startsWith(command));
            if (matches.length === 1) {
                input.value = `${matches[0]} `;
            } else if (matches.length > 1) {
                const line = document.createElement('div');
                matches.forEach((match, idx) => {
                    const span = document.createElement('span');
                    span.textContent = match + (idx < matches.length - 1 ? '   ' : '');
                    span.style.marginRight = '5px';
                    span.style.color = 'var(--color-text)';
                    line.appendChild(span);
                });
                output.appendChild(line);
                scrollToBottom();
            }
        }
    } else if (e.key === 'ArrowUp') {
        if (historyIndex > 0) {
            historyIndex--;
            input.value = history[historyIndex];
        }
        moveCursorToEnd();
    } else if (e.key === 'ArrowDown') {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            input.value = history[historyIndex];
        } else {
            historyIndex = history.length;
            input.value = '';
        }
        moveCursorToEnd();
    }
});

// Print a line in the terminal output
function printLine(text, className = '') {
    const line = document.createElement('div');
    line.innerHTML = text;
    if (className) line.classList.add(className);
    output.appendChild(line);
    scrollToBottom();
}

// Scroll to the bottom of the terminal output
function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
}

// Move cursor to the end of the input field
function moveCursorToEnd() {
    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
}

// Utility function to join paths
function pathJoin(base, target) {
    if (target.startsWith('/')) return target;
    const parts = [...base.split('/').filter(Boolean), ...target.split('/').filter(Boolean)];
    return '/' + parts.join('/');
}

async function listDir(target) {
    const res = await fetch(`/api/fs?path=${encodeURIComponent(target || currentPath)}`);
    const data = await res.json();

    if (data.error) {
        printLine(`Error: ${data.error}`);
        return;
    }

    // If data.entries is an array, list them; if it's a single file, show its name
    if (Array.isArray(data.entries)) {
        const line = document.createElement('div');
        data.entries.forEach((entry, idx) => {
            const span = document.createElement('span');
            span.textContent = entry.name + (idx < data.entries.length - 1 ? '   ' : '');
            span.style.color = entry.type === 'dir' ? '#4EA1FF' : 'var(--color-text)';
            span.style.marginRight = '5px';
            line.appendChild(span);
        });
        output.appendChild(line);
    } else if (data.file) {
        // Single file or directory
        const span = document.createElement('span');
        span.textContent = data.file;
        span.style.color = 'var(--color-text)';
        span.style.marginRight
        output.appendChild(span);
    } else {
        printLine('No entries found.');
    }
    scrollToBottom();
}

async function changeDir(target) {
    if (!target || target === '/') {
        currentPath = '/';
        return;
    }

    if (target === '..') {
        // Go up one directory
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        currentPath = '/' + parts.join('/');
        return;
    }

    // Verify if target is a valid directory
    const newPath = pathJoin(currentPath, target);
    const res = await fetch(`/api/fs?path=${encodeURIComponent(newPath)}`);
    const data = await res.json();

    if (data.error) {
        printLine(`cd: ${target}: No such file or directory`);
        return;
    }

    currentPath = newPath;
}

async function getEntriesForPath(path) {
    const res = await fetch(`/api/fs?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (data.error) return [];
    return data.entries;
}

function splitPathForAutocomplete(inputValue) {
    const parts = inputValue.split(' ');
    const command = parts[0];
    let partialPath = parts[1] || '';

    // Get directory and partial path
    const lastSlash = partialPath.lastIndexOf('/');
    const dir = lastSlash !== -1 ? partialPath.slice(0, lastSlash) : '';
    const partial = lastSlash !== -1 ? partialPath.slice(lastSlash + 1) : partialPath;

    return { command, dir, partial };
}
