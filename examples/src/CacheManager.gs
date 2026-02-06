/**
 * Cache Manager Module
 * Handles caching strategy for RSS feeds
 */
var CacheManager = {
  /**
   * Get data from cache
   */
  get: function(key) {
    try {
      const cache = CacheService.getScriptCache()
      const cached = cache.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (e) {
      Logger.log(`Cache get error: ${e.message}`)
      return null
    }
  },

  /**
   * Put data into cache with default duration
   */
  put: function(key, data) {
    this.putWithDuration(key, data, CONFIG.SETTINGS.CACHE_DURATION_SECONDS)
  },

  /**
   * Put data into cache with custom duration
   */
  putWithDuration: function(key, data, durationSeconds) {
    try {
      const cache = CacheService.getScriptCache()
      cache.put(key, JSON.stringify(data), durationSeconds)
    } catch (e) {
      Logger.log(`Cache put error: ${e.message}`)
    }
  },
  
  /**
   * Fetch feeds with caching strategy
   * Checks cache for each URL, fetches missing ones in parallel, and updates cache
   * Includes retry logic for failed individual feeds
   */
  fetchAndCacheFeeds: function(urls, cutoffDate, errors) {
    const allItems = []
    const feedsToFetch = []
    const self = this

    // 1. Check cache for all URLs
    urls.forEach(url => {
      const cacheKey = `feed_${Utilities.base64Encode(url)}`
      const cachedItems = this.get(cacheKey)

      if (cachedItems) {
        Logger.log(`Loaded from cache: ${url}`)
        allItems.push(...cachedItems)
      } else {
        feedsToFetch.push(url)
      }
    })

    const cachedCount = urls.length - feedsToFetch.length
    if (cachedCount > 0) {
      Logger.log(`${cachedCount} feeds loaded from cache`)
    }

    // 2. Fetch missing feeds
    if (feedsToFetch.length > 0) {
      Logger.log(`Fetching ${feedsToFetch.length} feeds...`)

      const requests = feedsToFetch.map(url => ({
        url: url,
        muteHttpExceptions: true,
        followRedirects: true
      }))

      const failedFeeds = [] // Track feeds that need retry

      try {
        const responses = UrlFetchApp.fetchAll(requests)

        responses.forEach((response, index) => {
          const url = feedsToFetch[index]
          const responseCode = response.getResponseCode()

          if (responseCode === 200) {
            try {
              const items = RssParser.parseFeedContent(response.getContentText(), url, cutoffDate)
              allItems.push(...items)

              // 3. Cache successful results
              if (items.length > 0) {
                const cacheKey = `feed_${Utilities.base64Encode(url)}`
                self.put(cacheKey, items)
              }
            } catch (e) {
              // Parse error - add to retry list
              failedFeeds.push({ url: url, reason: `Parse error: ${e.message}` })
            }
          } else if (responseCode >= 500 || responseCode === 429) {
            // Server error or rate limited - worth retrying
            failedFeeds.push({ url: url, reason: `HTTP ${responseCode}` })
          } else {
            // Client error (4xx) - don't retry, just log
            errors.push(`Error fetching ${url}: HTTP ${responseCode}`)
          }
        })
      } catch (e) {
        // Batch fetch completely failed - try individual retries for all
        Logger.log(`Batch fetch error: ${e.message}. Will retry individually.`)
        feedsToFetch.forEach(url => {
          failedFeeds.push({ url: url, reason: 'Batch fetch failed' })
        })
      }

      // 4. Retry failed feeds individually
      if (failedFeeds.length > 0) {
        Logger.log(`Retrying ${failedFeeds.length} failed feeds individually...`)
        const retryResults = this.retryFailedFeeds(failedFeeds, cutoffDate, errors)
        allItems.push(...retryResults)
      }
    }

    return allItems
  },

  /**
   * Retry failed feeds individually with exponential backoff
   */
  retryFailedFeeds: function(failedFeeds, cutoffDate, errors) {
    const items = []
    const maxRetries = CONFIG.SETTINGS.FEED_RETRY_ATTEMPTS || 2
    const baseDelay = CONFIG.SETTINGS.FEED_RETRY_DELAY_MS || 500
    const self = this

    failedFeeds.forEach(feed => {
      let success = false

      for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
        try {
          // Exponential backoff: 500ms, 1000ms, etc.
          if (attempt > 1) {
            Utilities.sleep(baseDelay * attempt)
          }

          Logger.log(`Retry attempt ${attempt}/${maxRetries} for ${feed.url}`)

          const response = UrlFetchApp.fetch(feed.url, {
            muteHttpExceptions: true,
            followRedirects: true
          })

          if (response.getResponseCode() === 200) {
            const feedItems = RssParser.parseFeedContent(response.getContentText(), feed.url, cutoffDate)
            items.push(...feedItems)

            // Cache successful retry
            if (feedItems.length > 0) {
              const cacheKey = `feed_${Utilities.base64Encode(feed.url)}`
              self.put(cacheKey, feedItems)
            }

            success = true
            Logger.log(`Retry successful for ${feed.url}`)
          } else {
            Logger.log(`Retry attempt ${attempt} failed for ${feed.url}: HTTP ${response.getResponseCode()}`)
          }
        } catch (e) {
          Logger.log(`Retry attempt ${attempt} error for ${feed.url}: ${e.message}`)
        }
      }

      if (!success) {
        errors.push(`Failed to fetch ${feed.url} after ${maxRetries} retries (${feed.reason})`)
      }
    })

    return items
  }
}
