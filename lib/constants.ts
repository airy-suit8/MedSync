// ========================================
// SHARED CONSTANTS
// ========================================

// UUID validation regex pattern
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Common validation functions
export const isValidUUID = (id: string): boolean => UUID_REGEX.test(id)
