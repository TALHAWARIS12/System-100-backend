const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Auth validation rules
 */
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name must be 2-50 characters, letters only'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name must be 2-50 characters, letters only'),
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

/**
 * Trade validation rules
 */
const createTradeValidation = [
  body('asset')
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[A-Z]+$/)
    .withMessage('Asset must be 3-20 uppercase letters'),
  body('direction')
    .isIn(['buy', 'sell'])
    .withMessage('Direction must be buy or sell'),
  body('entry')
    .isFloat({ min: 0 })
    .withMessage('Entry price must be a positive number'),
  body('stopLoss')
    .isFloat({ min: 0 })
    .withMessage('Stop loss must be a positive number'),
  body('takeProfit')
    .isFloat({ min: 0 })
    .withMessage('Take profit must be a positive number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  body('isVisible')
    .optional()
    .isBoolean()
    .withMessage('isVisible must be a boolean'),
  handleValidationErrors
];

/**
 * Data source validation rules
 */
const createDataSourceValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Name must be 3-50 characters'),
  body('provider')
    .isIn(['alphavantage', 'twelvedata', 'polygon', 'finnhub', 'custom'])
    .withMessage('Invalid provider'),
  body('baseUrl')
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Invalid URL'),
  body('apiKey')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('API key must be 10-200 characters'),
  body('rateLimit')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Rate limit must be between 1 and 100000'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Priority must be between 0 and 100'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  handleValidationErrors
];

/**
 * Scanner configuration validation
 */
const scannerConfigValidation = [
  body('strategyName')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Strategy name must be 3-50 characters, alphanumeric and underscore only'),
  body('pairs')
    .isArray({ min: 1 })
    .withMessage('Pairs must be a non-empty array'),
  body('pairs.*')
    .matches(/^[A-Z]{6}$/)
    .withMessage('Each pair must be 6 uppercase letters (e.g., BTCUSD)'),
  body('timeframes')
    .isArray({ min: 1 })
    .withMessage('Timeframes must be a non-empty array'),
  body('timeframes.*')
    .isIn(['1min', '5min', '15min', '30min', '1h', '4h', '1d'])
    .withMessage('Invalid timeframe'),
  body('isEnabled')
    .optional()
    .isBoolean()
    .withMessage('isEnabled must be a boolean'),
  body('scanInterval')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Scan interval must be between 1 and 1440 minutes'),
  handleValidationErrors
];

/**
 * ID parameter validation
 */
const validateId = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

/**
 * Query parameter validation
 */
const paginationValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  handleValidationErrors
];

module.exports = {
  registerValidation,
  loginValidation,
  createTradeValidation,
  createDataSourceValidation,
  scannerConfigValidation,
  validateId,
  paginationValidation,
  handleValidationErrors
};
