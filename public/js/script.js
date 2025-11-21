
// Modularized imports
import { initThemeToggle } from './modules/theme.js';
import { initProjectsSection } from './modules/projects.js';
import { initTimeline } from './modules/timeline.js';
import { initContactForm } from './modules/contact.js';
import { initTerminal } from './modules/terminal.js';
import { initEffects } from './modules/effects.js';
import { initProjectModal } from './modules/projectModal.js';
import { initSiteData } from './modules/siteData.js';

// Initialize all modules
initThemeToggle();
initSiteData();
initProjectsSection();
initTimeline();
initContactForm();
initTerminal();
initEffects();
initProjectModal();
