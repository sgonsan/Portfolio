// =======================
// Theme toggle
// =======================
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

// =======================
// Zen quote
// =======================
fetch('/api/zen')
    .then(res => res.json())
    .then(data => {
        const zenElement = document.getElementById('zen-quote');
        zenElement.textContent = `"${data.quote}"`;
        zenElement.classList.add('visible');
    })
    .catch(err => console.error('Error loading zen quote:', err));

// =======================
// Projects section
// =======================
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

// =======================
// Scroll tilt effect (mobile)
// =======================
let lastScrollY = window.scrollY;
let lastTime = Date.now();

function handleScrollTilt() {
    if (window.innerWidth >= 768) return;

    const now = Date.now();
    const deltaY = window.scrollY - lastScrollY;
    const deltaTime = now - lastTime;
    const velocity = deltaY / deltaTime;

    const maxTiltSmall = 1500;
    const maxTiltLarge = 10;
    const tiltSmall = Math.max(Math.min(velocity * 500, maxTiltSmall), -maxTiltSmall);
    const tiltLarge = Math.max(Math.min(velocity * 10, maxTiltLarge), -maxTiltLarge);

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

    clearTimeout(handleScrollTilt.resetTimeout);
    handleScrollTilt.resetTimeout = setTimeout(() => {
        document.querySelectorAll('.skill-card, .project-card').forEach(card => {
            card.style.transform = `rotateX(0deg)`;
            card.classList.remove('tilt');
        });
    }, 150);
}

window.addEventListener('scroll', handleScrollTilt);

// =======================
// Mouse move effect on project cards
// =======================
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

// =======================
// Contact form
// =======================
const form = document.getElementById('contact-form');
const submitButton = form.querySelector('button');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !email || !message) {
        return alert('Please fill in all fields');
    }
    if (!/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
        return alert('Please enter a valid email address');
    }

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
        submitButton.disabled = false;
        submitButton.textContent = 'Send';
    }
});

// =======================
// Stats footer
// =======================
fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
        const stats = document.getElementById('site-stats');
        stats.textContent = `Visits: ${data.visits} | Last update: ${data.lastCommit}`;
    })
    .catch(err => console.error('Error loading stats:', err));

// =======================
// Terminal
// =======================
const openBtn = document.getElementById('open-terminal');
const modal = document.getElementById('terminal-modal');
const closeBtn = document.getElementById('close-terminal');
const output = document.getElementById('terminal-output');
const input = document.getElementById('terminal-input');

let terminalInitialized = false;
let currentPath = '/';
let fsTree = null; // Cache for filesystem tree

// ----- Load filesystem once -----
async function loadFileSystem() {
    try {
        const res = await fetch('/api/fs');
        fsTree = await res.json();
    } catch (err) {
        console.error('Failed to load filesystem:', err);
    }
}
loadFileSystem();

// ----- Helpers for FS navigation -----
function getNodeAtPath(pathStr) {
    if (!fsTree) return null;
    const parts = pathStr.split('/').filter(Boolean);
    let current = fsTree;
    for (const part of parts) {
        const node = current.find(n => n.name === part && n.type === 'dir');
        if (!node) return null;
        current = node.children;
    }
    return current;
}

function listEntriesAtPath(pathStr) {
    const node = getNodeAtPath(pathStr);
    return node || [];
}

// ----- Terminal UI -----
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

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    output.innerHTML = '';
    terminalInitialized = false;
    currentPath = '/';
});

// ----- Commands -----
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
        printLine('<span class="color-green">pwd</span> - Show current directory');
        printLine('<span class="color-green">ls</span> - List contents of current directory');
        printLine('<span class="color-green">cd</span> - Change directory');
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
    ls: (args) => {
        const targetPath = args[0] ? pathJoin(currentPath, args[0]) : currentPath;
        const entries = listEntriesAtPath(targetPath);

        if (!entries.length) {
            // Check if the argument is a valid file
            if (args[0]) {
                const parentPath = targetPath.substring(0, targetPath.lastIndexOf('/')) || '/';
                const parentEntries = listEntriesAtPath(parentPath);
                const fileName = targetPath.split('/').pop();
                const fileEntry = parentEntries.find(e => e.name === fileName && e.type === 'file');
                if (fileEntry) {
                    return printLine(fileEntry.name);
                }
            }
            return printLine('(empty)');
        }

        const dirs = entries.filter(e => e.type === 'dir').map(e => `${e.name}/`);
        const files = entries.filter(e => e.type === 'file').map(e => e.name);

        if (dirs.length) printLine(dirs.join('   '), 'color-blue');
        if (files.length) printLine(files.join('   '));
    },
    cd: (args) => {
        if (!args[0] || args[0] === '/') {
            currentPath = '/';
            return;
        }
        if (args[0] === '..') {
            const parts = currentPath.split('/').filter(Boolean);
            parts.pop();
            currentPath = '/' + parts.join('/');
            return;
        }

        const targetPath = pathJoin(currentPath, args[0]);
        const node = getNodeAtPath(targetPath);
        if (!node) {
            printLine(`cd: ${args[0]}: No such directory`);
        } else {
            currentPath = targetPath;
        }
    }
};

const commandList = Object.keys(commands);
let history = [];
let historyIndex = -1;

// ----- Input handling -----
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
            if (history[history.length - 1] !== raw) history.push(raw);
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
        handleAutocomplete(input.value.trim());
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

const controls = document.getElementById('terminal-controls');

controls.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    if (action === 'tab') { // Simulate Tab key press
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
        input.focus();
        input.dispatchEvent(tabEvent);
    } else if (action === 'up') { // Simulate ArrowUp key press
        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        input.focus();
        input.dispatchEvent(upEvent);
    } else if (action === 'down') { // Simulate ArrowDown key press
        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        input.focus();
        input.dispatchEvent(downEvent);
    }
});


// ----- Autocomplete -----
function handleAutocomplete(value) {
    const { command, dir, partial } = splitPathForAutocomplete(value);

    if (command === 'cd' || command === 'ls') {
        const basePath = dir ? pathJoin(currentPath, dir) : currentPath;
        const entries = listEntriesAtPath(basePath);

        const matches = entries
            .filter(e => e.name.startsWith(partial))
            .filter(e => command === 'cd' ? e.type === 'dir' : true)
            .map(e => e.name);

        if (matches.length === 1) {
            const matchedEntry = entries.find(e => e.name === matches[0]);
            if (matchedEntry && matchedEntry.type === 'dir') {
                const newPath = dir ? `${dir}/${matches[0]}/` : `${matches[0]}/`;
                input.value = `${command} ${newPath}`;
            } else {
                const newPath = dir ? `${dir}/${matches[0]}` : `${matches[0]}`;
                input.value = `${command} ${newPath}`;
            }
        } else if (matches.length > 1) {
            // Find common prefix
            const maxMatch = getCommonPrefix(matches);
            input.value = `${command} ${dir ? dir + '/' : ''}${maxMatch}`;
            printLine(matches.join('   '));
            scrollToBottom();
        }
    } else {
        const matches = commandList.filter(c => c.startsWith(command));
        if (matches.length === 1) {
            input.value = `${matches[0]} `;
        } else if (matches.length > 1) {
            printLine(matches.join('   '));
            scrollToBottom();
        }
    }
}

// ----- Utils -----
function printLine(text, className = '') {
    const line = document.createElement('div');
    line.innerHTML = text;
    if (className) line.classList.add(className);
    output.appendChild(line);
    scrollToBottom();
}

function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
}

function moveCursorToEnd() {
    // Ensure focus and move cursor to end after value update
    setTimeout(() => {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
    }, 2);
}

function pathJoin(base, target) {
    if (target.startsWith('/')) return target;
    const parts = [...base.split('/').filter(Boolean), ...target.split('/').filter(Boolean)];
    return '/' + parts.join('/');
}

function splitPathForAutocomplete(inputValue) {
    const parts = inputValue.split(' ');
    const command = parts[0];
    let partialPath = parts[1] || '';

    const lastSlash = partialPath.lastIndexOf('/');
    const dir = lastSlash !== -1 ? partialPath.slice(0, lastSlash) : '';
    const partial = lastSlash !== -1 ? partialPath.slice(lastSlash + 1) : partialPath;

    return { command, dir, partial };
}

function getCommonPrefix(arr) {
    if (!arr.length) return '';
    let prefix = arr[0];
    for (let i = 1; i < arr.length; i++) {
        let j = 0;
        while (j < prefix.length && j < arr[i].length && prefix[j] === arr[i][j]) {
            j++;
        }
        prefix = prefix.slice(0, j);
        if (!prefix) break;
    }
    return prefix;
}