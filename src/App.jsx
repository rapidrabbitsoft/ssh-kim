import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Key, 
  Plus, 
  Edit, 
  Trash2,
  Search, 
  FolderOpen, 
  FileText,
  Tag,
  Calendar,
  Type,
  Copy,
  Check,
  Settings,
  Folder,
  Save
} from 'lucide-react';
import './App.css';

function App() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [addMode, setAddMode] = useState('manual'); // 'manual', 'scan', 'file'
  const [scannedLocations, setScannedLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [deletingKeyId, setDeletingKeyId] = useState(null);
  const [keysFilePath, setKeysFilePath] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFileNotFoundModal, setShowFileNotFoundModal] = useState(false);
  const [missingFilePath, setMissingFilePath] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [exportPassword, setExportPassword] = useState('');
  const [importFilePath, setImportFilePath] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalPassword, setPasswordModalPassword] = useState('');
  const [passwordModalError, setPasswordModalError] = useState('');
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [exportPasswordModalPassword, setExportPasswordModalPassword] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [exportResult, setExportResult] = useState(null);


  // Form states
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    keyContent: '',
    sourcePath: ''
  });

  useEffect(() => {
    loadKeys();
    loadKeysFilePath();
  }, []);

  const loadKeysFilePath = async () => {
    try {
      const path = await invoke('get_keys_file_location');
      setKeysFilePath(path);
    } catch (error) {
      console.error('Failed to get keys file path:', error);
    }
  };

  const handleResetToDefault = async () => {
    try {
      setSettingsLoading(true);
      await invoke('reset_to_default_path');
      await loadKeysFilePath();
      await loadKeys();
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Failed to reset to default:', error);
      alert('Failed to reset to default: ' + error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCreateNewFile = async () => {
    try {
      // Create an empty keys array and save it to the missing file path
      await invoke('set_custom_keys_file_path', { filePath: missingFilePath });
      await invoke('create_new_keys_file');
      setShowFileNotFoundModal(false);
      await loadKeys();
    } catch (error) {
      console.error('Failed to create new file:', error);
      alert('Failed to create new file: ' + error);
    }
  };

  const handleSelectExistingFile = async () => {
    try {
              const newPath = prompt('Enter the path to an existing ssh_kim.enc file:');
      if (newPath) {
        await invoke('load_keys_from_file', { filePath: newPath });
        setShowFileNotFoundModal(false);
        await loadKeys();
        await loadKeysFilePath();
      }
    } catch (error) {
      console.error('Failed to load existing file:', error);
      alert('Failed to load existing file: ' + error);
    }
  };

  const handleChooseNewLocation = async () => {
    try {
              const newPath = prompt('Enter a new path for the ssh_kim.enc file:');
      if (newPath) {
        await invoke('set_custom_keys_file_path', { filePath: newPath });
        setShowFileNotFoundModal(false);
        await loadKeys();
        await loadKeysFilePath();
      }
    } catch (error) {
      console.error('Failed to set new location:', error);
      alert('Failed to set new location: ' + error);
    }
  };

  const handleExportKeys = async () => {
    try {
      console.log('🔍 handleExportKeys: Starting export...');
      
      // Show loading state
      setSettingsLoading(true);
      console.log('🔍 handleExportKeys: Set loading state to true');
      
      // Open save dialog to get the export location
      console.log('🔍 handleExportKeys: Opening save dialog...');
      const result = await invoke('open_save_dialog');
      
      if (result) {
        console.log('🔍 handleExportKeys: Selected save location:', result);
        
        // Export the current keys file to the selected location
        console.log('🔍 handleExportKeys: Calling export_keys_to_file with path:', result);
        await invoke('export_keys_to_file', { filePath: result });
        
        console.log('🔍 handleExportKeys: Export completed successfully');
        
        // Show success message
        alert(`Successfully exported keys file to:\n\n${result}`);
      } else {
        console.log('🔍 handleExportKeys: No save location selected');
        alert('Export cancelled - no location selected.');
      }
    } catch (error) {
      console.error('❌ handleExportKeys: Failed to export keys:', error);
      console.error('❌ handleExportKeys: Error type:', typeof error);
      console.error('❌ handleExportKeys: Error string:', error.toString());
      
      // Provide more specific error messages
      let errorMessage = 'Failed to export keys:\n\n';
      if (error.includes('Failed to create directory')) {
        errorMessage += '❌ Unable to create the target directory.\n\nPlease check the path and permissions.';
      } else if (error.includes('Failed to write file')) {
        errorMessage += '❌ Unable to write to the selected location.\n\nPlease check file permissions.';
      } else if (error.includes('Failed to serialize keys')) {
        errorMessage += '❌ Unable to prepare keys for export.\n\nPlease try again.';
      } else {
        errorMessage += `❌ ${error}`;
      }
      
      alert(errorMessage);
    } finally {
      console.log('🔍 handleExportKeys: Setting loading state to false');
      setSettingsLoading(false);
    }
  };

  const loadKeys = async () => {
    try {
      setLoading(true);
      const result = await invoke('get_ssh_keys');
      console.log('Loaded keys:', result);
      console.log('Key IDs:', result.map(k => k.id));
      setKeys(result);
    } catch (error) {
      console.error('Failed to load keys:', error);
      
      // Check if the error is due to file not found
      if (error.includes('Failed to read keys file') || 
          error.includes('No such file or directory') ||
          error.includes('not found') ||
          error.includes('does not exist')) {
        const currentPath = await invoke('get_keys_file_location');
        setMissingFilePath(currentPath);
        setShowFileNotFoundModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    try {
      setErrorMessage(''); // Clear any previous errors
      
      if (!formData.name.trim()) {
        setErrorMessage('Name is required');
        return;
      }

      if (!formData.keyContent.trim()) {
        setErrorMessage('Key content is required');
        return;
      }

      await invoke('add_ssh_key', {
        name: formData.name,
        tag: formData.tag || null,
        keyContent: formData.keyContent
      });

      setFormData({ name: '', tag: '', keyContent: '' });
      setShowAddModal(false);
      setAddMode('scan');
      setErrorMessage(''); // Clear error on success
      await loadKeys();
    } catch (error) {
      console.error('Failed to add key:', error);
      
      // Provide specific error messages for different validation failures
      if (error.includes('already exists')) {
        if (error.includes('name already exists')) {
          setErrorMessage('A key with this name already exists. Please choose a different name.');
        } else if (error.includes('content already exists')) {
          setErrorMessage('This SSH key content already exists in your collection. Please check if you have already added this key.');
        } else {
          setErrorMessage('This key already exists in your collection.');
        }
      } else {
        setErrorMessage('Failed to add key: ' + error);
      }
    }
  };

  const handleUpdateKey = async () => {
    try {
      if (!editingKey) return;
      setErrorMessage(''); // Clear any previous errors

      // Validate that key content is not empty
      if (!formData.keyContent.trim()) {
        setErrorMessage('Key content cannot be empty');
        return;
      }

      await invoke('update_ssh_key', {
        id: editingKey.id,
        update: {
          name: formData.name || null,
          tag: formData.tag || null,
          key: formData.keyContent || null
        }
      });

      setFormData({ name: '', tag: '', keyContent: '' });
      setShowEditModal(false);
      setEditingKey(null);
      setErrorMessage(''); // Clear error on success
      await loadKeys();
    } catch (error) {
      console.error('Failed to update key:', error);
      
      // Provide specific error messages for different validation failures
      if (error.includes('already exists')) {
        if (error.includes('name already exists')) {
          setErrorMessage('A key with this name already exists. Please choose a different name.');
        } else if (error.includes('content already exists')) {
          setErrorMessage('This SSH key content already exists in your collection. Please check if you have already added this key.');
        } else {
          setErrorMessage('This key already exists in your collection.');
        }
      } else {
        setErrorMessage('Failed to update key: ' + error);
      }
    }
  };

  const handleDeleteKey = async (id) => {
    console.log('=== DELETE KEY DEBUG ===');
    console.log('Attempting to delete key with ID:', id);
    console.log('Current keys:', keys.map(k => ({ id: k.id, name: k.name })));
    
    if (!confirm('Are you sure you want to delete this key?')) {
      console.log('User cancelled deletion');
      return;
    }

    try {
      setDeletingKeyId(id);
      console.log('Calling test_delete_key with ID:', id);
      await invoke('test_delete_key', { id });
      console.log('Key deleted successfully');
      console.log('Reloading keys...');
      await loadKeys();
      console.log('Keys reloaded successfully');
    } catch (error) {
      console.error('Failed to delete key:', error);
      alert('Failed to delete key: ' + error);
    } finally {
      setDeletingKeyId(null);
      console.log('=== DELETE KEY DEBUG END ===');
    }
  };

  const handleScanLocations = async () => {
    try {
      const locations = await invoke('scan_ssh_locations');
      setScannedLocations(locations);
      setAddMode('scan');
    } catch (error) {
      console.error('Failed to scan for public keys:', error);
      alert('Failed to scan for public keys: ' + error);
    }
  };

  const handleSelectFile = async (filePath) => {
    try {
      const content = await invoke('read_ssh_key_file', { filePath });
      setFormData(prev => ({ ...prev, keyContent: content }));
      setSelectedLocation(filePath);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert('Failed to read file: ' + error);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const filteredKeys = keys.filter(key =>
    key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (key.tag && key.tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
    key.key_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = async () => {
    setFormData({ name: '', tag: '', keyContent: '' });
    setSelectedLocation('');
    setErrorMessage('');
    setShowAddModal(true);
    setAddMode('scan');
    
    // Automatically trigger scan since it's now the default
    try {
      const locations = await invoke('scan_ssh_locations');
      setScannedLocations(locations);
    } catch (error) {
      console.error('Failed to scan for public keys:', error);
    }
  };

  const openEditModal = (key) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      tag: key.tag || '',
      keyContent: key.key
    });
    setErrorMessage('');
    setShowEditModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString();
  };





  const handleExportWithPassword = async () => {
    try {
      console.log('🔍 handleExportWithPassword: Starting export process...');
      
      // Open save dialog to get the export location
      const result = await invoke('open_save_dialog');
      
      if (result) {
        console.log('🔍 handleExportWithPassword: Selected save location:', result);
        
        // Store the selected file path and show password modal
        setImportFilePath(result); // Reuse this state for export path
        setShowExportPasswordModal(true);
      } else {
        console.log('❌ handleExportWithPassword: No save location selected');
      }
    } catch (error) {
      console.error('❌ handleExportWithPassword: Error opening save dialog:', error);
      alert('Failed to open save dialog: ' + error);
    }
  };

  const handleExportPasswordModalSubmit = async () => {
    try {
      console.log('🔍 handleExportPasswordModalSubmit: Starting password-protected export...');
      setSettingsLoading(true);
      
      const filePath = importFilePath.trim(); // Reuse this state for export path
      const password = exportPasswordModalPassword.trim();
      
      if (!password) {
        alert('Please enter a password.');
        return;
      }
      
      // Export with password protection
      await invoke('export_keys_with_password', { 
        filePath: filePath, 
        password: password 
      });
      
      setExportPasswordModalPassword('');
      setShowExportPasswordModal(false);
      
      // Set export result for display in settings modal
      setExportResult({
        file: filePath,
        keysExported: keys.length
      });
      
    } catch (error) {
      console.error('❌ handleExportPasswordModalSubmit: Failed to export:', error);
      alert('Failed to export with password protection: ' + error);
    } finally {
      setSettingsLoading(false);
    }
  };



  const handleImportWithPassword = async () => {
    try {
      console.log('🔍 handleImportWithPassword: Starting import process...');
      
      // Open file dialog to select the file to import
      console.log('🔍 handleImportWithPassword: Opening file dialog...');
      const filePath = await invoke('open_file_dialog');
      
      if (!filePath) {
        console.log('❌ handleImportWithPassword: No file selected');
        return;
      }
      
      console.log('🔍 handleImportWithPassword: Selected file:', filePath);
      
      // Store the selected file path and show password modal
      setImportFilePath(filePath);
      setPasswordModalError(''); // Clear any previous errors
      setShowPasswordModal(true);
      
    } catch (error) {
      console.error('❌ handleImportWithPassword: Error opening file dialog:', error);
      alert('Failed to open file dialog: ' + error);
    }
  };

  const handlePasswordModalSubmit = async () => {
    try {
      console.log('🔍 handlePasswordModalSubmit: Starting password-protected import...');
      setSettingsLoading(true);
      
      const filePath = importFilePath.trim();
      const password = passwordModalPassword.trim();
      
      if (!password) {
        alert('Please enter a password.');
        return;
      }
      
      // Import with password protection (handles decryption and merging)
      console.log('🔍 handlePasswordModalSubmit: Importing with password...');
      const importResult = await invoke('import_keys_with_password', { 
        filePath: filePath, 
        password: password 
      });
      
      console.log('🔍 handlePasswordModalSubmit: Successfully processed keys:', importResult.keys.length);
      
      // Update the keys in the UI
      setKeys(importResult.keys);
      setPasswordModalPassword('');
      setShowPasswordModal(false);
      
      // Set import result for display in settings modal
      setImportResult({
        file: filePath,
        totalImported: importResult.imported_count,
        newKeys: importResult.imported_count,
        duplicates: importResult.duplicate_count,
        totalInStore: importResult.total_in_store
      });
      
    } catch (error) {
      console.error('❌ handlePasswordModalSubmit: Failed to import:', error);
      
      // Provide more specific error messages
      let errorMessage = '';
      if (error.includes('Invalid encrypted data') || 
          error.includes('Failed to decode base64') || 
          error.includes('Failed to convert to string') ||
          error.includes('Failed to parse keys file')) {
        errorMessage = '❌ Invalid password. Please check your password and try again.';
      } else if (error.includes('File does not exist')) {
        errorMessage = '❌ The selected file does not exist.';
      } else if (error.includes('Failed to read file')) {
        errorMessage = '❌ Unable to read the file. Please check file permissions.';
      } else {
        errorMessage = `❌ ${error}`;
      }
      
      setPasswordModalError(errorMessage);
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div className="app">
      
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Key size={32} />
            <h1>SSH Key Manager</h1>
          </div>
          <div className="header-actions">
            <button className="settings-button" onClick={() => setShowSettingsModal(true)}>
              <Settings size={20} />
            </button>
            <button className="add-button" onClick={openAddModal}>
              <Plus size={20} />
              Add Key
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search keys by name, tag, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading">Loading keys...</div>
        ) : (
          <div className="keys-grid">
            {filteredKeys.length === 0 ? (
              <div className="empty-state">
                <Key size={64} />
                <h3>No SSH keys found</h3>
                <p>Add your first SSH key to get started</p>
                <button className="add-button" onClick={openAddModal}>
                  <Plus size={20} />
                  Add Key
                </button>
              </div>
            ) : (
              filteredKeys.map((key) => (
                <div key={key.id} className="key-card">
                  <div className="key-header">
                    <div className="key-info">
                      <h3>{key.name}</h3>
                      <div className="key-meta">
                        <span className="key-type">
                          <Type size={14} />
                          {key.key_type}
                        </span>
                        {key.tag && (
                          <span className="key-tag">
                            <Tag size={14} />
                            {key.tag}
                          </span>
                        )}
                        <span className="key-date">
                          <Calendar size={14} />
                          {formatDate(key.last_modified)}
                        </span>
                      </div>
                    </div>
                    <div className="key-actions">
                      <button
                        className="action-button"
                        onClick={() => copyToClipboard(key.key)}
                        title="Copy key"
                      >
                        {copiedId === key.key ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button
                        className="action-button"
                        onClick={() => openEditModal(key)}
                        title="Edit key"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        className="action-button"
                        onClick={async () => {
                          console.log('Test delete button clicked for key:', key.id);
                          try {
                            await invoke('test_delete_key', { id: key.id });
                            console.log('Test delete successful');
                            await loadKeys();
                          } catch (error) {
                            console.error('Test delete failed:', error);
                            alert('Test delete failed: ' + error);
                          }
                        }}
                        title="Test delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="key-content">
                    <pre>{key.key}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Add Key Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add SSH Key</h2>
              <button onClick={() => {
                setShowAddModal(false);
                setSelectedLocation('');
              }}>×</button>
            </div>
            <div className="modal-content">
              <div className="add-modes">
                <button
                  className={`mode-button ${addMode === 'scan' ? 'active' : ''}`}
                  onClick={handleScanLocations}
                >
                  <FolderOpen size={20} />
                  Scan Public Keys
                </button>
                <button
                  className={`mode-button ${addMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setAddMode('manual')}
                >
                  <FileText size={20} />
                  Manual Entry
                </button>
              </div>

              {addMode === 'scan' && scannedLocations.length > 0 && (
                <div className="scan-results">
                  <h3>Found Public SSH Keys</h3>
                  {scannedLocations.map((location, index) => (
                    <div key={index} className="location-group">
                      <h4>{location.path}</h4>
                      {location.keys.length > 0 ? (
                        <div className="key-files">
                          {location.keys.map((keyPath, keyIndex) => (
                            <button
                              key={keyIndex}
                              className={`key-file-button ${selectedLocation === keyPath ? 'selected' : ''}`}
                              onClick={() => handleSelectFile(keyPath)}
                            >
                              {keyPath.split('/').pop()}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p>No public keys found in this location</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter a friendly name for this key"
                />
              </div>

              <div className="form-group">
                <label>Tag (optional)</label>
                <input
                  type="text"
                  value={formData.tag}
                  onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                  placeholder="e.g., work, personal, server1"
                />
              </div>

              <div className="form-group">
                <label>Key Content *</label>
                <textarea
                  value={formData.keyContent}
                  onChange={(e) => setFormData(prev => ({ ...prev, keyContent: e.target.value }))}
                  placeholder="Paste your SSH public key content here..."
                  rows={6}
                />
              </div>

              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                </div>
              )}

            </div>
            <div className="modal-footer">
              <button onClick={() => {
                setShowAddModal(false);
                setSelectedLocation('');
                setErrorMessage('');
                setAddMode('scan');
              }}>Cancel</button>
              <button className="primary" onClick={handleAddKey}>Add Key</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Key Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit SSH Key</h2>
              <button onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter a friendly name for this key"
                />
              </div>

              <div className="form-group">
                <label>Tag</label>
                <input
                  type="text"
                  value={formData.tag}
                  onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                  placeholder="e.g., work, personal, server1"
                />
              </div>

              <div className="form-group">
                <label>Key Content</label>
                <textarea
                  value={formData.keyContent}
                  onChange={(e) => setFormData(prev => ({ ...prev, keyContent: e.target.value }))}
                  placeholder="SSH public key content..."
                  rows={6}
                />
              </div>

              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => {
                setShowEditModal(false);
                setErrorMessage('');
              }}>Cancel</button>
              <button className="primary" onClick={handleUpdateKey}>Update Key</button>
            </div>
          </div>
        </div>
      )}
      


      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Settings</h2>
              <button onClick={() => {
                setShowSettingsModal(false);
                setImportResult(null);
                setExportResult(null);
              }}>×</button>
            </div>
            <div className="modal-content">
              <h2>Settings</h2>
              <div className="settings-info">
                <p>Default path:</p>
                <div className="current-path">
                  {keysFilePath || '~/.ssh-kim/keys.enc'}
                </div>
              </div>


              

              
              <div className="form-group">
                <div className="file-input-group">
                  <button 
                    onClick={handleExportWithPassword} 
                    disabled={settingsLoading}
                    className="export-password-button"
                  >
                    {settingsLoading ? 'Exporting...' : 'Export'}
                  </button>
                  <button 
                    onClick={handleImportWithPassword} 
                    disabled={settingsLoading}
                    className="import-password-button"
                  >
                    {settingsLoading ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
              
              {importResult && (
                <div className="import-result">
                  <div className="import-result-header">
                    <h3>Last Import Result</h3>
                    <button 
                      onClick={() => setImportResult(null)}
                      className="import-result-dismiss"
                    >
                      ×
                    </button>
                  </div>
                  <div className="import-result-details">
                    <p><strong>File:</strong> {importResult.file}</p>
                    <p><strong>Keys imported:</strong> {importResult.newKeys}</p>
                    <p><strong>Duplicates ignored:</strong> {importResult.duplicates}</p>
                    <p><strong>Total keys in store:</strong> {importResult.totalInStore}</p>
                  </div>
                </div>
              )}

              {exportResult && (
                <div className="export-result">
                  <div className="export-result-header">
                    <h3>Last Export Result</h3>
                    <button 
                      onClick={() => setExportResult(null)}
                      className="export-result-dismiss"
                    >
                      ×
                    </button>
                  </div>
                  <div className="export-result-details">
                    <p><strong>File:</strong> {exportResult.file}</p>
                    <p><strong>Keys exported:</strong> {exportResult.keysExported}</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* File Not Found Modal */}
      {showFileNotFoundModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>SSH Keys File Not Found</h2>
              <button onClick={() => setShowFileNotFoundModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="file-not-found-info">
                <p><strong>Missing File:</strong> {missingFilePath}</p>
                <p>The SSH keys file could not be found at the expected location. Please choose an option below:</p>
              </div>
              
              <div className="file-not-found-actions">
                <button onClick={handleCreateNewFile} className="primary">
                  <FileText size={16} />
                  Create New File
                </button>
                <button onClick={handleSelectExistingFile}>
                  <Folder size={16} />
                  Select Existing File
                </button>
                <button onClick={handleChooseNewLocation}>
                  <Save size={16} />
                  Choose New Location
                </button>
              </div>
              
              <div className="file-not-found-help">
                <p><strong>Create New File:</strong> Creates a new empty SSH keys file at the current location</p>
                <p><strong>Select Existing File:</strong> Load keys from an existing ssh_kim.enc file</p>
                <p><strong>Choose New Location:</strong> Set a different path for the SSH keys file</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Enter Password</h2>
              <button onClick={() => {
                setShowPasswordModal(false);
                setPasswordModalError('');
                setPasswordModalPassword('');
              }}>×</button>
            </div>
            <div className="modal-content">
              {passwordModalError && (
                <div className="error-message">
                  {passwordModalError}
                </div>
              )}
              <div className="form-group">
                <label>Password for Import</label>
                <input
                  type="password"
                  value={passwordModalPassword}
                  onChange={(e) => {
                    setPasswordModalPassword(e.target.value);
                    if (passwordModalError) {
                      setPasswordModalError(''); // Clear error when user starts typing
                    }
                  }}
                  placeholder="Enter password for the selected file"
                  className="password-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordModalSubmit();
                    }
                  }}
                />
                <small className="file-help">
                  💡 Enter the password that was used to encrypt the selected file
                </small>
              </div>
              <div className="modal-footer">
                <button onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordModalError('');
                  setPasswordModalPassword('');
                }}>
                  Cancel
                </button>
                <button 
                  onClick={handlePasswordModalSubmit}
                  disabled={settingsLoading || !passwordModalPassword.trim()}
                  className="primary"
                >
                  {settingsLoading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Password Modal */}
      {showExportPasswordModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Set Export Password</h2>
              <button onClick={() => setShowExportPasswordModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Password for Export</label>
                <input
                  type="password"
                  value={exportPasswordModalPassword}
                  onChange={(e) => setExportPasswordModalPassword(e.target.value)}
                  placeholder="Enter password to encrypt the exported file"
                  className="password-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleExportPasswordModalSubmit();
                    }
                  }}
                />
                <small className="file-help">
                  💡 This password will be used to encrypt the exported file for secure transfer
                </small>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowExportPasswordModal(false)}>
                  Cancel
                </button>
                <button 
                  onClick={handleExportPasswordModalSubmit}
                  disabled={settingsLoading || !exportPasswordModalPassword.trim()}
                  className="primary"
                >
                  {settingsLoading ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
