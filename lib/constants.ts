// ========================================
// SHARED CONSTANTS
// ========================================

// UUID validation regex pattern
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Short ID validation regex pattern (10 characters, alphanumeric)
export const SHORT_ID_REGEX = /^[a-zA-Z0-9]{10}$/

// Common validation functions
export const isValidUUID = (id: string): boolean => UUID_REGEX.test(id)
export const isValidShortId = (id: string): boolean => SHORT_ID_REGEX.test(id)
