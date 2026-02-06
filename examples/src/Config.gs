/**
 * Configuration for AI Advisor Feed
 */
var CONFIG = {
  // Visual Theme Settings
  THEME: {
    FONT_FAMILY: 'Roboto',
    HEADING_COLOR: '#000000',
    LINK_COLOR: '#1a73e8',
    DATE_COLOR: '#666666',
    ERROR_COLOR: '#d93025',
    SEPARATOR_COLOR: '#000000',
    NO_ITEMS_COLOR: '#999999'
  },
  
  // Logic Settings
  SETTINGS: {
    COMMERCIAL_DAYS_LOOKBACK: 7,
    ACADEMIC_MONTHS_LOOKBACK: 1,
    CACHE_DURATION_SECONDS: 1200, // 20 minutes for commercial feeds
    ACADEMIC_CACHE_DURATION_SECONDS: 21600, // 6 hours for academic feeds (ArXiv updates slowly)
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    MAX_POSTS_PER_SOURCE_PER_DAY: 2,
    FEED_RETRY_ATTEMPTS: 2, // Retry failed individual feeds
    FEED_RETRY_DELAY_MS: 500,
    LOAD_IMAGES: true // Set to false to skip image loading for faster refresh
  },
  
  // ArXiv Specific Settings
  ARXIV: {
    SEARCH_QUERY: 'cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.RO',
    MAX_RESULTS: 50,
    SORT_BY: 'submittedDate',
    SORT_ORDER: 'descending'
  }
}
