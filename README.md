# SSH Key Inspection Manager (ssh-kim)

A cross-platform desktop application for managing SSH keys with a modern, intuitive interface. Built with Tauri and React.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ssh-kim

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## ✨ Features

- **🔧 Cross-platform**: Works on Windows, macOS, and Linux
- **🔑 Key Management**: Add, edit, and delete SSH keys
- **🔍 Auto-detection**: Automatically scans common SSH key locations
- **📝 Key Types**: Supports RSA, DSA, ECDSA, and Ed25519 keys
- **🔎 Search & Filter**: Find keys by name, tag, or type
- **🎨 Modern UI**: Clean, responsive interface with beautiful design
- **📦 Single Executable**: Packaged as a single clickable app icon
- **📋 Copy to Clipboard**: Easy key copying functionality
- **🏷️ Tagging System**: Organize keys with custom tags

## 📋 System Requirements

### Development
- **Node.js**: v16 or later
- **Rust**: Latest stable version
- **Platform-specific build tools**:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools
  - **Linux**: Build essentials (gcc, make, etc.)

### Runtime
- **macOS**: 10.15 or later
- **Windows**: Windows 10 or later
- **Linux**: Most modern distributions

## 📦 Installation

### Development Setup

2. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd ssh-kim
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run tauri dev
   ```

### Building for Production

```bash
npm run tauri build
```

This will create platform-specific executables in the `src-tauri/target/release/bundle/` directory.

## Usage

### Adding SSH Keys

1. **Manual Entry**: Paste your SSH public key content directly
2. **Scan Locations**: Automatically detect keys from common SSH directories
3. **File Import**: Select specific key files from your system

### Managing Keys

- **View**: All keys are displayed in a card-based layout
- **Edit**: Update key names and tags
- **Delete**: Remove keys with confirmation
- **Copy**: Copy key content to clipboard
- **Search**: Filter keys by name, tag, or type

### Supported Key Locations

- **Default SSH Directory**: `~/.ssh/` (Unix/Linux/macOS)
- **Windows PuTTY**: `%APPDATA%/PuTTY/`
- **Custom Locations**: Manually specify any directory

## Data Storage

SSH keys are stored in a JSON file located in the application's data directory:

- **macOS**: `~/.ssh-kim/ssh_keys.json`
- **Windows**: `%USERPROFILE%/.ssh-kim/ssh_keys.json`
- **Linux**: `~/.ssh-kim/ssh_keys.json`

### JSON Structure

```json
[
  {
    "id": "unique-uuid",
    "name": "User friendly name for the key",
    "tag": "Tags related to the key",
    "key": "the key content",
    "key_type": "The type of key (rsa, dsa, etc...)",
    "created": "timestamp",
    "source_path": "optional source file path"
  }
]
```

## 🏗️ Development

### Architecture

The application follows a modern desktop app architecture:

- **Frontend**: React-based UI with modern CSS styling
- **Backend**: Rust-based business logic with Tauri framework
- **Communication**: Tauri's IPC (Inter-Process Communication) system
- **Storage**: Local JSON file storage for persistence
- **Packaging**: Tauri bundler for cross-platform distribution

### Project Structure

```
ssh-kim/
├── src/                    # React frontend
│   ├── App.jsx            # Main application component
│   ├── App.css            # Styles
│   └── main.jsx           # Entry point
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Main Rust logic
│   │   └── main.rs        # Entry point
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── package.json           # Node.js dependencies
```

### Key Technologies

- **Frontend**: React 18, Vite, Lucide React Icons
- **Backend**: Rust, Tauri 2.0
- **Styling**: Modern CSS with responsive design
- **Packaging**: Tauri bundler for cross-platform distribution

### Building for Different Platforms

```bash
# Build for current platform
npm run tauri build

# Build for specific platform
npm run tauri build -- --target x86_64-unknown-linux-gnu
npm run tauri build -- --target x86_64-pc-windows-msvc
npm run tauri build -- --target x86_64-apple-darwin
```

## Security

- SSH keys are stored locally on your machine
- No data is transmitted to external servers
- Keys are stored in plain text (as they are public keys)
- Application has minimal system permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Note**: This application manages SSH public keys only. Private keys should never be stored in this application for security reasons.
