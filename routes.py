from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
import json
import logging
import os
from models import Connection, QueryHistory
from app import db
from simplified_sql_agent import (
    get_sql_agent, generate_sql, run_sql_query, get_schema_info, test_connection
)
import time

main = Blueprint('main', __name__)
logger = logging.getLogger(__name__)

@main.route('/')
def index():
    """Render the landing page."""
    return render_template('index.html')

@main.route('/dashboard')
@login_required
def dashboard():
    """Render the main dashboard after login."""
    connections = Connection.query.filter_by(user_id=current_user.id).all()
    recent_queries = QueryHistory.query.filter_by(user_id=current_user.id).order_by(QueryHistory.executed_at.desc()).limit(5).all()
    return render_template('dashboard.html', connections=connections, recent_queries=recent_queries)

@main.route('/connection', methods=['GET', 'POST'])
@login_required
def connection():
    """Render the database connection management page."""
    if request.method == 'POST':
        if request.headers.get('Content-Type') == 'application/json':
            data = request.get_json()
            name = data.get('name')
            db_type = data.get('db_type')
            host = data.get('host')
            port = data.get('port')
            username = data.get('username')
            password = data.get('password')
            database = data.get('database')
            additional_params = json.dumps(data.get('additional_params', {}))
            
            # Create or update connection
            if data.get('id'):
                connection = Connection.query.filter_by(id=data.get('id'), user_id=current_user.id).first()
                if not connection:
                    return jsonify({'success': False, 'message': 'Connection not found'}), 404
                
                connection.name = name
                connection.db_type = db_type
                connection.host = host
                connection.port = port
                connection.username = username
                if password:  # Only update password if provided
                    connection.set_password(password)
                connection.database = database
                connection.additional_params = additional_params
            else:
                connection = Connection()
                connection.name = name
                connection.db_type = db_type
                connection.host = host
                connection.port = port
                connection.username = username
                connection.database = database
                connection.additional_params = additional_params
                connection.user_id = current_user.id
                if password:
                    connection.set_password(password)
                db.session.add(connection)
            
            try:
                db.session.commit()
                return jsonify({'success': True, 'message': 'Connection saved successfully'})
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error saving connection: {str(e)}")
                return jsonify({'success': False, 'message': f'Error saving connection: {str(e)}'}), 500
        else:
            # Handle form submission
            pass  # Similar to JSON handling but with form data
            
    connections = Connection.query.filter_by(user_id=current_user.id).all()
    return render_template('connection.html', connections=connections)

@main.route('/connection/test', methods=['POST'])
@login_required
def test_db_connection():
    """Test database connection with provided credentials."""
    data = request.get_json()
    
    try:
        result = test_connection(
            db_type=data.get('db_type'),
            username=data.get('username'),
            password=data.get('password'),
            host=data.get('host'),
            port=data.get('port'),
            database=data.get('database'),
            additional_params=data.get('additional_params', {})
        )
        
        if result['success']:
            return jsonify({'success': True, 'message': 'Connection successful!'})
        else:
            return jsonify({'success': False, 'message': f"Connection failed: {result['error']}"})
    except Exception as e:
        logger.error(f"Error testing connection: {str(e)}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@main.route('/connection/<int:connection_id>/delete', methods=['POST'])
@login_required
def delete_connection(connection_id):
    """Delete a saved database connection."""
    connection = Connection.query.filter_by(id=connection_id, user_id=current_user.id).first()
    
    if not connection:
        return jsonify({'success': False, 'message': 'Connection not found'}), 404
    
    try:
        db.session.delete(connection)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Connection deleted successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting connection: {str(e)}")
        return jsonify({'success': False, 'message': f'Error deleting connection: {str(e)}'}), 500

@main.route('/sql-agent')
@login_required
def sql_agent():
    """Render the AI-powered SQL Agent page."""
    # Check if the user has any connections
    connections = Connection.query.filter_by(user_id=current_user.id).all()
    
    # If no connections exist, create a default one for ecommerce.db
    if not connections:
        try:
            # Create default SQLite connection for ecommerce.db
            connection = Connection()
            connection.name = "Ecommerce Database"
            connection.db_type = "sqlite"
            connection.database = "ecommerce.db"  # Path to the SQLite database
            connection.user_id = current_user.id
            db.session.add(connection)
            db.session.commit()
            
            # Reload connections
            connections = Connection.query.filter_by(user_id=current_user.id).all()
            flash('Default ecommerce database connection created', 'success')
        except Exception as e:
            logger.error(f"Error creating default connection: {str(e)}")
            flash(f'Error creating default connection: {str(e)}', 'error')
    
    return render_template('sqlAgent.html', connections=connections)

@main.route('/api/generate-sql', methods=['POST'])
@login_required
def api_generate_sql():
    """Generate SQL based on natural language prompt."""
    data = request.get_json()
    connection_id = data.get('connection_id')
    prompt = data.get('prompt')
    
    if not connection_id or not prompt:
        return jsonify({'success': False, 'message': 'Missing connection_id or prompt'}), 400
    
    connection = Connection.query.filter_by(id=connection_id, user_id=current_user.id).first()
    if not connection:
        return jsonify({'success': False, 'message': 'Connection not found'}), 404
    
    try:
        # Get AI-generated SQL
        agent = get_sql_agent(connection)
        sql_query = generate_sql(agent, prompt, connection_id, current_user.id)
        
        return jsonify({
            'success': True, 
            'sql': sql_query
        })
    except Exception as e:
        logger.error(f"Error generating SQL: {str(e)}")
        return jsonify({'success': False, 'message': f'Error generating SQL: {str(e)}'}), 500

@main.route('/api/run-query', methods=['POST'])
@login_required
def api_run_query():
    """Execute SQL query on the selected database."""
    data = request.get_json()
    connection_id = data.get('connection_id')
    sql_query = data.get('query')
    
    if not connection_id or not sql_query:
        return jsonify({'success': False, 'message': 'Missing connection_id or query'}), 400
    
    connection = Connection.query.filter_by(id=connection_id, user_id=current_user.id).first()
    if not connection:
        return jsonify({'success': False, 'message': 'Connection not found'}), 404
    
    start_time = time.time()
    error_message = None
    
    try:
        # Run the query
        agent = get_sql_agent(connection)
        result = run_sql_query(agent, sql_query)
        execution_time = time.time() - start_time
        
        # Save query to history
        query_history = QueryHistory()
        query_history.connection_id = connection_id
        query_history.user_id = current_user.id
        query_history.query_text = sql_query
        query_history.execution_time = execution_time
        query_history.success = True
        db.session.add(query_history)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'columns': result.get('columns', []),
            'data': result.get('data', []),
            'visualization': result.get('visualization'),
            'explanation': result.get('explanation'),
            'execution_time': execution_time
        })
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error executing query: {error_message}")
        execution_time = time.time() - start_time
        
        # Save failed query to history
        query_history = QueryHistory()
        query_history.connection_id = connection_id
        query_history.user_id = current_user.id
        query_history.query_text = sql_query
        query_history.execution_time = execution_time
        query_history.success = False
        query_history.error_message = error_message
        db.session.add(query_history)
        db.session.commit()
        
        return jsonify({'success': False, 'message': f'Error executing query: {error_message}'}), 500

@main.route('/api/schema-info/<int:connection_id>')
@login_required
def api_schema_info(connection_id):
    """Get schema information for a database connection."""
    connection = Connection.query.filter_by(id=connection_id, user_id=current_user.id).first()
    if not connection:
        return jsonify({'success': False, 'message': 'Connection not found'}), 404
    
    try:
        agent = get_sql_agent(connection)
        schema = get_schema_info(agent)
        return jsonify({'success': True, 'schema': schema})
    except Exception as e:
        logger.error(f"Error getting schema info: {str(e)}")
        return jsonify({'success': False, 'message': f'Error getting schema info: {str(e)}'}), 500
