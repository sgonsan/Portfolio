
<div align="center">
  <img src="public/assets/icon.png" alt="Project Icon" width="120"/>
  <h1>Portfolio Web Application</h1>
  <p>A modern, responsive portfolio website built with Node.js and Express.</p>
</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## About

This project is a personal portfolio web application designed to showcase your projects, skills, and contact information. It is built using Node.js and Express, and serves static assets as well as dynamic project and contact data. The application is ready for deployment and can be easily customized.

## Features

- Responsive and modern UI (light/dark mode, subtle animations, 3D tilt effects)
- Project showcase with dynamic data (loads project info from GitHub or local JSON)
- Contact form with email sending (Nodemailer)
- Rate limiting for contact form to prevent spam
- Statistics endpoint
- RESTful API structure
- Static asset serving (images, fonts, CSS, JS)
- Mobile optimized
- Environment variable support

## Project Structure

```text
prod/
├── controllers/         # Express controllers for API endpoints
├── public/              # Static files (HTML, CSS, JS, images, fonts)
│   ├── assets/          # Images and font files
│   ├── css/             # Stylesheets
│   └── js/              # Client-side JavaScript
├── routes/              # Express route definitions
├── .env                 # Environment variables (not committed)
├── .env.example         # Example environment variables
├── package.json         # Project metadata and dependencies
├── projects.json        # Project data
├── stats.json           # Statistics data
├── server.js            # Main server entry point
└── README.md            # Project documentation
```

## Installation

1. **Clone the repository:**

  ```bash
  git clone https://github.com/your-username/your-repo.git
  cd your-repo/prod
  ```

2. **Install dependencies:**

  ```bash
  npm install
  ```

3. **Configure environment variables:**

- Copy `.env.example` to `.env` and update the values as needed.

## Usage

- **Start the server:**

  ```bash
  npm start
  ```

- The application will be available at `http://localhost:PORT` (default port is set in `.env`).

## Environment Variables

The application uses environment variables for configuration. See `.env.example` for all available options. Typical variables include:

- `PORT` - The port number to run the server on
- `NODE_ENV` - The environment (development/production)
- `GITHUB_TOKEN` - (Optional) GitHub API token for project loading
- `MAIL_USER` - Email address for contact form
- `MAIL_PASS` - App password for email sending

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
