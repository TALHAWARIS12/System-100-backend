const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Forex Factory / Economic Calendar Service
 * Fetches economic news events and high-impact releases
 */
class ForexFactoryService {
  constructor() {
    // Using a free forex calendar API alternative since FF doesn't have official API
    this.baseUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    this.cache = {
      data: null,
      lastFetch: null,
      ttl: 15 * 60 * 1000 // 15 minutes cache
    };
  }

  /**
   * Get economic calendar events
   */
  async getCalendarEvents(filters = {}) {
    try {
      // Check cache
      if (this.cache.data && this.cache.lastFetch && 
          (Date.now() - this.cache.lastFetch) < this.cache.ttl) {
        return this.filterEvents(this.cache.data, filters);
      }

      const response = await axios.get(this.baseUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TradingPlatform/1.0'
        }
      });

      const events = this.transformEvents(response.data);
      
      // Update cache
      this.cache.data = events;
      this.cache.lastFetch = Date.now();

      return this.filterEvents(events, filters);
    } catch (error) {
      logger.error('Forex Factory fetch error:', error.message);
      
      // Return cached data if available
      if (this.cache.data) {
        return this.filterEvents(this.cache.data, filters);
      }
      
      // Return sample data as fallback
      return this.getSampleEvents();
    }
  }

  /**
   * Transform raw API data to standardized format
   */
  transformEvents(rawData) {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData.map(event => ({
      id: `${event.date}_${event.title}`.replace(/\s+/g, '_'),
      title: event.title || 'Unknown Event',
      country: event.country || 'Unknown',
      currency: this.getCurrencyFromCountry(event.country),
      date: event.date,
      time: event.time || 'All Day',
      impact: this.normalizeImpact(event.impact),
      forecast: event.forecast || '-',
      previous: event.previous || '-',
      actual: event.actual || '-'
    }));
  }

  /**
   * Filter events based on criteria
   */
  filterEvents(events, filters) {
    let filtered = [...events];

    // Filter by impact level
    if (filters.impact) {
      const impacts = Array.isArray(filters.impact) ? filters.impact : [filters.impact];
      filtered = filtered.filter(e => impacts.includes(e.impact));
    }

    // Filter by currency
    if (filters.currency) {
      const currencies = Array.isArray(filters.currency) ? filters.currency : [filters.currency];
      filtered = filtered.filter(e => currencies.includes(e.currency));
    }

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(e => new Date(e.date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter(e => new Date(e.date) <= new Date(filters.endDate));
    }

    // Sort by date/time
    filtered.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time !== 'All Day' ? a.time : '00:00'}`);
      const dateB = new Date(`${b.date} ${b.time !== 'All Day' ? b.time : '00:00'}`);
      return dateA - dateB;
    });

    return filtered;
  }

  /**
   * Get currency code from country
   */
  getCurrencyFromCountry(country) {
    const countryToCurrency = {
      'USD': 'USD', 'United States': 'USD', 'US': 'USD',
      'EUR': 'EUR', 'European Union': 'EUR', 'EU': 'EUR', 'Germany': 'EUR',
      'GBP': 'GBP', 'United Kingdom': 'GBP', 'UK': 'GBP',
      'JPY': 'JPY', 'Japan': 'JPY', 'JP': 'JPY',
      'AUD': 'AUD', 'Australia': 'AUD', 'AU': 'AUD',
      'CAD': 'CAD', 'Canada': 'CAD', 'CA': 'CAD',
      'CHF': 'CHF', 'Switzerland': 'CHF', 'CH': 'CHF',
      'NZD': 'NZD', 'New Zealand': 'NZD', 'NZ': 'NZD',
      'CNY': 'CNY', 'China': 'CNY', 'CN': 'CNY'
    };
    return countryToCurrency[country] || country || 'USD';
  }

  /**
   * Normalize impact levels
   */
  normalizeImpact(impact) {
    if (!impact) return 'low';
    const impactLower = impact.toLowerCase();
    if (impactLower.includes('high') || impactLower === 'red') return 'high';
    if (impactLower.includes('medium') || impactLower === 'orange') return 'medium';
    return 'low';
  }

  /**
   * Get today's high impact events
   */
  async getTodayHighImpact() {
    const today = new Date().toISOString().split('T')[0];
    const events = await this.getCalendarEvents({
      impact: 'high',
      startDate: today,
      endDate: today
    });
    return events;
  }

  /**
   * Get upcoming events (next 24 hours)
   */
  async getUpcomingEvents(hours = 24) {
    const now = new Date();
    const endDate = new Date(now.getTime() + hours * 60 * 60 * 1000);
    
    const events = await this.getCalendarEvents({
      startDate: now.toISOString(),
      endDate: endDate.toISOString()
    });
    return events;
  }

  /**
   * Sample events fallback
   */
  getSampleEvents() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    return [
      {
        id: 'sample_1',
        title: 'Federal Reserve Interest Rate Decision',
        country: 'United States',
        currency: 'USD',
        date: today,
        time: '14:00',
        impact: 'high',
        forecast: '5.50%',
        previous: '5.25%',
        actual: '-'
      },
      {
        id: 'sample_2',
        title: 'Non-Farm Payrolls',
        country: 'United States',
        currency: 'USD',
        date: tomorrow,
        time: '08:30',
        impact: 'high',
        forecast: '180K',
        previous: '175K',
        actual: '-'
      },
      {
        id: 'sample_3',
        title: 'ECB Press Conference',
        country: 'European Union',
        currency: 'EUR',
        date: today,
        time: '13:30',
        impact: 'high',
        forecast: '-',
        previous: '-',
        actual: '-'
      },
      {
        id: 'sample_4',
        title: 'UK GDP',
        country: 'United Kingdom',
        currency: 'GBP',
        date: tomorrow,
        time: '07:00',
        impact: 'medium',
        forecast: '0.3%',
        previous: '0.2%',
        actual: '-'
      }
    ];
  }
}

module.exports = new ForexFactoryService();
