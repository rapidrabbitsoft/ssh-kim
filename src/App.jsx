import { useState, useEffect } from 'react';
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
  Check
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

  const loadKeys = async () => {
    try {
      setLoading(true);
      const result = await invoke('get_ssh_keys');
      console.log('Loaded keys:', result);
      console.log('Key IDs:', result.map(k => k.id));
      setKeys(result);
    } catch (error) {
      console.error('Failed to load keys:', error);
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Key size={32} />
            <h1>SSH Key Manager</h1>
          </div>
          <button className="add-button" onClick={openAddModal}>
            <Plus size={20} />
            Add Key
          </button>
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
      
      {keysFilePath && (
        <div className="file-path-info">
          <strong>Storage Location:</strong> {keysFilePath}
        </div>
      )}
    </div>
  );
}

export default App;
