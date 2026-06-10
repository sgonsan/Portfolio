// Single source of truth for every editable text on the site.
// db/migrate.js seeds these into site_content; the content service merges
// DB values over them so a missing row can never blank a section; the SSR
// page falls back to them entirely if the DB is down.

const DEFAULT_CONTENT = {
  meta: {
    title: 'Sergio González Sánchez - Portfolio',
    description: 'Portfolio of Sergio González Sánchez, developer specialized in C++ and Python. Explore skills, projects and achievements.',
    og_description: 'Passionate C++ and Python developer focused on scalable and efficient solutions. Check out my projects and achievements.'
  },
  about: {
    path: '~/about',
    greeting: 'whoami',
    name: 'SERGIO GONZÁLEZ SÁNCHEZ',
    description: 'A passionate developer focused on creating efficient, scalable solutions and delivering high-quality user experiences.',
    scroll_hint: 'scroll'
  },
  skills: {
    path: '~/skills',
    title: 'skills',
    groups: [
      { name: 'languages', items: ['C++', 'Python', 'JavaScript', 'Bash'] },
      { name: 'web', items: ['HTML5', 'CSS3', 'Node.js', 'Astro'] },
      { name: 'systems', items: ['Linux', 'Git', 'Docker'] }
    ]
  },
  projects: {
    path: '~/projects',
    title: 'projects',
    error_text: 'could not load projects — find them on github.com/sgonsan'
  },
  timeline: {
    path: '~/timeline',
    title: 'timeline',
    items: [
      {
        date: '2025-02',
        title: 'Maze Solver with Deep Q-Networks',
        description: 'Developed a reinforcement learning agent to solve ASCII mazes directly in the terminal using Python.',
        tags: ['Python', 'Reinforcement Learning', 'DQN']
      },
      {
        date: '2025-01',
        title: 'Chat 1 – Multiclient Chat with ncurses',
        description: 'Built a real-time C++ chat system with sockets and ncurses, supporting multiple clients, nicknames, and formatted UI.',
        tags: ['C++', 'Sockets', 'ncurses']
      },
      {
        date: '2024-12',
        title: '2048 AI Agent',
        description: 'Implemented a neural network capable of playing 2048 autonomously in the terminal.',
        tags: ['C++', 'AI', 'Game Development']
      },
      {
        date: '2024-10',
        title: 'Home Assistant & Proxmox Cluster',
        description: 'Deployed a self-hosted smart home environment with containers, Jellyfin, AdGuard, and integrated automation.',
        tags: ['Proxmox', 'Home Assistant', 'Linux']
      },
      {
        date: '2024-06',
        title: 'Fastgrep CLI Tool',
        description: 'Created a high-performance grep-like command-line tool in C++ with multithreading and custom chunk parsing.',
        tags: ['C++', 'CLI', 'Multithreading']
      },
      {
        date: '2023-12',
        title: 'Wake-on-LAN Manager',
        description: 'Designed a C++ tool to manage and wake remote PCs via network packets, integrated into server workflows.',
        tags: ['C++', 'Networking', 'Systems']
      }
    ]
  },
  achievements: {
    path: '~/achievements',
    title: 'achievements',
    items: [
      {
        title: 'Maxoarte Award 2022 — Other Musical Modalities',
        description: 'Recognized for innovative music projects exploring new approaches to production and composition.'
      }
    ]
  },
  contact: {
    path: '~/contact',
    title: 'contact',
    label_name: 'name',
    label_email: 'email',
    label_message: 'message',
    button: 'send message',
    success_text: 'message sent — thanks!',
    error_text: 'something went wrong, try again later'
  },
  footer: {
    session: 'elbiti',
    copyright: 'sergio gonzález sánchez',
    terminal_button: 'open terminal'
  }
};

// Sections that can be reordered/disabled (meta and footer are fixed chrome).
const DEFAULT_ORDER = ['about', 'skills', 'projects', 'timeline', 'achievements', 'contact'];

module.exports = { DEFAULT_CONTENT, DEFAULT_ORDER };
