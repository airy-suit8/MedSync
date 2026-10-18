// Authentication utility functions and constants

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export const validateEmail = (email: string): boolean => {
    if (email.length > 254) return false
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email.toLowerCase())
}

export const validatePassword = (password: string): {
    isValid: boolean
    score: number
    feedback: string
    errors: string[]
} => {
    const errors: string[] = []
    let score = 0

    if (password.length >= 8) {
        score++
    } else {
        errors.push("At least 8 characters")
    }

    if (/[A-Z]/.test(password)) {
        score++
    } else {
        errors.push("One uppercase letter")
    }

    if (/[a-z]/.test(password)) {
        score++
    } else {
        errors.push("One lowercase letter")
    }

    if (/[0-9]/.test(password)) {
        score++
    } else {
        errors.push("One number")
    }

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score++
    } else {
        errors.push("One special character")
    }

    let feedback = ""
    if (score < 3) feedback = "Weak password"
    else if (score < 4) feedback = "Fair password"
    else if (score < 5) feedback = "Good password"
    else feedback = "Strong password"

    return {
        isValid: score >= 4, // Require at least 4/5 criteria
        score,
        feedback,
        errors,
    }
}

// ============================================
// ERROR MESSAGES
// ============================================

export const AUTH_ERRORS = {
    // Login errors
    INVALID_CREDENTIALS: "Invalid email or password. Please check your credentials and try again.",
    EMAIL_NOT_VERIFIED: "Please verify your email before signing in. Check your inbox for the verification link.",
    ACCOUNT_LOCKED: "Your account has been locked due to multiple failed login attempts. Please try again later.",

    // Signup errors
    EMAIL_EXISTS: "An account with this email already exists. Please sign in instead.",
    WEAK_PASSWORD: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
    INVALID_EMAIL: "Please enter a valid email address.",
    MISSING_NAME: "Please enter your full name.",
    MISSING_ROLE: "Please select your role.",
    MISSING_LICENSE: "Please enter your registration number.",

    // Password reset errors
    PASSWORDS_MISMATCH: "Passwords do not match. Please try again.",
    // Reset links only work in the browser that asked for them (and expire after an hour).
    INVALID_RESET_LINK: "This reset link didn't work. Open it in the same browser where you asked for it, or ask for a new one with “Forgot password?” on the sign-in page.",

    // Network errors
    NETWORK_ERROR: "Network error. Please check your connection and try again.",
    RATE_LIMIT: "Too many requests. Please wait a few minutes before trying again.",

    // Generic
    UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
}

// ============================================
// ROLE-BASED ROUTING
// ============================================

export type UserRole = "doctor" | "patient" | "lab" | "admin"

export const getRoleDashboard = (role: UserRole | null | undefined): string => {
    switch (role) {
        case "doctor":
            return "/doctor-dashboard"
        case "patient":
            return "/patient-dashboard"
        case "lab":
            return "/lab-dashboard"
        case "admin":
            return "/admin-dashboard"
        default:
            return "/"
    }
}

// ============================================
// ERROR PARSING
// ============================================

export const parseAuthError = (error: any): string => {
    if (!error) return AUTH_ERRORS.UNKNOWN_ERROR

    const message = error.message || error.toString()

    // Match error patterns
    if (message.includes("Email not confirmed") || message.includes("email_not_confirmed")) {
        return AUTH_ERRORS.EMAIL_NOT_VERIFIED
    }
    if (message.includes("Invalid login credentials") || message.includes("invalid_credentials")) {
        return AUTH_ERRORS.INVALID_CREDENTIALS
    }
    if (message.includes("already registered") || message.includes("already_exists")) {
        return AUTH_ERRORS.EMAIL_EXISTS
    }
    if (message.includes("Too many requests") || message.includes("rate_limit")) {
        return AUTH_ERRORS.RATE_LIMIT
    }
    if (message.includes("Network") || message.includes("fetch")) {
        return AUTH_ERRORS.NETWORK_ERROR
    }

    // Return raw message if no pattern matches
    return message
}

// ============================================
// SUCCESS MESSAGES
// ============================================

export const AUTH_SUCCESS = {
    SIGNUP_SUCCESS: "Account created successfully! Please check your email to verify your account.",
    LOGIN_SUCCESS: "Welcome back! Redirecting to your dashboard...",
    PASSWORD_RESET_SENT: "Password reset link sent! Please check your email.",
    PASSWORD_UPDATED: "Password updated successfully! You can now sign in with your new password.",
    EMAIL_VERIFIED: "Email verified successfully! You can now sign in.",
}
