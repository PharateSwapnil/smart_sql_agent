import os
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
import json
import os
from db_connection import DBConnection
import logging
from models import Connection, QueryHistory
from app import db
from smart_sql_agent import DBExpertAgent, get_memory_for_session, chat_router, get_query_hash

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
    recent_queries = QueryHistory.query.filter_by(
        user_id=current_user.id).order_by(
            QueryHistory.executed_at.desc()).limit(5).all()
    return render_template('dashboard.html',
                           connections=connections,
                           recent_queries=recent_queries)


@main.route('/chat', methods=['POST'])
@login_required
def chat():
    """Handle chat interactions with the AI agent."""
    data = request.get_json()
    user_input = data.get('message')
    connection_id = data.get('connection_id')
    session_id = f"user-{current_user.id}"

    if not user_input:
        return jsonify({'error': 'No message provided'}), 400

    # Get memory for session
    memory = get_memory_for_session(session_id)

    try:
        connection = Connection.query.filter_by(
            id=connection_id, user_id=current_user.id).first()
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404

        db_engine = DBConnection(
            db_type=connection.db_type,
            username=connection.username,
            password=connection.get_password(),
            host=connection.host,
            port=connection.port,
            database=os.path.normpath(
                connection.database),  # Normalize database path
            additional_params=json.loads(connection.additional_params))

        engine_result = db_engine.get_engine()

        if not engine_result['success']:
            return jsonify({
                'success': False,
                'message': engine_result['message']
            }), 500

        agent = DBExpertAgent(engine=db_engine)
        df_dict, response, visualize_flag = chat_router(
            user_input, agent, memory)

        # Save to query history if SQL was generated
        if df_dict:
            query_id = get_query_hash(user_input)
            query_history = QueryHistory(connection_id=connection_id,
                                         user_id=current_user.id,
                                         query_text=user_input,
                                         success=True)
            db.session.add(query_history)
            db.session.commit()

        # Format response for frontend
        if df_dict:
            return jsonify({
                'success': True,
                'response': response,
                'data': df_dict,
                'visualize': visualize_flag,
                'type': 'sql_result'
            })
        else:
            return jsonify({
                'success': True,
                'response': response,
                'type': 'text'
            })

    except Exception as e:
        logger.error(f"Error in chat route: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@main.route('/sql-agent')
@login_required
def sql_agent():
    """Render the AI-powered SQL Agent page."""
    connections = Connection.query.filter_by(user_id=current_user.id).all()

    # Create default SQLite connection if none exists
    if not connections:
        try:
            connection = Connection(name="Default Database",
                                    db_type="sqlite",
                                    database="ecommerce.db",
                                    user_id=current_user.id)
            db.session.add(connection)
            db.session.commit()
            connections = [connection]
            flash('Default database connection created', 'success')
        except Exception as e:
            logger.error(f"Error creating default connection: {str(e)}")
            flash(f'Error creating default connection: {str(e)}', 'error')

    return render_template('sqlAgent.html', connections=connections)


@main.route('/connection', methods=['GET', 'POST'])
@login_required
def connection():
    """Handle database connection management."""
    if request.method == 'POST':
        if request.headers.get('Content-Type') == 'application/json':
            data = request.get_json()
            try:
                # Convert additional_params to JSON string
                if 'additional_params' in data:
                    data['additional_params'] = json.dumps(
                        data['additional_params'])

                if data.get('id'):
                    # Update existing connection
                    connection = Connection.query.filter_by(
                        id=data.get('id'), user_id=current_user.id).first()
                    if not connection:
                        return jsonify({
                            'success': False,
                            'message': 'Connection not found'
                        }), 404
                    connection.update_from_dict(data)
                else:
                    # Create new connection
                    connection = Connection.create_from_dict(
                        data, current_user.id)
                    db.session.add(connection)

                db.session.commit()
                return jsonify({
                    'success': True,
                    'message': 'Connection saved successfully'
                })
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error saving connection: {str(e)}")
                return jsonify({'success': False, 'message': str(e)}), 500

    connections = Connection.query.filter_by(user_id=current_user.id).all()
    return render_template('connection.html', connections=connections)


@main.route('/connection/test', methods=['POST'])
@login_required
def test_db_connection():
    """Test database connection with provided credentials."""
    data = request.get_json()

    def test_connection(**kwargs):
        try:
            db_conn = DBConnection(**kwargs)
            result = db_conn.get_engine()
            if result and result.get("success"):
                return {"success": True, "message": result["message"]}
            return {
                "success": False,
                "error": "Could not establish connection"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    try:
        result = test_connection(db_type=data.get('db_type'),
                                 username=data.get('username'),
                                 password=data.get('password'),
                                 host=data.get('host'),
                                 port=data.get('port'),
                                 database=data.get('database'),
                                 additional_params=data.get(
                                     'additional_params', {}))

        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Connection successful!'
            })
        else:
            return jsonify({
                'success': False,
                'message': f"Connection failed: {result['error']}"
            })
    except Exception as e:
        logger.error(f"Error testing connection: {str(e)}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500


@main.route('/connection/<int:connection_id>/delete', methods=['POST'])
@login_required
def delete_connection(connection_id):
    """Delete a saved database connection."""
    connection = Connection.query.filter_by(id=connection_id,
                                            user_id=current_user.id).first()

    if not connection:
        return jsonify({
            'success': False,
            'message': 'Connection not found'
        }), 404

    try:
        db.session.delete(connection)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Connection deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting connection: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error deleting connection: {str(e)}'
        }), 500


@main.route('/api/generate-sql', methods=['POST'])
@login_required
def api_generate_sql():
    """Generate SQL based on natural language prompt."""
    data = request.get_json()
    connection_id = data.get('connection_id')
    prompt = data.get('prompt')
    session_id = f"user-{current_user.id}"
    print(session_id)
    # Get memory for session
    memory = get_memory_for_session(session_id)

    if not connection_id or not prompt:
        return jsonify({
            'success': False,
            'message': 'Missing connection_id or prompt'
        }), 400

    connection = Connection.query.filter_by(id=connection_id,
                                            user_id=current_user.id).first()
    if not connection:
        return jsonify({
            'success': False,
            'message': 'Connection not found'
        }), 404

    try:
        # Get AI-generated SQL
        db_engine = DBConnection(
            db_type=connection.db_type,
            username=connection.username,
            password=connection.get_password(),
            host=connection.host,
            port=connection.port,
            database=os.path.normpath(
                connection.database),  # Normalize database path
            additional_params=json.loads(connection.additional_params))
        engine_result = db_engine.get_engine()
        if not engine_result['success']:
            return jsonify({
                'success': False,
                'message': engine_result['message']
            }), 500
        agent = DBExpertAgent(engine=db_engine)
        sql_query = agent.generate_sql(prompt, memory)
        print(sql_query)
        return jsonify({'success': True, 'sql': sql_query})
    except Exception as e:
        logger.error(f"Error generating SQL: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error generating SQL: {str(e)}'
        }), 500


@main.route('/api/run-query', methods=['POST'])
@login_required
def api_run_query():
    """Execute SQL query on the selected database."""
    data = request.get_json()
    connection_id = data.get('connection_id')
    sql_query = data.get('query')

    if not connection_id or not sql_query:
        return jsonify({
            'success': False,
            'message': 'Missing connection_id or query'
        }), 400

    connection = Connection.query.filter_by(id=connection_id,
                                            user_id=current_user.id).first()
    if not connection:
        return jsonify({
            'success': False,
            'message': 'Connection not found'
        }), 404

    import time
    start_time = time.time()
    error_message = None

    try:
        # Run the query
        db_engine = DBConnection(
            db_type=connection.db_type,
            username=connection.username,
            password=connection.get_password(),
            host=connection.host,
            port=connection.port,
            database=os.path.normpath(
                connection.database),  # Normalize database path
            additional_params=json.loads(connection.additional_params))
        engine_result = db_engine.get_engine()
        if not engine_result['success']:
            return jsonify({
                'success': False,
                'message': engine_result['message']
            }), 500
        agent = DBExpertAgent(engine=db_engine)
        result = agent.run_query(sql_query)
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

        return jsonify({
            'success': False,
            'message': f'Error executing query: {error_message}'
        }), 500


@main.route('/api/schema-info/<int:connection_id>')
@login_required
def api_schema_info(connection_id):
    """Get schema information for a database connection."""
    connection = Connection.query.filter_by(id=connection_id,
                                            user_id=current_user.id).first()
    if not connection:
        return jsonify({
            'success': False,
            'message': 'Connection not found'
        }), 404

    try:
        db_engine = DBConnection(
            db_type=connection.db_type,
            username=connection.username,
            password=connection.get_password(),
            host=connection.host,
            port=connection.port,
            database=os.path.normpath(
                connection.database),  # Normalize database path
            additional_params=json.loads(connection.additional_params))
        engine_result = db_engine.get_engine()
        if not engine_result['success']:
            return jsonify({
                'success': False,
                'message': engine_result['message']
            }), 500
        agent = DBExpertAgent(engine=db_engine)
        schema = agent.schema_info
        return jsonify({'success': True, 'schema': schema})
    except Exception as e:
        logger.error(f"Error getting schema info: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error getting schema info: {str(e)}'
        }), 500
