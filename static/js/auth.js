/**
 * JavaScript for authentication pages
 * Handles form submission and validation for login and registration
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        initLoginForm(loginForm);
    }
    
    // Initialize registration form handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        initRegisterForm(registerForm);
    }
});

/**
 * Initialize the login form with validation and AJAX submission
 * @param {HTMLFormElement} form - The login form element
 */
function initLoginForm(form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;
        const remember = form.querySelector('#remember')?.checked || false;
        
        // Validate form
        let isValid = true;
        
        if (!email || !isValidEmail(email)) {
            showFieldError(form.querySelector('#email'), 'Please enter a valid email address');
            isValid = false;
        } else {
            clearFieldError(form.querySelector('#email'));
        }
        
        if (!password) {
            showFieldError(form.querySelector('#password'), 'Password is required');
            isValid = false;
        } else {
            clearFieldError(form.querySelector('#password'));
        }
        
        if (!isValid) return;
        
        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Logging in...';
        
        // Submit form using fetch API
        fetch(form.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password, remember })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Redirect to destination
                window.location.href = data.redirect || '/dashboard';
            } else {
                // Show error message
                showFormError(form, data.message || 'Invalid email or password');
                
                // Reset button state
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            showFormError(form, 'An error occurred. Please try again.');
            
            // Reset button state
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        });
    });
}

/**
 * Initialize the registration form with validation and AJAX submission
 * @param {HTMLFormElement} form - The registration form element
 */
function initRegisterForm(form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const username = form.querySelector('#username').value;
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;
        const confirmPassword = form.querySelector('#confirm-password').value;
        
        // Validate form
        let isValid = true;
        
        if (!username || username.length < 3) {
            showFieldError(form.querySelector('#username'), 'Username must be at least 3 characters');
            isValid = false;
        } else {
            clearFieldError(form.querySelector('#username'));
        }
        
        if (!email || !isValidEmail(email)) {
            showFieldError(form.querySelector('#email'), 'Please enter a valid email address');
            isValid = false;
        } else {
            clearFieldError(form.querySelector('#email'));
        }
        
        if (!password || password.length < 6) {
            showFieldError(form.querySelector('#password'), 'Password must be at least 6 characters');
            isValid = false;
        } else {
            clearFieldError(form.querySelector('#password'));
        }
        
        if (password !== confirmPassword) {
            showFieldError(form.querySelector('#confirm-password'), 'Passwords do not match');
            isValid = false;
        } else {
            clearFieldError(form.querySelector('#confirm-password'));
        }
        
        if (!isValid) return;
        
        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Registering...';
        
        // Submit form using fetch API
        fetch(form.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Redirect to destination
                window.location.href = data.redirect || '/dashboard';
            } else {
                // Show error message
                showFormError(form, data.message || 'Registration failed. Please try again.');
                
                // Reset button state
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        })
        .catch(error => {
            console.error('Registration error:', error);
            showFormError(form, 'An error occurred. Please try again.');
            
            // Reset button state
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        });
    });
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return regex.test(email);
}

/**
 * Show error message for a form field
 * @param {HTMLElement} field - Form field element
 * @param {string} message - Error message
 */
function showFieldError(field, message) {
    // Remove any existing error message
    clearFieldError(field);
    
    // Add error styling to input
    field.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    
    // Create and insert error message
    const errorElement = document.createElement('p');
    errorElement.className = 'mt-1 text-sm text-red-600 field-error';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
}

/**
 * Clear error message for a form field
 * @param {HTMLElement} field - Form field element
 */
function clearFieldError(field) {
    // Remove error styling
    field.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    
    // Remove error message if exists
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Show general form error message
 * @param {HTMLFormElement} form - Form element
 * @param {string} message - Error message
 */
function showFormError(form, message) {
    // Remove any existing form error
    clearFormError(form);
    
    // Create and insert error message
    const errorElement = document.createElement('div');
    errorElement.className = 'p-3 mt-3 mb-3 rounded-md bg-red-100 text-red-700 form-error';
    errorElement.textContent = message;
    
    form.insertBefore(errorElement, form.firstChild);
}

/**
 * Clear general form error message
 * @param {HTMLFormElement} form - Form element
 */
function clearFormError(form) {
    const errorElement = form.querySelector('.form-error');
    if (errorElement) {
        errorElement.remove();
    }
}
