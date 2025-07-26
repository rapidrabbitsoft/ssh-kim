// SSH Kim - Comprehensive Test Suite
// This file contains tests for all major functionality
// Run individual test functions in the browser console when the app is running

// ============================================================================
// CORE FUNCTIONALITY TESTS
// ============================================================================

async function testCoreCommands() {
  try {
    console.log('🧪 Testing Core Commands...');
    
    // Test 1: Get current keys
    console.log('\n1. Testing get_ssh_keys...');
    const keys = await window.__TAURI__.invoke('get_ssh_keys');
    console.log('✅ Current keys count:', keys.length);
    
    // Test 2: Get file location
    console.log('\n2. Testing get_keys_file_location...');
    const filePath = await window.__TAURI__.invoke('get_keys_file_location');
    console.log('✅ Current file path:', filePath);
    
    // Test 3: Verify default path
    if (filePath.includes('.ssh-kim/keys.enc')) {
      console.log('✅ Default file path is correctly set to ~/.ssh-kim/keys.enc');
    } else {
      console.log('❌ Default file path is not in expected location');
    }
    
    console.log('\n🎉 Core commands test completed successfully!');
    
  } catch (error) {
    console.error('❌ Core commands test failed:', error);
  }
}

// ============================================================================
// EXPORT/IMPORT FUNCTIONALITY TESTS
// ============================================================================

async function testExportImportFunctionality() {
  try {
    console.log('🧪 Testing Export/Import Functionality...');
    
    // Test 1: Get current keys
    console.log('\n1. Getting current keys...');
    const currentKeys = await window.__TAURI__.invoke('get_ssh_keys');
    console.log('✅ Current keys count:', currentKeys.length);
    
    // Test 2: Export keys to a test file
    console.log('\n2. Exporting keys to test file...');
    const testExportPath = '/tmp/test_export_import.enc';
    await window.__TAURI__.invoke('export_keys_to_file', { filePath: testExportPath });
    console.log('✅ Exported keys to:', testExportPath);
    
    // Test 3: Load keys from the test file
    console.log('\n3. Testing load_keys_from_file...');
    const loadedKeys = await window.__TAURI__.invoke('load_keys_from_file', { filePath: testExportPath });
    console.log('✅ Successfully loaded keys:', loadedKeys.length);
    
    // Test 4: Verify the keys are now in the app
    console.log('\n4. Verifying keys are loaded in app...');
    const appKeys = await window.__TAURI__.invoke('get_ssh_keys');
    console.log('✅ App now has keys:', appKeys.length);
    
    console.log('\n🎉 Export/Import test completed successfully!');
    
  } catch (error) {
    console.error('❌ Export/Import test failed:', error);
  }
}

// ============================================================================
// PASSWORD-PROTECTED EXPORT/IMPORT TESTS
// ============================================================================

async function testPasswordProtectedExportImport() {
  try {
    console.log('🧪 Testing Password-Protected Export/Import...');
    
    // Test 1: Get current keys
    console.log('\n1. Getting current keys...');
    const currentKeys = await window.__TAURI__.invoke('get_ssh_keys');
    console.log('✅ Current keys count:', currentKeys.length);
    
    // Test 2: Export with password protection
    console.log('\n2. Exporting with password protection...');
    const testExportPath = '/tmp/test_password_protected.enc';
    const testPassword = 'test123';
    await window.__TAURI__.invoke('export_keys_with_password', { 
      filePath: testExportPath, 
      password: testPassword 
    });
    console.log('✅ Exported with password to:', testExportPath);
    
    // Test 3: Import with password protection
    console.log('\n3. Importing with password protection...');
    const importResult = await window.__TAURI__.invoke('import_keys_with_password', { 
      filePath: testExportPath, 
      password: testPassword 
    });
    console.log('✅ Import result:', {
      keys: importResult.keys.length,
      imported: importResult.imported_count,
      duplicates: importResult.duplicate_count,
      total: importResult.total_in_store
    });
    
    console.log('\n🎉 Password-protected test completed successfully!');
    
  } catch (error) {
    console.error('❌ Password-protected test failed:', error);
  }
}

// ============================================================================
// FILE DIALOG TESTS
// ============================================================================

async function testFileDialogs() {
  try {
    console.log('🧪 Testing File Dialogs...');
    
    // Test 1: Open file dialog
    console.log('\n1. Testing open_file_dialog...');
    const filePath = await window.__TAURI__.invoke('open_file_dialog');
    console.log('✅ File dialog result:', filePath || 'No file selected');
    
    // Test 2: Save file dialog
    console.log('\n2. Testing open_save_dialog...');
    const savePath = await window.__TAURI__.invoke('open_save_dialog');
    console.log('✅ Save dialog result:', savePath || 'No path selected');
    
    console.log('\n🎉 File dialog test completed successfully!');
    
  } catch (error) {
    console.error('❌ File dialog test failed:', error);
  }
}

// ============================================================================
// KEY MANAGEMENT TESTS
// ============================================================================

async function testKeyManagement() {
  try {
    console.log('🧪 Testing Key Management...');
    
    // Test 1: Add a test key
    console.log('\n1. Adding test key...');
    const testKey = {
      name: 'Test Key',
      tag: 'test',
      keyContent: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC... test@example.com'
    };
    const newKey = await window.__TAURI__.invoke('add_ssh_key', testKey);
    console.log('✅ Added test key:', newKey.id);
    
    // Test 2: Update the key
    console.log('\n2. Updating test key...');
    const updateData = {
      name: 'Updated Test Key',
      tag: 'updated-test'
    };
    const updatedKey = await window.__TAURI__.invoke('update_ssh_key', {
      id: newKey.id,
      update: updateData
    });
    console.log('✅ Updated key:', updatedKey.name);
    
    // Test 3: Delete the test key
    console.log('\n3. Deleting test key...');
    await window.__TAURI__.invoke('remove_ssh_key', { id: newKey.id });
    console.log('✅ Deleted test key');
    
    console.log('\n🎉 Key management test completed successfully!');
    
  } catch (error) {
    console.error('❌ Key management test failed:', error);
  }
}

// ============================================================================
// COMPREHENSIVE TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting SSH Kim Comprehensive Test Suite...\n');
  
  await testCoreCommands();
  await testExportImportFunctionality();
  await testPasswordProtectedExportImport();
  await testFileDialogs();
  await testKeyManagement();
  
  console.log('\n🎉 All tests completed!');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showTestMenu() {
  console.log(`
🧪 SSH Kim Test Suite
=====================

Available Tests:
1. testCoreCommands() - Test basic functionality
2. testExportImportFunctionality() - Test file export/import
3. testPasswordProtectedExportImport() - Test password-protected export/import
4. testFileDialogs() - Test file dialogs
5. testKeyManagement() - Test key CRUD operations
6. runAllTests() - Run all tests

Usage: Call any function in the browser console when the app is running.
Example: testCoreCommands()
  `);
}

// Show menu when file is loaded
showTestMenu(); 