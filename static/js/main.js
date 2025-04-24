/**
 * Main JavaScript file for common functionality across the AI SQL Assistant
 */

// Initialize common components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Feather icons
    if (window.feather) {
        feather.replace();
    }
    
    // Initialize mobile menu toggle
    initMobileMenu();
    
    // Initialize flash messages
    initFlashMessages();
    
    // Initialize tooltips
    initTooltips();
});

/**
 * Initialize mobile navigation menu
 */
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
}

/**
 * Initialize flash messages with auto-dismissal
 */
function initFlashMessages() {
    // Close button functionality
    document.querySelectorAll('.flash-close-btn').forEach(button => {
        button.addEventListener('click', function() {
            const message = this.closest('.flash-message');
            message.classList.add('fade-out');
            setTimeout(() => {
                message.remove();
            }, 300);
        });
    });
    
    // Auto-hide flash messages after 5 seconds
    setTimeout(function() {
        document.querySelectorAll('.flash-message').forEach(message => {
            message.classList.add('fade-out');
            setTimeout(() => {
                message.remove();
            }, 300);
        });
    }, 5000);
}

/**
 * Initialize tooltips for UI elements
 */
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltipText = this.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            
            tooltip.className = 'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 transition-opacity duration-300';
            tooltip.textContent = tooltipText;
            tooltip.style.bottom = 'calc(100% + 5px)';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            
            this.style.position = 'relative';
            this.appendChild(tooltip);
            
            // Show tooltip with a small delay
            setTimeout(() => {
                tooltip.classList.remove('opacity-0');
                tooltip.classList.add('opacity-100');
            }, 200);
        });
        
        element.addEventListener('mouseleave', function() {
            const tooltip = this.querySelector('div[class*="absolute z-50"]');
            if (tooltip) {
                tooltip.classList.remove('opacity-100');
                tooltip.classList.add('opacity-0');
                
                // Remove tooltip after fade animation
                setTimeout(() => {
                    tooltip.remove();
                }, 300);
            }
        });
    });
}

/**
 * Show a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Type of notification (success, error, info, warning)
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col space-y-2';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    
    // Set appropriate color based on type
    let bgColor, textColor, icon;
    switch (type) {
        case 'success':
            bgColor = 'bg-green-500';
            textColor = 'text-white';
            icon = 'check-circle';
            break;
        case 'error':
            bgColor = 'bg-red-500';
            textColor = 'text-white';
            icon = 'x-circle';
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            textColor = 'text-white';
            icon = 'alert-triangle';
            break;
        default:
            bgColor = 'bg-blue-500';
            textColor = 'text-white';
            icon = 'info';
    }
    
    // Set toast content
    toast.className = `${bgColor} ${textColor} px-4 py-3 rounded-md shadow-md flex items-center transform transition-all duration-300 ease-in-out translate-y-full opacity-0`;
    toast.innerHTML = `
        <i data-feather="${icon}" class="h-5 w-5 mr-2"></i>
        <span>${message}</span>
        <button class="ml-auto text-white" aria-label="Close">
            <i data-feather="x" class="h-4 w-4"></i>
        </button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Initialize Feather icons in the toast
    if (window.feather) {
        feather.replace();
    }
    
    // Show toast with animation
    setTimeout(() => {
        toast.classList.remove('translate-y-full', 'opacity-0');
    }, 10);
    
    // Set up close button
    const closeButton = toast.querySelector('button');
    closeButton.addEventListener('click', () => {
        removeToast(toast);
    });
    
    // Auto-remove after duration
    setTimeout(() => {
        removeToast(toast);
    }, duration);
}

/**
 * Remove a toast notification with animation
 * @param {HTMLElement} toast - The toast element to remove
 */
function removeToast(toast) {
    toast.classList.add('opacity-0', 'translate-y-full');
    
    toast.addEventListener('transitionend', () => {
        toast.remove();
        
        // Remove container if empty
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer && toastContainer.children.length === 0) {
            toastContainer.remove();
        }
    }, { once: true });
}

/**
 * Format a date string to a human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Generate a unique ID for elements
 * @returns {string} Unique ID
 */
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Safely encode HTML to prevent XSS
 * @param {string} str - String to encode
 * @returns {string} Encoded string
 */
function encodeHTML(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}
