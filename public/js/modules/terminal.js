// =======================
// Terminal (and Snake game)
// =======================
// This is a large module, so only the main init function is exported here.
// The rest of the code is moved as-is from the original file.

export function initTerminal() {
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
    const isOpening = !terminalInitialized;
    terminalInitialized = isOpening;

    modal.style.display = isOpening ? 'flex' : 'none';
    if (isOpening) {
      document.body.classList.add('modal-open');
      output.innerHTML = '';
      printLine('Type "help" for commands.');
      focusInput();
    } else {
      document.body.classList.remove('modal-open');
      currentPath = '/';
    }
  });

  closeBtn.addEventListener('click', () => {
    terminalInitialized = false;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    output.innerHTML = '';
    currentPath = '/';
  });

  input.addEventListener('blur', () => {
    if (terminalInitialized) focusInput();
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
      document.body.classList.remove('modal-open');
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
    },
    snake: () => {
      startSnakeGame();
    }
  };

  const commandList = Object.keys(commands);
  let history = [];
  let historyIndex = -1;

  function terminalKeyHandler(e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      terminalInitialized = false;
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
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
  }

  // ----- Input handling -----
  input.addEventListener('keydown', terminalKeyHandler);

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
    line.classList.add('line');
    output.appendChild(line);
    scrollToBottom();
  }

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
  }

  function focusInput() {
    setTimeout(() => {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }, 50);
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

  // ====== Snake Game (front-only) ======
  let snakeGame = null;
  const ORIGINAL_CONTROLS_HTML = document.getElementById('terminal-controls').innerHTML;

  function startSnakeGame() {
    if (snakeGame) return;

    // Hide input while playing
    input.value = '';
    input.style.display = 'none';

    // Clear output and setup HUD + screen
    output.innerHTML = '';
    const hud = document.createElement('div');
    hud.className = 'snake-hud';
    hud.textContent = 'Snake — arrows/WASD to move, Q to quit';
    output.appendChild(hud);

    const screen = document.createElement('pre');
    screen.id = 'snake-screen';
    output.appendChild(screen);

    // Show Top 5 before starting (no command needed)
    // (async () => {
    //   printLine('<br>Fetching leaderboard…');
    //   const top5 = await fetchLeaderboard(5);
    //   printLeaderboard(top5, 'Top 5');
    //   const best = await fetchHighScore();
    //   if (best) {
    //     hud.textContent = `Snake — score: 0 — best: ${best.score} (${best.player}) — arrows/WASD to move, Q to quit`;
    //   }
    //   scrollToBottom();
    // })();

    // Mobile controls
    setSnakeControls(true);

    // Square map
    const innerWidth = 28;
    const innerHeight = 28;

    snakeGame = {
      screen,
      hud,
      cols: innerWidth,
      rows: innerHeight,
      speed: 120,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      snake: [],
      food: null,
      score: 0,
      timer: null,
      running: true
    };

    // Initialize snake
    const startX = Math.floor(innerWidth / 3);
    const startY = Math.floor(innerHeight / 2);
    snakeGame.snake = [
      { x: startX + 2, y: startY },
      { x: startX + 1, y: startY },
      { x: startX, y: startY }
    ];

    placeFood();
    renderSnake();
    window.addEventListener('keydown', handleSnakeKey, { passive: false });
    snakeGame.timer = setInterval(tickSnake, snakeGame.speed);
  }

  function endSnakeGame(message = 'Game over') {
    if (!snakeGame) return;

    clearInterval(snakeGame.timer);
    window.removeEventListener('keydown', handleSnakeKey);

    const finalScore = snakeGame.score;
    snakeGame.screen.textContent += `\n\n${message}. Final score: ${finalScore}`;

    // Ask for name to save score
    const ask = document.createElement('div');
    ask.className = 'line';
    ask.innerHTML = `<br>Enter your name to save the score (max 6 symbols):`;
    output.appendChild(ask);

    // Reactivate input to get name (max 6 symbols)
    input.removeEventListener('keydown', terminalKeyHandler);

    input.style.display = '';
    input.value = '';
    input.focus();

    const oneShotHandler = async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      document.removeEventListener('keydown', oneShotHandler);

      const name = input.value.trim();
      input.value = '';

      if (name) {
        localStorage.setItem('playerName', name);
        printLine(`Saving score for "${name}"...`);
        const ok = await saveScore(name, finalScore);
        if (ok) {
          printLine('Score saved!');
        } else {
          printLine('Could not save score.');
        }
      } else {
        printLine('Skipped saving score.');
      }

      // Show updated Top 10
      const top10 = await fetchLeaderboard(10);
      printLine('<br>');
      printLeaderboard(top10, 'Top 10 (updated)');

      // Clean UI
      output.appendChild(document.createElement('br'));
      printLine(`Game over. Score: ${finalScore}`);
      setSnakeControls(false);
      snakeGame = null;
      input.addEventListener('keydown', terminalKeyHandler);
      input.focus();
    };

    document.addEventListener('keydown', oneShotHandler);
  }


  function setSnakeControls(active) {
    const controls = document.getElementById('terminal-controls');
    if (!controls) return;

    if (active) {
      controls.innerHTML = `
          <button data-action="left">◀</button>
          <button data-action="up">▲</button>
          <button data-action="down">▼</button>
          <button data-action="right">▶</button>
          <button data-action="quit">Q</button>
        `;
    } else {
      controls.innerHTML = ORIGINAL_CONTROLS_HTML;
    }
  }

  // Overwrite the terminal controls
  controls.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    if (snakeGame) {
      if (action === 'left') return setSnakeDir(-1, 0);
      if (action === 'right') return setSnakeDir(1, 0);
      if (action === 'up') return setSnakeDir(0, -1);
      if (action === 'down') return setSnakeDir(0, 1);
      if (action === 'quit') return endSnakeGame('Quit');
      return;
    }

    // --- TERMINAL CONTROLS (mobile) ---
    if (action === 'tab') {
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      input.focus();
      input.dispatchEvent(tabEvent);
    } else if (action === 'up') {
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      input.focus();
      input.dispatchEvent(upEvent);
    } else if (action === 'down') {
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      input.focus();
      input.dispatchEvent(downEvent);
    }
  });

  function handleSnakeKey(e) {
    if (!snakeGame || !snakeGame.running) return;
    const k = e.key;
    if (k === 'q' || k === 'Q' || k === 'Escape') {
      e.preventDefault();
      return endSnakeGame('Quit');
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();

    if (k === 'ArrowUp' || k === 'w') setSnakeDir(0, -1);
    if (k === 'ArrowDown' || k === 's') setSnakeDir(0, 1);
    if (k === 'ArrowLeft' || k === 'a') setSnakeDir(-1, 0);
    if (k === 'ArrowRight' || k === 'd') setSnakeDir(1, 0);
  }

  function setSnakeDir(x, y) {
    if (!snakeGame) return;
    const { dir } = snakeGame;
    if (dir.x === -x && dir.y === -y) return;
    snakeGame.nextDir = { x, y };
  }

  function tickSnake() {
    if (!snakeGame || !snakeGame.running) return;

    snakeGame.dir = snakeGame.nextDir;
    const head = snakeGame.snake[0];
    const nx = head.x + snakeGame.dir.x;
    const ny = head.y + snakeGame.dir.y;

    if (nx < 0 || ny < 0 || nx >= snakeGame.cols || ny >= snakeGame.rows) {
      snakeGame.running = false;
      return endSnakeGame('Crashed');
    }
    for (const seg of snakeGame.snake) {
      if (seg.x === nx && seg.y === ny) {
        snakeGame.running = false;
        return endSnakeGame('Crashed');
      }
    }

    const newHead = { x: nx, y: ny };
    snakeGame.snake.unshift(newHead);

    if (snakeGame.food && nx === snakeGame.food.x && ny === snakeGame.food.y) {
      snakeGame.score++;
      placeFood();
    } else {
      snakeGame.snake.pop();
    }

    renderSnake();
  }

  function placeFood() {
    if (!snakeGame) return;
    while (true) {
      const fx = Math.floor(Math.random() * snakeGame.cols);
      const fy = Math.floor(Math.random() * snakeGame.rows);
      const onSnake = snakeGame.snake.some(s => s.x === fx && s.y === fy);
      if (!onSnake) {
        snakeGame.food = { x: fx, y: fy };
        break;
      }
    }
  }

  function renderSnake() {
    if (!snakeGame) return;

    const cols = snakeGame.cols;
    const rows = snakeGame.rows;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));

    if (snakeGame.food) grid[snakeGame.food.y][snakeGame.food.x] = '*';
    snakeGame.snake.forEach((seg, i) => {
      grid[seg.y][seg.x] = (i === 0) ? '@' : 'o';
    });

    const horizontal = '+'.repeat(cols + 2);
    let out = `${horizontal}\n`;
    for (let y = 0; y < rows; y++) {
      out += '+' + grid[y].join('') + '+\n';
    }
    out += horizontal;

    snakeGame.hud.textContent = `Snake — score: ${snakeGame.score}` + (snakeGame.best ? ` — best: ${snakeGame.best.score} (${snakeGame.best.player})` : '') + ` — arrows/WASD to move, Q to quit`;

    snakeGame.screen.textContent = out;

    scrollToBottom();
  }

  // --- Scores helpers (no new command needed) ---
  async function fetchLeaderboard(limit = 10) {
    try {
      const res = await fetch(`/api/scores?limit=${limit}`);
      if (!res.ok) throw new Error('Bad response');
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  }

  async function fetchHighScore() {
    const items = await fetchLeaderboard(1);
    return items[0] || null; // { player, score, created_at } | null
  }

  function printLeaderboard(items, title = 'Leaderboard') {
    printLine(`<br><span class="color-blue">${title}</span>`);
    if (!items.length) {
      printLine('(no scores yet)');
      return;
    }
    items.forEach((r, i) => {
      const rank = String(i + 1).padStart(2, ' ');
      printLine(`${rank}. ${r.player} — ${r.score}`);
    });
  }

  async function saveScore(player, score) {
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, score })
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.ok;
    } catch {
      return false;
    }
  }

}
