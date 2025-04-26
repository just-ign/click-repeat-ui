# Click Repeat

A desktop automation tool built with Electron, React, TypeScript, and Shadcn UI that allows you to record and replay UI workflows.

## Features

- 🎥 **Record UI Interactions** - Capture mouse movements, clicks, and keyboard actions
- 🤖 **Automated Replay** - Run saved workflows with a single click
- 📱 **Minimal Interface** - Unobtrusive floating window that stays out of your way
- 🎨 **Modern UI** - Beautiful, accessible interface built with Shadcn UI components
- 🌙 **Dark mode support** - Automatically adapts to system preferences

## How It Works

1. **Record** - Click the "Record" button to start capturing your screen interactions
2. **Process** - Recordings are automatically processed into reusable workflows
3. **Replay** - Click the "Play" button to select and execute any saved workflow

The app intelligently scales coordinates between different screen resolutions, making workflows portable across different devices.

## Prerequisites

- [Node.js](https://nodejs.org/) (version 16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## Getting Started

### Installation

```bash
# Clone the repository (or download the zip)
git clone https://github.com/just-ign/click-repeat-ui.git
cd click-repeat

# Install dependencies
npm install
# or
yarn
```

### Development

Start the app in development mode:

```bash
npm run dev
# or
yarn dev
```

### Building

Build the app for production:

```bash
npm run make
# or
yarn make
```

This will generate platform-specific distributables in the `out` directory.

## Project Structure

```
├── src/
│   ├── main.ts                # Electron main process
│   ├── preload.ts             # Preload script
│   ├── App.tsx                # Main React component
│   ├── general-agent.ts       # Core automation functionality
│   └── api.ts                 # API communication
├── components/                # UI components
│   └── ui/                    # Shadcn UI components
├── public/                    # Static assets
└── ...
```

## License

MIT
