/**
 * JavaScript for database connection management
 * Handles connection form, testing connections, and CRUD operations
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize modal open/close
    initConnectionModals();
    
    // Initialize connection form
    initConnectionForm();
    
    // Initialize database type selection behavior
    initDatabaseTypeSelect();
    
    // Initialize edit connection buttons
    initEditButtons();
    
    // Initialize delete connection buttons
    initDeleteButtons();
    
    // Get connection ID from URL if present (for editing)
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId) {
        loadConnectionData(editId);
        openConnectionModal('edit');
    }
});

/**
 * Initialize connection modals (add/edit and delete confirmation)
 */
function initConnectionModals() {
    // Add connection button
    const addButton = document.getElementById('add-connection-btn');
    if (addButton) {
        addButton.addEventListener('click', function() {
            openConnectionModal('add');
        });
    }
    
    // Cancel button
    const cancelButton = document.getElementById('cancel-btn');
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            closeConnectionModal();
        });
    }
    
    // Cancel delete button
    const cancelDeleteButton = document.getElementById('cancel-delete-btn');
    if (cancelDeleteButton) {
        cancelDeleteButton.addEventListener('click', function() {
            closeDeleteModal();
        });
    }
}

/**
 * Initialize connection form submission
 */
function initConnectionForm() {
    const form = document.getElementById('connection-form');
    const testButton = document.getElementById('test-connection-btn');
    
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                id: document.getElementById('connection-id').value,
                name: document.getElementById('name').value,
                db_type: document.getElementById('db_type').value,
                host: document.getElementById('host').value,
                port: document.getElementById('port').value,
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                database: document.getElementById('database').value,
                additional_params: {}
            };
            
            // Add additional parameters based on database type
            if (formData.db_type === 'snowflake') {
                formData.additional_params.warehouse = document.getElementById('warehouse').value;
                formData.additional_params.schema = document.getElementById('schema').value;
            } else if (formData.db_type === 'mssql') {
                formData.additional_params.driver = document.getElementById('driver').value;
            }
            
            // Submit form data
            saveConnection(formData);
        });
    }
    
    if (testButton) {
        testButton.addEventListener('click', function() {
            // Get form data for testing
            const formData = {
                db_type: document.getElementById('db_type').value,
                host: document.getElementById('host').value,
                port: document.getElementById('port').value,
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                database: document.getElementById('database').value,
                additional_params: {}
            };
            
            // Add additional parameters based on database type
            if (formData.db_type === 'snowflake') {
                formData.additional_params.warehouse = document.getElementById('warehouse').value;
                formData.additional_params.schema = document.getElementById('schema').value;
            } else if (formData.db_type === 'mssql') {
                formData.additional_params.driver = document.getElementById('driver').value;
            }
            
            // Test connection
            testConnection(formData);
        });
    }
}

/**
 * Initialize database type selection dropdown behavior
 * Shows/hides relevant fields based on selected database type
 */
function initDatabaseTypeSelect() {
    const dbTypeSelect = document.getElementById('db_type');
    
    if (dbTypeSelect) {
        dbTypeSelect.addEventListener('change', function() {
            updateFormFields(this.value);
        });
    }
}

/**
 * Initialize edit connection buttons
 */
function initEditButtons() {
    const editButtons = document.querySelectorAll('.edit-connection-btn');
    
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const connectionId = this.getAttribute('data-id');
            loadConnectionData(connectionId);
            openConnectionModal('edit');
        });
    });
}

/**
 * Initialize delete connection buttons
 */
function initDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.delete-connection-btn');
    const confirmDeleteButton = document.getElementById('confirm-delete-btn');
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const connectionId = this.getAttribute('data-id');
            confirmDeleteButton.setAttribute('data-id', connectionId);
            openDeleteModal();
        });
    });
    
    if (confirmDeleteButton) {
        confirmDeleteButton.addEventListener('click', function() {
            const connectionId = this.getAttribute('data-id');
            deleteConnection(connectionId);
        });
    }
}

/**
 * Update form fields based on selected database type
 * @param {string} dbType - Selected database type
 */
function updateFormFields(dbType) {
    // Reset all fields
    document.querySelectorAll('.db-field').forEach(field => {
        field.classList.remove('hidden');
    });
    
    document.getElementById('additional-params').classList.add('hidden');
    document.querySelectorAll('.snowflake-field, .mssql-field').forEach(field => {
        field.classList.add('hidden');
    });
    
    // Handle specific database types
    if (dbType === 'sqlite') {
        // SQLite only needs a file path
        document.getElementById('host-field').classList.add('hidden');
        document.getElementById('port-field').classList.add('hidden');
        document.getElementById('username-field').classList.add('hidden');
        document.getElementById('password-field').classList.add('hidden');
    } else if (dbType === 'snowflake') {
        // Show Snowflake specific fields
        document.getElementById('additional-params').classList.remove('hidden');
        document.querySelectorAll('.snowflake-field').forEach(field => {
            field.classList.remove('hidden');
        });
    } else if (dbType === 'mssql') {
        // Show MSSQL specific fields
        document.getElementById('additional-params').classList.remove('hidden');
        document.querySelectorAll('.mssql-field').forEach(field => {
            field.classList.remove('hidden');
        });
    }
}

/**
 * Open connection modal for adding or editing
 * @param {string} mode - 'add' or 'edit'
 */
function openConnectionModal(mode) {
    const modal = document.getElementById('connection-modal');
    const modalTitle = document.getElementById('modal-title');
    
    if (modal) {
        modal.classList.remove('hidden');
        
        if (mode === 'add') {
            modalTitle.textContent = 'Add Database Connection';
            
            // Clear form
            document.getElementById('connection-form').reset();
            document.getElementById('connection-id').value = '';
            
            // Reset database type fields
            updateFormFields(document.getElementById('db_type').value);
        } else {
            modalTitle.textContent = 'Edit Database Connection';
        }
    }
}

/**
 * Close connection modal
 */
function closeConnectionModal() {
    const modal = document.getElementById('connection-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Open delete confirmation modal
 */
function openDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Close delete confirmation modal
 */
function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Load connection data for editing
 * @param {string} connectionId - ID of connection to edit
 */
function loadConnectionData(connectionId) {
    // Find connection data in page
    const editButton = document.querySelector(`.edit-connection-btn[data-id="${connectionId}"]`);
    
    if (editButton) {
        const listItem = editButton.closest('li');
        const nameElement = listItem.querySelector('.text-gray-900');
        const typeElement = listItem.querySelector('.text-gray-500');
        const detailsElement = listItem.querySelector('.text-gray-400');
        
        if (nameElement && typeElement) {
            // Set basic fields
            document.getElementById('connection-id').value = connectionId;
            document.getElementById('name').value = nameElement.textContent.trim();
            document.getElementById('db_type').value = typeElement.textContent.trim();
            
            // Parse connection string
            let connectionString = '';
            if (detailsElement) {
                connectionString = detailsElement.textContent.trim();
            }
            
            // Extract host, port, database if present
            if (connectionString.includes('/')) {
                const parts = connectionString.split('/');
                const dbName = parts[parts.length - 1].trim();
                document.getElementById('database').value = dbName;
                
                if (parts[0].includes(':')) {
                    const hostPort = parts[0].split(':');
                    document.getElementById('host').value = hostPort[0].trim();
                    document.getElementById('port').value = hostPort[1].trim();
                } else {
                    document.getElementById('host').value = parts[0].trim();
                }
            }
            
            // Update form fields based on database type
            updateFormFields(document.getElementById('db_type').value);
        }
    }
}

/**
 * Test database connection
 * @param {Object} connectionData - Connection data to test
 */
function testConnection(connectionData) {
    // Show loading state
    const testButton = document.getElementById('test-connection-btn');
    const originalButtonText = testButton.textContent;
    testButton.disabled = true;
    testButton.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Testing...';
    
    // Submit test request
    fetch('/connection/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(connectionData)
    })
    .then(response => response.json())
    .then(data => {
        // Reset button state
        testButton.disabled = false;
        testButton.textContent = originalButtonText;
        
        // Show result
        if (data.success) {
            showToast('Connection successful!', 'success');
        } else {
            showToast(`Connection failed: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('Test connection error:', error);
        
        // Reset button state
        testButton.disabled = false;
        testButton.textContent = originalButtonText;
        
        // Show error
        showToast('Error testing connection. Please try again.', 'error');
    });
}

/**
 * Save database connection
 * @param {Object} connectionData - Connection data to save
 */
function saveConnection(connectionData) {
    // Show loading state
    const saveButton = document.querySelector('#connection-form button[type="submit"]');
    const originalButtonText = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Saving...';
    
    // Submit save request
    fetch('/connection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(connectionData)
    })
    .then(response => response.json())
    .then(data => {
        // Reset button state
        saveButton.disabled = false;
        saveButton.textContent = originalButtonText;
        
        // Show result
        if (data.success) {
            showToast('Connection saved successfully!', 'success');
            closeConnectionModal();
            
            // Reload the page to show the updated connection list
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showToast(`Save failed: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('Save connection error:', error);
        
        // Reset button state
        saveButton.disabled = false;
        saveButton.textContent = originalButtonText;
        
        // Show error
        showToast('Error saving connection. Please try again.', 'error');
    });
}

/**
 * Delete database connection
 * @param {string} connectionId - ID of connection to delete
 */
function deleteConnection(connectionId) {
    // Show loading state
    const deleteButton = document.getElementById('confirm-delete-btn');
    const originalButtonText = deleteButton.textContent;
    deleteButton.disabled = true;
    deleteButton.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Deleting...';
    
    // Submit delete request
    fetch(`/connection/${connectionId}/delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        // Reset button state
        deleteButton.disabled = false;
        deleteButton.textContent = originalButtonText;
        
        // Show result
        if (data.success) {
            showToast('Connection deleted successfully!', 'success');
            closeDeleteModal();
            
            // Remove the connection from the DOM
            const connectionElement = document.querySelector(`.delete-connection-btn[data-id="${connectionId}"]`).closest('li');
            if (connectionElement) {
                connectionElement.remove();
            }
            
            // If no connections left, show empty state
            const connectionList = document.querySelector('#connection-list ul');
            if (connectionList && connectionList.children.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'px-4 py-5 sm:p-6 text-center';
                emptyState.innerHTML = `
                    <p class="text-gray-500">No database connections found.</p>
                    <p class="mt-1 text-sm text-gray-500">
                        Add your first database connection to get started.
                    </p>
                `;
                
                connectionList.parentNode.innerHTML = '';
                connectionList.parentNode.appendChild(emptyState);
            }
        } else {
            showToast(`Delete failed: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('Delete connection error:', error);
        
        // Reset button state
        deleteButton.disabled = false;
        deleteButton.textContent = originalButtonText;
        
        // Show error
        showToast('Error deleting connection. Please try again.', 'error');
    });
}
