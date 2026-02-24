// Custom HTTP error classes for Fastify error handler

export class HttpError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'HttpError';
  }
}

export class BadRequest extends HttpError {
  constructor(message = 'Bad Request', code) {
    super(400, message, code);
    this.name = 'BadRequest';
  }
}

export class Unauthorized extends HttpError {
  constructor(message = 'Unauthorized', code) {
    super(401, message, code);
    this.name = 'Unauthorized';
  }
}

export class Forbidden extends HttpError {
  constructor(message = 'Forbidden', code) {
    super(403, message, code);
    this.name = 'Forbidden';
  }
}

export class NotFound extends HttpError {
  constructor(message = 'Not Found', code) {
    super(404, message, code);
    this.name = 'NotFound';
  }
}

export class Conflict extends HttpError {
  constructor(message = 'Conflict', code) {
    super(409, message, code);
    this.name = 'Conflict';
  }
}

export class TooManyRequests extends HttpError {
  constructor(message = 'Too Many Requests', code) {
    super(429, message, code);
    this.name = 'TooManyRequests';
  }
}
