// Terminal easter egg. Lazy-loaded on first open.
// SECURITY: every piece of dynamic text (API responses, user input,
// leaderboard names) is rendered via textContent — never innerHTML.

const VFS = {
  'about.txt': 'Sergio González Sánchez — software developer.\nC++ and Python, with a soft spot for terminals.\nThis website is one big terminal, after all.',
  'contact.txt': 'email: use the contact form\ngithub: github.com/sgonsan\nlinkedin: linkedin.com/in/sergio-gonsan',
  skills: {
    'languages.txt': 'C++  Python  JavaScript  Bash',
    'web.txt': 'HTML5  CSS3  Node.js  Astro',
    'systems.txt': 'Linux  Git  Docker'
  },
  projects: {
    'readme.txt': 'Live cards are in the projects section.\nSource: github.com/sgonsan'
  },
  '.secret': {
    'flag.txt': 'You found it. Try "game" for the real challenge.'
  }
};

const PLAYER_REGEX = /^[A-Za-z0-9_-]{1,16}$/;

export function initTerminal() {
  const dialog = document.getElementById('terminal');
  const output = document.getElementById('terminal-output');
  const input = document.getElementById('terminal-input');
  const prompt = document.getElementById('terminal-prompt');
  const closeBtn = document.getElementById('terminal-close');
  if (!dialog || !output || !input) return null;

  let cwd = [];
  let history = [];
  let historyIdx = -1;
  let game = null;

  // ---------- rendering ----------
  function line(text = '', colorClass) {
    const div = document.createElement('div');
    if (colorClass) {
      const span = document.createElement('span');
      span.className = colorClass;
      span.textContent = text;
      div.appendChild(span);
    } else {
      div.textContent = text;
    }
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
    return div;
  }

  function promptPath() {
    return `~${cwd.length ? '/' + cwd.join('/') : ''}`;
  }
  function refreshPrompt() {
    prompt.textContent = `sergio@elbiti:${promptPath()}$`;
  }

  // ---------- virtual fs ----------
  function nodeAt(parts) {
    let node = VFS;
    for (const part of parts) {
      if (typeof node !== 'object' || !(part in node)) return null;
      node = node[part];
    }
    return node;
  }

  function resolve(arg) {
    const parts = [...cwd];
    for (const piece of (arg || '').split('/')) {
      if (!piece || piece === '.') continue;
      if (piece === '..') parts.pop();
      else if (piece === '~') parts.length = 0;
      else parts.push(piece);
    }
    return parts;
  }

  // ---------- commands ----------
  const commands = {
    help() {
      line('available commands:', 'color-blue');
      line('  help        this list');
      line('  ls [dir]    list directory');
      line('  cd <dir>    change directory');
      line('  cat <file>  print file');
      line('  whoami      who am i');
      line('  zen         github zen quote');
      line('  stats       site stats');
      line('  top         leaderboard top 10');
      line('  game        play snake, submit your score');
      line('  theme       toggle light/dark');
      line('  clear       clear screen');
      line('  exit        close terminal');
    },

    ls(args) {
      const target = nodeAt(resolve(args[0] || ''));
      if (target === null) return line(`ls: no such directory: ${args[0]}`, 'color-red');
      if (typeof target === 'string') return line(args[0]);
      for (const [name, value] of Object.entries(target)) {
        line(typeof value === 'object' ? `${name}/` : name, typeof value === 'object' ? 'color-blue' : undefined);
      }
    },

    cd(args) {
      if (!args[0] || args[0] === '~') { cwd = []; return refreshPrompt(); }
      const parts = resolve(args[0]);
      const target = nodeAt(parts);
      if (target === null || typeof target === 'string') {
        return line(`cd: no such directory: ${args[0]}`, 'color-red');
      }
      cwd = parts;
      refreshPrompt();
    },

    cat(args) {
      if (!args[0]) return line('usage: cat <file>', 'color-yellow');
      const target = nodeAt(resolve(args[0]));
      if (target === null) return line(`cat: no such file: ${args[0]}`, 'color-red');
      if (typeof target === 'object') return line(`cat: ${args[0]} is a directory`, 'color-red');
      target.split('\n').forEach((l) => line(l));
    },

    whoami() {
      line('sergio gonzález sánchez — c++ / python developer', 'color-purple');
    },

    async zen() {
      try {
        const res = await fetch('/api/zen');
        const data = await res.json();
        line(`"${data.quote}"`, 'color-green');
      } catch {
        line('zen unavailable', 'color-red');
      }
    },

    async stats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        line(`visits: ${data.visits}`);
        line(`last commit: ${data.lastCommit || 'n/a'}`);
      } catch {
        line('stats unavailable', 'color-red');
      }
    },

    async top() {
      await printTop(10);
    },

    game() {
      startSnake();
    },

    theme() {
      document.getElementById('theme-toggle')?.click();
      line('theme toggled');
    },

    clear() {
      output.replaceChildren();
    },

    exit() {
      dialog.close();
    }
  };

  async function printTop(n) {
    try {
      const res = await fetch(`/api/scores?limit=${n}`);
      const { items } = await res.json();
      if (!items.length) return line('no scores yet — be the first: "game"', 'color-yellow');
      line(`top ${items.length}:`, 'color-blue');
      items.forEach((row, i) => {
        line(`  ${String(i + 1).padStart(2)}. ${String(row.player).padEnd(18)} ${row.score}`);
      });
    } catch {
      line('leaderboard unavailable', 'color-red');
    }
  }

  // ---------- snake ----------
  const COLS = 24;
  const ROWS = 12;

  function startSnake() {
    if (game) return;
    line('snake — arrows/wasd to move, q to quit', 'color-yellow');
    const board = line('', undefined);
    board.className = 'game-board';

    const state = {
      snake: [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: { x: 14, y: 6 },
      score: 0,
      timer: 0
    };

    function placeFood() {
      do {
        state.food = {
          x: Math.floor(Math.random() * COLS),
          y: Math.floor(Math.random() * ROWS)
        };
      } while (state.snake.some((s) => s.x === state.food.x && s.y === state.food.y));
    }

    function draw() {
      const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('·'));
      grid[state.food.y][state.food.x] = '◆';
      state.snake.forEach((seg, i) => {
        grid[seg.y][seg.x] = i === 0 ? '█' : '▓';
      });
      board.textContent =
        `score: ${state.score}\n` +
        '┌' + '─'.repeat(COLS) + '┐\n' +
        grid.map((row) => '│' + row.join('') + '│').join('\n') +
        '\n└' + '─'.repeat(COLS) + '┘';
      output.scrollTop = output.scrollHeight;
    }

    function tick() {
      state.dir = state.nextDir;
      const head = {
        x: state.snake[0].x + state.dir.x,
        y: state.snake[0].y + state.dir.y
      };
      const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
      const hitSelf = state.snake.some((s) => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) return endGame();

      state.snake.unshift(head);
      if (head.x === state.food.x && head.y === state.food.y) {
        state.score += 10;
        placeFood();
      } else {
        state.snake.pop();
      }
      draw();
    }

    function onKey(event) {
      const k = event.key;
      const turns = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }
      };
      if (k === 'q' || k === 'Q') return endGame();
      const turn = turns[k];
      if (!turn) return;
      event.preventDefault();
      // forbid instant reversal
      if (turn.x === -state.dir.x && turn.y === -state.dir.y) return;
      state.nextDir = turn;
    }

    function endGame() {
      clearInterval(state.timer);
      document.removeEventListener('keydown', onKey);
      const finalScore = state.score;
      game = null;
      line(`game over — score: ${finalScore}`, 'color-yellow');
      if (finalScore > 0) {
        pendingScore = finalScore;
        line('save score? enter a name (letters/digits/_/-, max 16) or press enter to skip:', 'color-blue');
      }
      input.focus();
    }

    game = state;
    document.addEventListener('keydown', onKey);
    placeFood();
    draw();
    state.timer = setInterval(tick, 140);
  }

  let pendingScore = null;

  async function submitScore(name) {
    const player = name.trim();
    const score = pendingScore;
    pendingScore = null;
    if (!player) return line('score discarded');
    if (!PLAYER_REGEX.test(player)) {
      return line('invalid name: letters, digits, _ and - only (max 16)', 'color-red');
    }
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, score })
      });
      if (!res.ok) throw new Error();
      line('score saved!', 'color-green');
      await printTop(5);
    } catch {
      line('could not save score', 'color-red');
    }
  }

  // ---------- input handling ----------
  async function run(raw) {
    const value = raw.trim();
    line(`sergio@elbiti:${promptPath()}$ ${value}`, 'color-purple');
    if (pendingScore !== null) return submitScore(value);
    if (!value) return;
    history.push(value);
    historyIdx = history.length;
    const [cmd, ...args] = value.split(/\s+/);
    const handler = commands[cmd.toLowerCase()];
    if (handler) await handler(args);
    else line(`command not found: ${cmd} — try "help"`, 'color-red');
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const value = input.value;
      input.value = '';
      run(value);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (historyIdx > 0) input.value = history[--historyIdx];
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIdx < history.length - 1) input.value = history[++historyIdx];
      else { historyIdx = history.length; input.value = ''; }
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const partial = input.value.toLowerCase();
      const match = Object.keys(commands).filter((c) => c.startsWith(partial));
      if (match.length === 1) input.value = match[0] + ' ';
      else if (match.length > 1) line(match.join('  '), 'color-blue');
    }
  });

  closeBtn?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  function open() {
    if (dialog.open) return;
    dialog.showModal();
    if (!output.childElementCount) {
      line('welcome to elbiti pseudo-tty', 'color-purple');
      line('type "help" for commands.');
      line('');
    }
    refreshPrompt();
    input.focus();
  }

  return { open };
}
