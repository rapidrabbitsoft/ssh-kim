# SSH Key Manager (ssh-kim)

A cross-platform desktop application for managing SSH keys with a modern, intuitive interface. Built with Tauri and React.

## 🔐 Key Features

- **🔑 SSH Key Management**: Add, edit, delete, and organize SSH keys
- **🔒 Secure Storage**: AES-256 encrypted local storage
- **📤 Export/Import**: Password-protected key file sharing across machines
- **🔍 Auto-detection**: Scan common SSH key locations automatically
- **🏷️ Tagging System**: Organize keys with custom tags
- **🔎 Search & Filter**: Find keys by name, tag, or type
- **📋 Copy to Clipboard**: Easy key copying functionality
- **🎨 Modern UI**: Clean, responsive interface with beautiful design
- **📦 Single Executable**: Packaged as a single clickable app icon

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
npm run build:prod

# Clean build artifacts
npm run clean
```

## ✨ Features

- **🔧 Cross-platform**: Works on Windows, macOS, and Linux
- **🔑 Key Management**: Add, edit, and delete SSH keys
- **🔒 Secure Storage**: AES-256 encrypted local storage with machine-specific keys
- **📤 Export/Import**: Password-protected key file sharing across machines
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
# Build for current platform
npm run build:prod

# Build for specific platforms
npm run build:prod:mac    # macOS (Apple Silicon)
npm run build:prod:win    # Windows
npm run build:prod:linux  # Linux

# Clean build artifacts
npm run clean
```

This will create platform-specific executables in the `src-tauri/target/release/bundle/` directory.

## Usage

### Adding SSH Keys

1. **Manual Entry**: Paste your SSH public key content directly
2. **Scan Locations**: Automatically detect keys from common SSH directories
3. **File Import**: Select specific key files from your system

### Exporting and Importing Keys

1. **Export**: Create password-protected key files for sharing across machines
2. **Import**: Import password-protected key files with automatic duplicate detection
3. **Cross-platform**: Share keys securely between different operating systems

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

SSH Kim stores your SSH keys in an encrypted file located at `${home}/.ssh-kim/keys.enc` by default. The file uses AES-256 encryption with machine-specific keys for local storage.

### Encryption System

- **Local Storage**: Machine-specific encryption (automatically derived from machine ID)
- **Export/Import**: Password-based encryption for secure cross-machine sharing
- **Security**: No hardcoded encryption keys, all keys are derived securely

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
npm run build:prod

# Build for specific platforms
npm run build:prod:mac    # macOS (Apple Silicon)
npm run build:prod:win    # Windows
npm run build:prod:linux  # Linux
```

## Security

- **Local Storage**: SSH keys are stored locally on your machine
- **No Network**: No data is transmitted to external servers
- **Encrypted Storage**: Keys are encrypted using AES-256 encryption
- **Machine-Specific**: Local files use machine-specific encryption keys
- **Password Protection**: Export/import files use user-provided passwords
- **Minimal Permissions**: Application has minimal system permissions
- **Public Keys Only**: Only SSH public keys are stored (private keys should never be imported)

## Testing

A comprehensive test suite is included in `tests.js` that covers all major functionality:

```bash
# Run tests in browser console when app is running
# Open the app and press F12 to open developer tools
# Copy and paste test functions from tests.js

# Available test functions:
# - testCoreCommands() - Test basic functionality
# - testExportImportFunctionality() - Test file export/import
# - testPasswordProtectedExportImport() - Test password-protected export/import
# - testFileDialogs() - Test file dialogs
# - testKeyManagement() - Test key CRUD operations
# - runAllTests() - Run all tests
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly using the provided test suite
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Note**: This application manages SSH public keys only. Private keys should never be stored in this application for security reasons.
