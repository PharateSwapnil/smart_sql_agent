/**
 * JavaScript for SQL Agent page
 * Handles interactions with the AI agent, query generation, and execution
 */

let sqlEditor; // CodeMirror editor instance
let activeConnectionId = null;
let schemaCache = {}; // Cache schema information by connection ID

document.addEventListener('DOMContentLoaded', function() {
    // Initialize SQL editor
    initSqlEditor();
    
    // Initialize connection selector
    initConnectionSelector();
    
    // Initialize chat prompt form
    initPromptForm();
    
    // Initialize query execution
    initQueryExecution();
    
    // Initialize schema explorer
    initSchemaExplorer();
    
    // Check URL for connection_id parameter
    const urlParams = new URLSearchParams(window.location.search);
    const connectionId = urlParams.get('connection_id');
    
    if (connectionId) {
        const connectionSelect = document.getElementById('connection-select');
        if (connectionSelect) {
            connectionSelect.value = connectionId;
            connectionSelect.dispatchEvent(new Event('change'));
        }
    }
});

/**
 * Initialize CodeMirror SQL editor
 */
function initSqlEditor() {
    const editorElement = document.getElementById('sql-editor');
    
    if (editorElement) {
        sqlEditor = CodeMirror.fromTextArea(editorElement, {
            mode: 'text/x-sql',
            theme: 'dracula',
            lineNumbers: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentWithTabs: false,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            viewportMargin: Infinity,
            extraKeys: {
                'Ctrl-Enter': executeQuery,
                'Cmd-Enter': executeQuery,
                'Ctrl-Space': function() {
                    // This would be for autocomplete
                }
            }
        });
        
        // Make the editor responsive
        window.addEventListener('resize', function() {
            sqlEditor.refresh();
        });
    }
}

/**
 * Initialize connection selector dropdown
 */
function initConnectionSelector() {
    const connectionSelect = document.getElementById('connection-select');
    
    if (connectionSelect) {
        connectionSelect.addEventListener('change', function() {
            const connectionId = this.value;
            
            if (connectionId) {
                activeConnectionId = connectionId;
                
                // Load schema information if not cached
                if (!schemaCache[connectionId]) {
                    loadSchemaInfo(connectionId);
                } else {
                    displaySchemaInfo(schemaCache[connectionId]);
                }
                
                // Enable UI elements
                document.querySelectorAll('.connection-dependent').forEach(el => {
                    el.classList.remove('opacity-50', 'pointer-events-none');
                });
                
                // Add connection info to chat context
                const connectionName = connectionSelect.options[connectionSelect.selectedIndex].text;
                addSystemMessage(`Connected to database: ${connectionName}`);
            } else {
                activeConnectionId = null;
                
                // Disable UI elements
                document.querySelectorAll('.connection-dependent').forEach(el => {
                    el.classList.add('opacity-50', 'pointer-events-none');
                });
                
                // Clear schema display
                document.getElementById('schema-container').innerHTML = `
                    <div class="p-4 text-center text-gray-500">
                        <p>No database connection selected</p>
                    </div>
                `;
            }
        });
    }
}

/**
 * Initialize chat prompt form for natural language query generation
 */
function initPromptForm() {
    const promptForm = document.getElementById('prompt-form');
    
    if (promptForm) {
        promptForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const promptInput = document.getElementById('prompt-input');
            const prompt = promptInput.value.trim();
            
            if (prompt && activeConnectionId) {
                // Add user message to chat
                addUserMessage(prompt);
                
                // Clear input
                promptInput.value = '';
                
                // Show loading state
                addLoadingMessage();
                
                // Send prompt to API
                generateSql(prompt);
            }
        });
    }
}

/**
 * Initialize query execution button
 */
function initQueryExecution() {
    const executeButton = document.getElementById('execute-query-btn');
    
    if (executeButton) {
        executeButton.addEventListener('click', executeQuery);
    }
}

/**
 * Initialize schema explorer
 */
function initSchemaExplorer() {
    const schemaToggle = document.getElementById('schema-toggle');
    const schemaPanel = document.getElementById('schema-panel');
    
    if (schemaToggle && schemaPanel) {
        schemaToggle.addEventListener('click', function() {
            schemaPanel.classList.toggle('hidden');
            schemaToggle.classList.toggle('bg-primary-100');
            
            if (!schemaPanel.classList.contains('hidden')) {
                // Ensure schema is loaded
                if (activeConnectionId && !schemaCache[activeConnectionId]) {
                    loadSchemaInfo(activeConnectionId);
                }
            }
        });
    }
}

/**
 * Add a user message to the chat interface
 * @param {string} message - User message
 */
function addUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    
    if (chatMessages) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-end mb-4';
        messageElement.innerHTML = `
            <div class="bg-primary-100 text-gray-800 rounded-lg px-4 py-2 max-w-md">
                <p class="text-sm">${encodeHTML(message)}</p>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Add an AI message to the chat interface
 * @param {string} message - AI message
 * @param {boolean} isCode - Whether the message is code
 */
function addAiMessage(message, isCode = false) {
    const chatMessages = document.getElementById('chat-messages');
    const loadingMessage = document.querySelector('.ai-loading-message');
    
    if (chatMessages) {
        // Remove loading message if exists
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = 'flex mb-4';
        
        if (isCode) {
            messageElement.innerHTML = `
                <div class="bg-gray-800 text-white rounded-lg px-4 py-2 max-w-md">
                    <p class="text-xs text-gray-400 mb-1">Generated SQL Query:</p>
                    <pre class="text-sm overflow-x-auto"><code class="language-sql">${encodeHTML(message)}</code></pre>
                    <button class="mt-2 text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 use-sql-btn">
                        Use This Query
                    </button>
                </div>
            `;
            
            // Add event listener after the element is added to the DOM
            setTimeout(() => {
                const useButton = messageElement.querySelector('.use-sql-btn');
                if (useButton) {
                    useButton.addEventListener('click', function() {
                        if (sqlEditor) {
                            sqlEditor.setValue(message);
                            sqlEditor.focus();
                        }
                    });
                }
            }, 0);
        } else {
            messageElement.innerHTML = `
                <div class="bg-white border border-gray-200 shadow-sm rounded-lg px-4 py-2 max-w-md">
                    <p class="text-sm">${message}</p>
                </div>
            `;
        }
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Add a system message to the chat interface
 * @param {string} message - System message
 */
function addSystemMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    
    if (chatMessages) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-center mb-4';
        messageElement.innerHTML = `
            <div class="bg-gray-100 text-gray-600 text-xs rounded-full px-4 py-1">
                ${encodeHTML(message)}
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Add a loading message to indicate AI is thinking
 */
function addLoadingMessage() {
    const chatMessages = document.getElementById('chat-messages');
    
    if (chatMessages) {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex mb-4 ai-loading-message';
        messageElement.innerHTML = `
            <div class="bg-white border border-gray-200 shadow-sm rounded-lg px-4 py-2">
                <div class="flex items-center">
                    <div class="spinner mr-3"></div>
                    <p class="text-sm text-gray-600">Generating response...</p>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Generate SQL from natural language prompt
 * @param {string} prompt - Natural language prompt
 */
function generateSql(prompt) {
    if (!activeConnectionId) {
        showToast('Please select a database connection first', 'warning');
        return;
    }
    
    fetch('/api/generate-sql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            connection_id: activeConnectionId,
            prompt: prompt
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Add AI message with SQL code
            addAiMessage(data.sql, true);
            
            // Update SQL editor
            if (sqlEditor) {
                sqlEditor.setValue(data.sql);
            }
        } else {
            // Show error message
            addAiMessage(`Error generating SQL: ${data.message}`);
            showToast(`Error: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('SQL generation error:', error);
        addAiMessage('An error occurred while generating SQL. Please try again.');
        showToast('Error connecting to server', 'error');
    });
}

/**
 * Execute SQL query
 */
function executeQuery() {
    if (!activeConnectionId) {
        showToast('Please select a database connection first', 'warning');
        return;
    }
    
    const query = sqlEditor ? sqlEditor.getValue().trim() : '';
    
    if (!query) {
        showToast('Please enter a SQL query first', 'warning');
        return;
    }
    
    // Show loading state
    const resultsContainer = document.getElementById('query-results');
    resultsContainer.innerHTML = `
        <div class="flex items-center justify-center p-8">
            <div class="spinner mr-3"></div>
            <p>Executing query...</p>
        </div>
    `;
    
    // Execute query
    fetch('/api/run-query', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            connection_id: activeConnectionId,
            query: query
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Display query results with visualization and explanation if available
            displayQueryResults(
                data.columns, 
                data.data, 
                data.execution_time, 
                data.visualization, 
                data.explanation
            );
            
            // Show success message
            showToast(`Query executed successfully in ${data.execution_time.toFixed(2)}s`, 'success');
            
            // Add system message to chat
            addSystemMessage(`Query executed in ${data.execution_time.toFixed(2)} seconds`);
        } else {
            // Show error message
            resultsContainer.innerHTML = `
                <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    <p class="font-medium">Error executing query</p>
                    <p class="text-sm mt-1">${encodeHTML(data.message)}</p>
                </div>
            `;
            
            showToast(`Error: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('Query execution error:', error);
        
        resultsContainer.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <p class="font-medium">Error connecting to server</p>
                <p class="text-sm mt-1">Please try again later</p>
            </div>
        `;
        
        showToast('Error connecting to server', 'error');
    });
}

/**
 * Display query results in the results container
 * @param {Array} columns - Array of column names
 * @param {Array} data - Array of data rows
 * @param {number} executionTime - Query execution time in seconds
 * @param {string} visualization - Base64 encoded visualization image
 * @param {string} explanation - Text explanation of the data
 */
function displayQueryResults(columns, data, executionTime, visualization, explanation) {
    const resultsContainer = document.getElementById('query-results');
    
    if (resultsContainer) {
        // Create results header
        let html = `
            <div class="border-b border-gray-200 pb-2 mb-4 flex justify-between items-center">
                <h3 class="text-lg font-medium text-gray-900">Query Results</h3>
                <div class="text-sm text-gray-500">Executed in ${executionTime.toFixed(2)} seconds</div>
            </div>
        `;
        
        if (columns.length === 0 || data.length === 0) {
            // No results
            html += `
                <div class="text-center py-8 text-gray-500">
                    <p>Query executed successfully, but no results were returned.</p>
                </div>
            `;
        } else {
            // Create tabs for different views
            html += `
                <div class="border-b border-gray-200 mb-4">
                    <nav class="flex flex-wrap -mb-px">
                        <button id="tab-table" class="tab-button active mr-8 py-2 px-1 border-b-2 border-primary-500 font-medium text-sm text-primary-600">
                            <i data-feather="grid" class="h-4 w-4 mr-1 inline-block"></i> Table View
                        </button>
                        <button id="tab-visualization" class="tab-button mr-8 py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" ${!visualization ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <i data-feather="bar-chart-2" class="h-4 w-4 mr-1 inline-block"></i> Visualization
                        </button>
                        <button id="tab-explanation" class="tab-button py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300" ${!explanation ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <i data-feather="info" class="h-4 w-4 mr-1 inline-block"></i> Data Insights
                        </button>
                    </nav>
                </div>
                
                <!-- Table View Section -->
                <div id="view-table" class="tab-content active">
                    <div class="overflow-x-auto rounded-md border border-gray-200">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
            `;
            
            // Add column headers
            columns.forEach(column => {
                html += `<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${encodeHTML(column)}</th>`;
            });
            
            html += `
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
            `;
            
            // Add rows
            data.forEach((row, rowIndex) => {
                html += `<tr class="${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">`;
                
                row.forEach(cell => {
                    // Handle null values
                    const cellValue = cell === null ? '<span class="text-gray-400 italic">NULL</span>' : encodeHTML(String(cell));
                    html += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cellValue}</td>`;
                });
                
                html += '</tr>';
            });
            
            html += `
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-2 text-sm text-gray-500">
                        ${data.length} row${data.length !== 1 ? 's' : ''} returned
                    </div>
                </div>
                
                <!-- Visualization Section -->
                <div id="view-visualization" class="tab-content hidden">
                    ${visualization ? 
                        `<div class="flex justify-center p-4 bg-white border border-gray-200 rounded-md">
                            <img src="${visualization}" alt="Data Visualization" class="max-w-full max-h-[500px]" />
                        </div>` : 
                        `<div class="text-center py-8 text-gray-500">
                            <p>No visualization available for this query result.</p>
                        </div>`
                    }
                </div>
                
                <!-- Explanation Section -->
                <div id="view-explanation" class="tab-content hidden">
                    ${explanation ? 
                        `<div class="bg-white border border-gray-200 rounded-md p-4">
                            <h4 class="text-lg font-medium text-gray-900 mb-2">Data Analysis</h4>
                            <div class="text-gray-700 whitespace-pre-line">${explanation}</div>
                        </div>` : 
                        `<div class="text-center py-8 text-gray-500">
                            <p>No data insights available for this query result.</p>
                        </div>`
                    }
                </div>
            `;
        }
        
        resultsContainer.innerHTML = html;
        
        // Initialize Feather icons
        if (window.feather) {
            feather.replace();
        }
        
        // Add tab switching behavior
        const tabButtons = resultsContainer.querySelectorAll('.tab-button:not([disabled])');
        const tabContents = resultsContainer.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active state from all tabs
                tabButtons.forEach(btn => btn.classList.remove('active', 'border-primary-500', 'text-primary-600'));
                tabButtons.forEach(btn => btn.classList.add('border-transparent', 'text-gray-500'));
                tabContents.forEach(content => content.classList.add('hidden'));
                
                // Add active state to clicked tab
                this.classList.add('active', 'border-primary-500', 'text-primary-600');
                this.classList.remove('border-transparent', 'text-gray-500');
                
                // Show corresponding content
                const contentId = this.id.replace('tab-', 'view-');
                document.getElementById(contentId).classList.remove('hidden');
            });
        });
    }
}

/**
 * Load schema information for a database connection
 * @param {string} connectionId - Connection ID
 */
function loadSchemaInfo(connectionId) {
    const schemaContainer = document.getElementById('schema-container');
    
    if (schemaContainer) {
        // Show loading state
        schemaContainer.innerHTML = `
            <div class="flex items-center justify-center p-8">
                <div class="spinner mr-3"></div>
                <p>Loading schema...</p>
            </div>
        `;
        
        // Fetch schema information
        fetch(`/api/schema-info/${connectionId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Cache schema
                    schemaCache[connectionId] = data.schema;
                    
                    // Display schema
                    displaySchemaInfo(data.schema);
                } else {
                    schemaContainer.innerHTML = `
                        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            <p class="font-medium">Error loading schema</p>
                            <p class="text-sm mt-1">${encodeHTML(data.message)}</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Schema loading error:', error);
                
                schemaContainer.innerHTML = `
                    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        <p class="font-medium">Error connecting to server</p>
                        <p class="text-sm mt-1">Please try again later</p>
                    </div>
                `;
            });
    }
}

/**
 * Display schema information in the schema container
 * @param {Object} schema - Schema information
 */
function displaySchemaInfo(schema) {
    const schemaContainer = document.getElementById('schema-container');
    
    if (schemaContainer) {
        let html = '';
        
        // Process each database
        for (const dbName in schema) {
            html += `<h3 class="text-lg font-medium text-gray-900 mb-2">${encodeHTML(dbName)}</h3>`;
            
            // Process each table
            for (const tableName in schema[dbName]) {
                html += `
                    <div class="schema-table mb-4">
                        <div class="schema-table-header flex items-center">
                            <i data-feather="table" class="h-4 w-4 mr-2"></i>
                            <span>${encodeHTML(tableName)}</span>
                        </div>
                        <div class="px-3 py-2">
                `;
                
                // Process columns
                const columns = schema[dbName][tableName].columns || {};
                
                for (const columnName in columns) {
                    const column = columns[columnName];
                    
                    html += `
                        <div class="schema-column py-1">
                            <div>
                                <span class="font-medium">${encodeHTML(columnName)}</span>
                                <span class="text-gray-500 text-xs">${encodeHTML(column.type)}</span>
                                ${column.primary_key ? '<span class="primary-key-badge">PK</span>' : ''}
                                ${column.foreign_key ? `<span class="foreign-key-badge">FK</span>` : ''}
                            </div>
                            <div class="text-gray-400 text-xs">
                                ${column.nullable ? 'NULL' : 'NOT NULL'}
                            </div>
                        </div>
                    `;
                }
                
                html += `
                        </div>
                    </div>
                `;
            }
        }
        
        schemaContainer.innerHTML = html;
        
        // Initialize Feather icons in the schema
        if (window.feather) {
            feather.replace();
        }
    }
}
