// Sheriff Manfred Mainke Website - JavaScript

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const navHeight = document.querySelector('.main-nav').offsetHeight;
            const targetPosition = targetElement.offsetTop - navHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
            
            // Update active navigation
            updateActiveNav(this);
        }
    });
});

// Update active navigation item
function updateActiveNav(clickedLink) {
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
    });
    clickedLink.classList.add('active');
}

// Navigation active state on scroll
window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('section[id]');
    const navHeight = document.querySelector('.main-nav').offsetHeight;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - navHeight - 100;
        const sectionHeight = section.clientHeight;
        
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });
    
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Contact Form Handler
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(contactForm);
        const name = contactForm.querySelector('input[type="text"]').value;
        
        // Show success message
        showNotification(
            `Vielen Dank, ${name}! Ihre Nachricht wurde empfangen. Das Sheriff's Department wird sich in Kürze bei Ihnen melden.`,
            'success'
        );
        
        // Reset form
        contactForm.reset();
    });
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✓' : 'ℹ'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #1a3a52;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
        }
        
        .notification-success {
            background-color: #2d7a2d;
            border-left: 5px solid #c9a961;
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .notification-icon {
            font-size: 1.5rem;
            font-weight: bold;
        }
        
        .notification-message {
            flex-grow: 1;
            line-height: 1.5;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.3s ease;
        }
        
        .notification-close:hover {
            background-color: rgba(255,255,255,0.2);
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        
        @media (max-width: 768px) {
            .notification {
                right: 10px;
                left: 10px;
                max-width: none;
            }
        }
    `;
    
    if (!document.querySelector('style[data-notification-styles]')) {
        style.setAttribute('data-notification-styles', '');
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Close button handler
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Add parallax effect to hero section
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (hero) {
        const scrolled = window.scrollY;
        hero.style.backgroundPositionY = `${scrolled * 0.5}px`;
    }
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards and sections
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll(
        '.department-card, .service-item, .contact-card, .sheriff-profile'
    );
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });
});

// Emergency alert rotation
const alerts = [
    'WICHTIGE MITTEILUNG: Bleiben Sie wachsam und melden Sie verdächtige Aktivitäten',
    'COMMUNITY WATCH: Gemeinsam für eine sichere Nachbarschaft',
    'CRIME PREVENTION: Sichern Sie Ihr Eigentum - Schließen Sie Türen und Fenster',
    'SAFETY FIRST: Bei Notfällen wählen Sie immer 911'
];

let currentAlertIndex = 0;

function rotateAlert() {
    const alertContent = document.querySelector('.alert-content span:last-child');
    if (alertContent) {
        alertContent.style.opacity = '0';
        setTimeout(() => {
            currentAlertIndex = (currentAlertIndex + 1) % alerts.length;
            alertContent.textContent = alerts[currentAlertIndex];
            alertContent.style.opacity = '1';
        }, 500);
    }
}

// Rotate alerts every 8 seconds
setInterval(rotateAlert, 8000);

// Add fade transition to alert text
const alertSpan = document.querySelector('.alert-content span:last-child');
if (alertSpan) {
    alertSpan.style.transition = 'opacity 0.5s ease';
}

// Enhanced star badge animation on hover
const star = document.querySelector('.texas-star');
if (star) {
    star.addEventListener('mouseenter', () => {
        star.style.transform = 'rotate(360deg) scale(1.1)';
        star.style.transition = 'transform 0.6s ease';
    });
    
    star.addEventListener('mouseleave', () => {
        star.style.transform = 'rotate(0deg) scale(1)';
    });
}

// Print statistics counter animation
function animateCounters() {
    const stats = document.querySelectorAll('.stat-number');
    
    stats.forEach(stat => {
        const text = stat.textContent;
        const hasPlus = text.includes('+');
        const number = parseInt(text);
        
        if (!isNaN(number)) {
            let current = 0;
            const increment = number / 50;
            const timer = setInterval(() => {
                current += increment;
                if (current >= number) {
                    stat.textContent = hasPlus ? `${number}+` : number;
                    clearInterval(timer);
                } else {
                    stat.textContent = Math.floor(current);
                }
            }, 30);
        }
    });
}

// Trigger counter animation when sheriff section is visible
const sheriffSection = document.querySelector('.sheriff-section');
if (sheriffSection) {
    const sheriffObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
                sheriffObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    
    sheriffObserver.observe(sheriffSection);
}

// Console Easter Egg
console.log('%c👮 Sheriff Manfred Mainke\'s Department', 'font-size: 20px; font-weight: bold; color: #1a3a52;');
console.log('%c🌟 Serving with Honor, Protecting with Pride', 'font-size: 14px; color: #c9a961;');
console.log('%cFür Notfälle: 911', 'font-size: 12px; color: #8b0000; font-weight: bold;');
