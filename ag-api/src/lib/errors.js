class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || "APP_ERROR";
    this.isOperational = true; // expected error, safe to expose message to the client
  }
}

class ValidationError extends AppError {
  constructor(message) { super(message, 400, "VALIDATION_ERROR"); }
}
class AuthError extends AppError {
  constructor(message = "Unauthorized") { super(message, 401, "AUTH_ERROR"); }
}
class ForbiddenError extends AppError {
  constructor(message = "Forbidden") { super(message, 403, "FORBIDDEN"); }
}
class NotFoundError extends AppError {
  constructor(message = "Not found") { super(message, 404, "NOT_FOUND"); }
}
class ConflictError extends AppError {
  constructor(message = "Conflict") { super(message, 409, "CONFLICT"); }
}

module.exports = { AppError, ValidationError, AuthError, ForbiddenError, NotFoundError, ConflictError };
