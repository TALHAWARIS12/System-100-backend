const { DataSource } = require('../models');
const logger = require('../utils/logger');
const axios = require('axios');

// @desc    Get all data sources
// @route   GET /api/data-sources
// @access  Admin
exports.getDataSources = async (req, res, next) => {
  try {
    const sources = await DataSource.findAll({
      order: [['priority', 'ASC'], ['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: sources.length,
      sources
    });
  } catch (error) {
    logger.error('Get data sources error:', error);
    next(error);
  }
};

// @desc    Get single data source
// @route   GET /api/data-sources/:id
// @access  Admin
exports.getDataSource = async (req, res, next) => {
  try {
    const source = await DataSource.findByPk(req.params.id);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    res.status(200).json({
      success: true,
      source
    });
  } catch (error) {
    logger.error('Get data source error:', error);
    next(error);
  }
};

// @desc    Create data source
// @route   POST /api/data-sources
// @access  Admin
exports.createDataSource = async (req, res, next) => {
  try {
    const { name, provider, baseUrl, apiKey, rateLimit, configuration } = req.body;

    const source = await DataSource.create({
      name,
      provider,
      baseUrl,
      apiKey,
      rateLimit,
      configuration: configuration || {}
    });

    logger.info(`Data source created: ${source.name}`);

    res.status(201).json({
      success: true,
      message: 'Data source created successfully',
      source
    });
  } catch (error) {
    logger.error('Create data source error:', error);
    next(error);
  }
};

// @desc    Update data source
// @route   PUT /api/data-sources/:id
// @access  Admin
exports.updateDataSource = async (req, res, next) => {
  try {
    const source = await DataSource.findByPk(req.params.id);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    const { name, provider, baseUrl, apiKey, isActive, priority, rateLimit, configuration } = req.body;

    await source.update({
      name: name || source.name,
      provider: provider || source.provider,
      baseUrl: baseUrl || source.baseUrl,
      apiKey: apiKey !== undefined ? apiKey : source.apiKey,
      isActive: isActive !== undefined ? isActive : source.isActive,
      priority: priority !== undefined ? priority : source.priority,
      rateLimit: rateLimit !== undefined ? rateLimit : source.rateLimit,
      configuration: configuration !== undefined ? configuration : source.configuration
    });

    logger.info(`Data source updated: ${source.name}`);

    res.status(200).json({
      success: true,
      message: 'Data source updated successfully',
      source
    });
  } catch (error) {
    logger.error('Update data source error:', error);
    next(error);
  }
};

// @desc    Delete data source
// @route   DELETE /api/data-sources/:id
// @access  Admin
exports.deleteDataSource = async (req, res, next) => {
  try {
    const source = await DataSource.findByPk(req.params.id);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    await source.destroy();

    logger.info(`Data source deleted: ${source.name}`);

    res.status(200).json({
      success: true,
      message: 'Data source deleted successfully'
    });
  } catch (error) {
    logger.error('Delete data source error:', error);
    next(error);
  }
};

// @desc    Test data source connection
// @route   POST /api/data-sources/:id/test
// @access  Admin
exports.testDataSource = async (req, res, next) => {
  try {
    const source = await DataSource.findByPk(req.params.id);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found'
      });
    }

    // Test API call based on provider
    let testUrl;
    let testParams = { ...source.configuration };

    switch (source.provider) {
      case 'alphavantage':
        // Use correct Alpha Vantage endpoint
        testUrl = source.baseUrl.includes('alphavantage.co') 
          ? `${source.baseUrl}/query`
          : 'https://www.alphavantage.co/query';
        testParams = {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency: 'USD',
          to_currency: 'EUR',
          apikey: source.apiKey
        };
        break;

      case 'twelvedata':
        testUrl = `${source.baseUrl}/time_series`;
        testParams.symbol = 'EUR/USD';
        testParams.interval = '1h';
        testParams.apikey = source.apiKey;
        break;

      case 'polygon':
        testUrl = `${source.baseUrl}/v2/aggs/ticker/C:EURUSD/range/1/hour/2023-01-01/2023-01-02`;
        testParams.apiKey = source.apiKey;
        break;

      case 'finnhub':
        testUrl = `${source.baseUrl}/forex/candle`;
        testParams.symbol = 'OANDA:EUR_USD';
        testParams.resolution = '60';
        testParams.from = Math.floor(Date.now() / 1000) - 86400;
        testParams.to = Math.floor(Date.now() / 1000);
        testParams.token = source.apiKey;
        break;

      case 'custom':
        testUrl = source.baseUrl;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Unknown provider type'
        });
    }

    const startTime = Date.now();
    const response = await axios.get(testUrl, {
      params: testParams,
      timeout: 10000
    });
    const latency = Date.now() - startTime;

    // Update last used
    await source.update({
      lastUsed: new Date(),
      lastError: null
    });

    res.status(200).json({
      success: true,
      message: 'Connection successful',
      latency: `${latency}ms`,
      status: response.status,
      dataReceived: !!response.data
    });

  } catch (error) {
    // Log error to data source
    await DataSource.update(
      { lastError: error.message },
      { where: { id: req.params.id } }
    );

    logger.error(`Data source test failed for ${req.params.id}:`, error.message);

    res.status(200).json({
      success: false,
      message: 'Connection failed',
      error: error.message
    });
  }
};

// @desc    Reset usage counter for all sources (runs daily)
// @route   POST /api/data-sources/reset-usage
// @access  Admin
exports.resetUsageCounters = async (req, res, next) => {
  try {
    await DataSource.update(
      { usageCount: 0 },
      { where: {} }
    );

    logger.info('Data source usage counters reset');

    res.status(200).json({
      success: true,
      message: 'Usage counters reset successfully'
    });
  } catch (error) {
    logger.error('Reset usage counters error:', error);
    next(error);
  }
};
