from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from models import User
import logging

auth = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

@auth.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login."""
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
        
    if request.method == 'POST':
        if request.headers.get('Content-Type') == 'application/json':
            # Handle AJAX request
            data = request.get_json()
            email = data.get('email')
            password = data.get('password')
            remember = data.get('remember', False)
        else:
            # Handle form submission
            email = request.form.get('email')
            password = request.form.get('password')
            remember = 'remember' in request.form
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            if request.headers.get('Content-Type') == 'application/json':
                return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
            flash('Invalid email or password', 'danger')
            return render_template('login.html')
            
        login_user(user, remember=remember)
        next_page = request.args.get('next')
        
        if request.headers.get('Content-Type') == 'application/json':
            return jsonify({'success': True, 'redirect': next_page or url_for('main.dashboard')})
        return redirect(next_page or url_for('main.dashboard'))
        
    return render_template('login.html')


@auth.route('/register', methods=['GET', 'POST'])
def register():
    """Handle user registration."""
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
        
    if request.method == 'POST':
        if request.headers.get('Content-Type') == 'application/json':
            # Handle AJAX request
            data = request.get_json()
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
        else:
            # Handle form submission
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
        
        user_by_email = User.query.filter_by(email=email).first()
        user_by_username = User.query.filter_by(username=username).first()
        
        if user_by_email:
            if request.headers.get('Content-Type') == 'application/json':
                return jsonify({'success': False, 'message': 'Email already registered'}), 400
            flash('Email already registered', 'danger')
            return render_template('register.html')
            
        if user_by_username:
            if request.headers.get('Content-Type') == 'application/json':
                return jsonify({'success': False, 'message': 'Username already taken'}), 400
            flash('Username already taken', 'danger')
            return render_template('register.html')
            
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        
        try:
            db.session.add(new_user)
            db.session.commit()
            
            login_user(new_user)
            
            if request.headers.get('Content-Type') == 'application/json':
                return jsonify({'success': True, 'redirect': url_for('main.dashboard')})
            flash('Account created successfully!', 'success')
            return redirect(url_for('main.dashboard'))
        except Exception as e:
            logger.error(f"Error registering user: {str(e)}")
            db.session.rollback()
            if request.headers.get('Content-Type') == 'application/json':
                return jsonify({'success': False, 'message': 'Registration failed'}), 500
            flash('Registration failed. Please try again.', 'danger')
    
    return render_template('register.html')


@auth.route('/logout')
@login_required
def logout():
    """Handle user logout."""
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('main.index'))


@auth.route('/profile')
@login_required
def profile():
    """Display user profile."""
    return render_template('profile.html')
