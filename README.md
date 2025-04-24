# AI SQL Assistant - Developer Guide

This guide provides comprehensive information about the AI SQL Assistant application, its architecture, and how to modify or extend its functionality.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Backend Components](#backend-components)
4. [Frontend Components](#frontend-components)
5. [Database Models](#database-models)
6. [Authentication System](#authentication-system)
7. [API Endpoints](#api-endpoints)
8. [Smart SQL Agent Integration](#smart-sql-agent-integration)
9. [Database Connection Management](#database-connection-management)
10. [Common Modification Scenarios](#common-modification-scenarios)

## Project Overview

AI SQL Assistant is a modern, full-stack web application that serves as an alternative to tools like DBeaver, with enhanced AI-powered capabilities. It helps users manage database connections, generate optimized SQL queries using natural language, and analyze database schemas.

### Key Features

- User registration and authentication
- Secure database connection management
- AI-powered SQL query generation
- Interactive SQL editor with syntax highlighting
- Query execution and result visualization
- Database schema exploration

## Architecture

The application follows a standard Flask-based architecture with server-side rendering for most pages, with JavaScript enhancements for interactive features:

- **Backend**: Python Flask application with SQLAlchemy ORM for database interactions
- **Frontend**: HTML/CSS with JavaScript for interactive features
- **Authentication**: Flask-Login for user session management
- **AI Integration**: LangChain-based AI agent for SQL generation via mock implementations
- **Data Visualization**: Matplotlib for chart generation, rendered as base64 images

### High-Level Flow

1. User authenticates (registers/logs in)
2. User manages database connections
3. User interacts with AI SQL assistant to generate SQL queries
4. Queries are executed against the selected database
5. Results are displayed with tabular view, visualizations, and data insights

## Backend Components

The application backend consists of several key components:

### Main Application Files

- `main.py`: Application entry point
- `app.py`: Flask application setup and configuration
- `models.py`: SQLAlchemy database models
- `routes.py`: HTTP route handlers
- `auth.py`: Authentication-related routes
- `config.py`: Application configuration settings
- `db_connector.py`: Database connection management

### AI Agent Implementation

- `ai_agent.py`: Wrapper around the core AI functionality
- `attached_assets/smart_sql_agent.py`: Core AI agent implementation (production version)
- `attached_assets/db_connection.py`: Database connection handler (production version)
- `mock_agents.py`: Mock implementation for development/testing
- `mock_db_connection.py`: Mock database connections for development/testing

The application can run in either mode:
- **Production Mode**: Uses actual AI implementations from `attached_assets/` 
- **Mock Mode**: Uses `mock_agents.py` for simplified testing without external dependencies

### Visualization System

The visualization system has these components:

1. **Backend Generation**: `mock_agents.py` contains the `visualize_data()` method that uses Matplotlib to generate charts from query results
2. **Data Transport**: Visualizations are converted to base64 strings and passed to the frontend
3. **Frontend Display**: The SQL agent interface displays visualizations in a dedicated tab

### Data Insights

The data explanation functionality is implemented in:

1. **Backend Analysis**: `explain_data()` method in `mock_agents.py` analyzes query results
2. **Frontend Display**: Explanation text is displayed in a dedicated "Data Insights" tab

## Frontend Components

The frontend is built with a combination of HTML templates and JavaScript:

### Templates

- `templates/base.html`: Base layout template
- `templates/index.html`: Landing page
- `templates/login.html`: User login page
- `templates/register.html`: User registration page
- `templates/dashboard.html`: Main dashboard after login
- `templates/connection.html`: Database connection management
- `templates/sqlAgent.html`: AI SQL assistant interface

### JavaScript Files

- `static/js/main.js`: Common utilities and initialization
- `static/js/auth.js`: Authentication-related functionality
- `static/js/dbconnection.js`: Database connection management
- `static/js/sqlAgent.js`: AI SQL assistant interface
- `static/js/sqlEditor.js`: SQL editor configuration

### SQL Agent Interface

The SQL Agent interface in `static/js/sqlAgent.js` is the most complex part of the frontend, with these key components:

1. **Connection Selector**: Allows users to select from saved connections
2. **Chat Interface**: Allows natural language interaction with the AI
3. **SQL Editor**: CodeMirror-based editor for SQL queries
4. **Results Display**: Tabular view of query results
5. **Visualization Tab**: Displays charts generated from query results
6. **Data Insights Tab**: Shows analysis of the query results

## Database Models

The application uses three main database models defined in `models.py`:

### User Model

The `User` model represents application users and extends Flask-Login's `UserMixin`:

```python
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    connections = db.relationship('Connection', backref='user', lazy=True)
```

### Connection Model

The `Connection` model stores database connection settings:

```python
class Connection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    db_type = db.Column(db.String(64), nullable=False)
    host = db.Column(db.String(256))
    port = db.Column(db.String(10))
    username = db.Column(db.String(64))
    password_hash = db.Column(db.String(256))
    database = db.Column(db.String(256))
    additional_params = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime)
```

### QueryHistory Model

The `QueryHistory` model tracks executed queries for analytics and history:

```python
class QueryHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    connection_id = db.Column(db.Integer, db.ForeignKey('connection.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    query_text = db.Column(db.Text, nullable=False)
    executed_at = db.Column(db.DateTime, default=datetime.utcnow)
    execution_time = db.Column(db.Float)
    success = db.Column(db.Boolean, default=True)
    error_message = db.Column(db.Text)
```

## API Endpoints

The application provides several API endpoints:

### Authentication Endpoints

- `POST /login`: User login
- `POST /register`: User registration
- `GET /logout`: User logout

### Database Connection Endpoints

- `GET /connection`: View connections page
- `POST /connection`: Add new connection
- `PUT /connection/<id>`: Update connection
- `DELETE /connection/<id>`: Delete connection
- `POST /api/test-connection`: Test database connection

### SQL Agent Endpoints

- `GET /sql-agent`: SQL agent interface
- `POST /api/generate-sql`: Generate SQL from natural language
- `POST /api/run-query`: Execute SQL query
- `GET /api/schema-info/<connection_id>`: Get database schema

## Smart SQL Agent Integration

The AI SQL assistant is built around a DBExpertAgent class that provides several key features:

### Production Implementation

In production, the application uses `attached_assets/smart_sql_agent.py` which offers:

- Schema extraction and indexing
- Vector search for relevant context
- Memory for conversation history
- SQL generation via LLM
- Data visualization
- Explanation generation

### Mock Implementation

For development and testing, the application uses `mock_agents.py` which offers simplified versions of:

- Schema extraction (static sample data)
- SQL generation (pattern-based)
- Query execution (static sample data)
- Visualization (Matplotlib-based)
- Data explanation (structured text analysis)

## Common Modification Scenarios

### Adding a New Database Type

To add support for a new database type:

1. Update `mock_db_connection.py` and `attached_assets/db_connection.py` to handle the new connection type
2. Modify the connection form in `templates/connection.html` to include new fields
3. Update `static/js/dbconnection.js` to handle the UI for the new database type

### Enhancing Visualization Capabilities

To add new visualization types:

1. Extend the `visualize_data()` method in `mock_agents.py` to support new chart types
2. Update the frontend visualization tab in `static/js/sqlAgent.js` to handle new visualization types

### Adding AI Capabilities

To enhance the AI capabilities:

1. Extend the prompt templates in `attached_assets/smart_sql_agent.py`
2. Add new methods to `DBExpertAgent` class in either implementation
3. Update the API handlers in `routes.py` to expose the new capabilities
4. Add UI elements in `templates/sqlAgent.html` and `static/js/sqlAgent.js`

## Deployment Notes

The application is configured to run with:

- Flask web server (with gunicorn for production)
- SQLite database (ecommerce.db by default)
- Can be configured to use PostgreSQL via environment variables

Environment variables:

- `FLASK_APP`: Set to main.py
- `FLASK_ENV`: Set to development/production
- `DATABASE_URL`: Database connection string
- `SESSION_SECRET`: Secret key for sessions
- Various API keys for AI services (if using production mode)

## Custom Database Connection Example

The application has a special function to load the ecommerce.db:

```python
def get_ecommerce_db_connection():
    """
    Get a connection to the ecommerce.db SQLite database.
    
    Returns:
        DBConnection instance for ecommerce.db
    """
    try:
        # Create connection object for ecommerce.db
        db_path = os.path.abspath("ecommerce.db")
        logger.info(f"Connecting to ecommerce database at {db_path}")
        
        db_connection = DBConnection(
            db_type="sqlite",
            database=db_path
        )
        
        return db_connection
    except Exception as e:
        logger.error(f"Error creating ecommerce DB connection: {str(e)}")
        raise
```

This allows easy access to the demo database without requiring users to set up their own connections.
