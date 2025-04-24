from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from app import db


class User(UserMixin, db.Model):
    """User model for authentication and profile management."""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    connections = db.relationship('Connection', backref='user', lazy=True)
    
    def set_password(self, password):
        """Set user password hash."""
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        """Check if provided password matches hash."""
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'


class Connection(db.Model):
    """Database connection settings model."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    db_type = db.Column(db.String(64), nullable=False)
    host = db.Column(db.String(256))
    port = db.Column(db.String(10))
    username = db.Column(db.String(64))
    password_hash = db.Column(db.String(256))
    database = db.Column(db.String(256))
    additional_params = db.Column(db.Text)  # Stored as JSON string
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime)
    
    def set_password(self, password):
        """Encrypt database password."""
        self.password_hash = generate_password_hash(password)
        
    def get_password(self):
        """Get database password (hashed value for security)."""
        return self.password_hash
    
    def __repr__(self):
        return f'<Connection {self.name} ({self.db_type})>'


class QueryHistory(db.Model):
    """Model to store user query history."""
    id = db.Column(db.Integer, primary_key=True)
    connection_id = db.Column(db.Integer, db.ForeignKey('connection.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    query_text = db.Column(db.Text, nullable=False)
    executed_at = db.Column(db.DateTime, default=datetime.utcnow)
    execution_time = db.Column(db.Float)  # Execution time in seconds
    success = db.Column(db.Boolean, default=True)
    error_message = db.Column(db.Text)
    
    connection = db.relationship('Connection', backref='queries')
    user = db.relationship('User', backref='query_history')
    
    def __repr__(self):
        return f'<QueryHistory {self.id} by {self.user_id}>'
