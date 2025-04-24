/**
 * JavaScript for SQL Editor functionality
 * Provides advanced features for the CodeMirror SQL editor
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize any standalone SQL editors (outside of SQL Agent page)
    initializeStandaloneEditors();
});

/**
 * Initialize standalone SQL editors
 * These are editors that are not part of the SQL Agent page
 */
function initializeStandaloneEditors() {
    const editorElements = document.querySelectorAll('.sql-editor:not(#sql-editor)');
    
    editorElements.forEach((editorElement, index) => {
        const editorId = editorElement.id || `sql-editor-${index}`;
        
        const editor = CodeMirror.fromTextArea(editorElement, {
            mode: 'text/x-sql',
            theme: 'dracula',
            lineNumbers: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentWithTabs: false,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            viewportMargin: Infinity
        });
        
        // Store editor instance for access from other scripts
        window[editorId] = editor;
        
        // Make the editor responsive
        window.addEventListener('resize', function() {
            editor.refresh();
        });
    });
}

/**
 * Format SQL query using indentation rules
 * @param {string} sql - SQL query to format
 * @returns {string} Formatted SQL query
 */
function formatSql(sql) {
    // Simple SQL formatter that capitalizes keywords and adds line breaks
    // For a production app, consider using a dedicated SQL formatter library
    
    // Convert to uppercase for keywords
    const keywords = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
        'OUTER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
        'UNION', 'UNION ALL', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
        'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
        'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW',
        'CREATE PROCEDURE', 'DROP PROCEDURE', 'CREATE FUNCTION', 'DROP FUNCTION',
        'BEGIN', 'END', 'DECLARE', 'AS', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
        'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL', 'ASC', 'DESC', 'DISTINCT',
        'WITH'
    ];
    
    let formattedSql = sql;
    
    // Replace keywords with uppercase versions
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        formattedSql = formattedSql.replace(regex, keyword);
    });
    
    // Add line breaks after commas in SELECT clauses
    formattedSql = formattedSql.replace(/,(\s*)(?![^(]*\))/g, ',\n  ');
    
    // Add line breaks and indentation after specific keywords
    keywords.forEach(keyword => {
        if (['AND', 'OR'].includes(keyword)) {
            // For AND and OR, just add space
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            formattedSql = formattedSql.replace(regex, `\n  ${keyword}`);
        } else if (['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT'].includes(keyword)) {
            // For major clauses, add line break
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            formattedSql = formattedSql.replace(regex, `\n${keyword}`);
        } else if (keyword.includes('JOIN')) {
            // For JOIN clauses, add line break and indentation
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            formattedSql = formattedSql.replace(regex, `\n  ${keyword}`);
        }
    });
    
    return formattedSql.trim();
}

/**
 * Apply SQL formatter to a CodeMirror editor instance
 * @param {CodeMirror} editor - CodeMirror editor instance
 */
function formatEditorSql(editor) {
    if (editor) {
        const currentSql = editor.getValue();
        const formattedSql = formatSql(currentSql);
        
        // Preserve cursor position
        const cursor = editor.getCursor();
        
        // Set formatted SQL
        editor.setValue(formattedSql);
        
        // Try to restore cursor position approximately
        editor.setCursor(cursor);
    }
}

/**
 * Add auto-complete functionality for SQL keywords and schema objects
 * @param {CodeMirror} editor - CodeMirror editor instance
 * @param {Array} schemaObjects - Schema objects for auto-completion
 */
function enableSqlAutoComplete(editor, schemaObjects = []) {
    if (!editor) return;
    
    // SQL keywords for auto-completion
    const sqlKeywords = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
        'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
        'UNION', 'UNION ALL', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
        'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
        'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW',
        'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
        'ASC', 'DESC', 'DISTINCT', 'WITH', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'UPPER', 'LOWER', 'TRIM', 'SUBSTR'
    ];
    
    // Auto-complete function
    const sqlHint = function(editor) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const word = line.slice(0, cursor.ch).match(/[a-zA-Z0-9_\.]*$/)[0];
        
        // Combine SQL keywords and schema objects
        const allOptions = [...sqlKeywords, ...schemaObjects];
        
        const completions = {
            list: allOptions
                .filter(opt => opt.toUpperCase().includes(word.toUpperCase()))
                .map(opt => ({
                    text: opt,
                    displayText: opt,
                    className: sqlKeywords.includes(opt) ? 'sql-keyword' : 'sql-schema'
                })),
            from: CodeMirror.Pos(cursor.line, cursor.ch - word.length),
            to: cursor
        };
        
        return completions;
    };
    
    // Add auto-complete key mapping (Ctrl+Space)
    editor.setOption('extraKeys', {
        'Ctrl-Space': function(cm) {
            CodeMirror.showHint(cm, sqlHint);
        }
    });
}

/**
 * Check SQL syntax for basic errors
 * @param {string} sql - SQL query to check
 * @returns {Object} Result with error information if any
 */
function checkSqlSyntax(sql) {
    // This is a simple syntax checker for common SQL issues
    // For production, consider using a dedicated SQL parser library
    
    const result = {
        valid: true,
        errors: []
    };
    
    // Check for unbalanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
        result.valid = false;
        result.errors.push('Unbalanced parentheses');
    }
    
    // Check for unclosed quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
        result.valid = false;
        result.errors.push('Unclosed single quotes');
    }
    
    const doubleQuotes = (sql.match(/"/g) || []).length;
    if (doubleQuotes % 2 !== 0) {
        result.valid = false;
        result.errors.push('Unclosed double quotes');
    }
    
    // Check for common SQL syntax issues
    if (sql.includes('SELECT') && !sql.includes('FROM') && !sql.includes('SELECT 1')) {
        result.valid = false;
        result.errors.push('SELECT statement missing FROM clause');
    }
    
    if (sql.includes('JOIN') && !sql.includes('ON') && !sql.includes('USING')) {
        result.valid = false;
        result.errors.push('JOIN statement missing ON or USING clause');
    }
    
    return result;
}

/**
 * Add syntax checking for a CodeMirror editor instance
 * @param {CodeMirror} editor - CodeMirror editor instance
 */
function enableSqlSyntaxChecking(editor) {
    if (!editor) return;
    
    // Check syntax when content changes
    editor.on('change', function() {
        const sql = editor.getValue();
        const result = checkSqlSyntax(sql);
        
        // Clear existing error markers
        editor.clearGutter('error-gutter');
        
        if (!result.valid) {
            // Mark the first line with an error indicator
            const marker = document.createElement('div');
            marker.className = 'text-red-500';
            marker.innerHTML = '<i data-feather="alert-circle"></i>';
            marker.title = result.errors.join('\n');
            
            editor.setGutterMarker(0, 'error-gutter', marker);
            
            // Initialize Feather icons in the gutter
            if (window.feather) {
                feather.replace();
            }
        }
    });
}
