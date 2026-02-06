/**
 * RSS/Atom Feed Parser Library
 * 
 * A reusable library for parsing RSS and Atom feeds in Google Apps Script.
 * Handles HTML entity decoding, text cleaning, and image extraction.
 */

var RssParser = (function() {
  'use strict'
  
  /**
   * Main entry point: Parse a single RSS/Atom feed
   * 
   * @param {string} url - The RSS/Atom feed URL
   * @param {Date} cutoffDate - Only return items published after this date
   * @return {Array} Array of feed items
   */
  function parseFeed(url, cutoffDate) {
    try {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true
      })
      
      if (response.getResponseCode() !== 200) {
        throw new Error(`HTTP ${response.getResponseCode()}`)
      }
      
      return parseFeedContent(response.getContentText(), url, cutoffDate)
    } catch (error) {
      Logger.log(`Error parsing feed ${url}: ${error.message}`)
      return []
    }
  }

  /**
   * Parse raw XML content directly
   * 
   * @param {string} xmlContent - The raw XML content
   * @param {string} url - The source URL (for logging/reference)
   * @param {Date} cutoffDate - Only return items published after this date
   * @return {Array} Array of feed items
   */
  function parseFeedContent(xmlContent, url, cutoffDate) {
    try {
      // Pre-process XML to handle common issues
      const cleanContent = cleanXml(xmlContent)
      const document = XmlService.parse(cleanContent)
      const root = document.getRootElement()
      
      // Handle different RSS/Atom formats
      const namespace = XmlService.getNamespace('http://www.w3.org/2005/Atom')
      
      let items = []
      
      // Try Atom format first
      const atomEntries = root.getChildren('entry', namespace)
      if (atomEntries.length > 0) {
        items = parseAtomFeed(root, namespace, cutoffDate)
      } else {
        // Try RSS format
        const channel = root.getChild('channel')
        const rssItems = channel ? channel.getChildren('item') : []
        if (rssItems.length > 0) {
          items = parseRSSFeed(root, cutoffDate)
        }
      }
      
      return items
    } catch (error) {
      Logger.log(`Error parsing feed content from ${url}: ${error.message}`)
      // Try one more time with more aggressive cleaning if first attempt failed
      if (!url.includes('retry')) {
        try {
           const aggressiveClean = cleanXmlAggressive(xmlContent)
           const document = XmlService.parse(aggressiveClean)
           const root = document.getRootElement()
           // ... (simplified retry logic could go here, but for now just log)
        } catch (e) {
           Logger.log(`Retry failed for ${url}: ${e.message}`)
        }
      }
      return []
    }
  }

  /**
   * Clean XML content to handle common parsing errors
   */
  function cleanXml(xml) {
    if (!xml) return ''
    
    // Remove invalid control characters
    let clean = xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    
    // Strip script and style tags (content and all) to prevent parsing errors
    clean = clean.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
    clean = clean.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
    
    // Fix unclosed link tags - ONLY if they look like RSS text links (start with http)
    // This avoids breaking Atom self-closing links like <link href="..." />
    // We use (?=<) to ensure we matched the full content up to the next tag, preventing backtracking
    clean = clean.replace(/<link>(https?:\/\/[^<]+)(?=<)(?!<\/link>)/gi, '<link>$1</link>')
    
    // Fix unclosed br, img, hr, meta, input tags that might be in non-CDATA content
    clean = clean.replace(/<(br|img|hr|meta|input|col|base)([^>]*)(?<!\/)>/gi, '<$1$2 />')
    
    // Handle & in URLs that aren't escaped
    clean = clean.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, '&amp;')
    
    return clean
  }

  /**
   * Aggressively clean XML content for retries
   */
  function cleanXmlAggressive(xml) {
    if (!xml) return ''
    let clean = cleanXml(xml)
    
    // Remove DOCTYPE which might cause issues if DTD is not accessible
    clean = clean.replace(/<!DOCTYPE[^>]+>/i, '')
    
    // Ensure we start with a tag (trim whitespace/garbage at start)
    const firstTag = clean.indexOf('<')
    if (firstTag > 0) {
      clean = clean.substring(firstTag)
    }
    
    return clean
  }

  /**
   * Parse Atom feed format
   */
  function parseAtomFeed(root, namespace, cutoffDate) {
    const entries = root.getChildren('entry', namespace)
    const items = []
    const sourceName = extractSourceName(root, namespace)
    
    entries.forEach(entry => {
      try {
        const published = entry.getChild('published', namespace)
        if (!published) return
        
        const pubDate = parseDate(published.getText())
        if (!pubDate || pubDate < cutoffDate) return
        
        const titleRaw = entry.getChild('title', namespace)?.getText() || 'No title'
        const title = decodeHtmlEntities(titleRaw)
        
        const linkElem = entry.getChild('link', namespace)
        const link = linkElem ? linkElem.getAttribute('href')?.getValue() : 
                    (entry.getChild('link', namespace)?.getText() || '')
        
        const content = entry.getChild('content', namespace) || 
                       entry.getChild('summary', namespace)
        // Use extractHtmlFromElement to preserve HTML structure in descriptions
        const description = content ? extractHtmlFromElement(content) : ''
        
        // Extract image from content or media:thumbnail
        const imageUrl = extractImageFromAtomEntry(entry, namespace, content)
        
        items.push({
          date: pubDate,
          source: sourceName,
          title: title,
          description: description,
          link: link,
          imageUrl: imageUrl
        })
      } catch (error) {
        Logger.log(`Error parsing Atom entry: ${error.message}`)
      }
    })
    
    return items
  }
  
  /**
   * Parse RSS feed format
   */
  function parseRSSFeed(root, cutoffDate) {
    const channel = root.getChild('channel')
    if (!channel) return []
    
    const items = []
    const sourceName = channel.getChild('title')?.getText() || 'Unknown Source'
    const rssItems = channel.getChildren('item')
    
    rssItems.forEach(item => {
      try {
        const pubDateElement = item.getChild('pubDate')
        if (!pubDateElement) return
        
        const pubDate = parseDate(pubDateElement.getText())
        if (!pubDate || pubDate < cutoffDate) return
        
        const titleRaw = item.getChild('title')?.getText() || 'No title'
        const title = decodeHtmlEntities(titleRaw)
        const link = item.getChild('link')?.getText() || ''
        const descriptionElement = item.getChild('description')
        // Use extractHtmlFromElement to preserve HTML structure in descriptions
        const description = descriptionElement ? extractHtmlFromElement(descriptionElement) : ''
        
        // Extract image from enclosure, media:thumbnail, or description
        const imageUrl = extractImageFromRSSItem(item, description)
        
        items.push({
          date: pubDate,
          source: sourceName,
          title: title,
          description: description,
          link: link,
          imageUrl: imageUrl
        })
      } catch (error) {
        Logger.log(`Error parsing RSS item: ${error.message}`)
      }
    })
    
    return items
  }
  
  /**
   * Extract source name from feed
   */
  function extractSourceName(root, namespace) {
    try {
      const atomTitle = root.getChild('title', namespace)
      if (atomTitle) {
        return decodeHtmlEntities(atomTitle.getText())
      }
      
      const channel = root.getChild('channel')
      if (channel) {
        const rssTitle = channel.getChild('title')
        if (rssTitle) {
          return decodeHtmlEntities(rssTitle.getText())
        }
      }
    } catch (error) {
      Logger.log(`Error extracting source name: ${error.message}`)
    }
    
    return 'Unknown Source'
  }
  
  /**
   * Extract text/HTML content from XML element (handles CDATA, HTML, and nested elements)
   * Preserves HTML structure for proper rendering
   */
  function extractTextFromElement(element) {
    try {
      // Get raw text content (handles CDATA automatically in XmlService)
      let text = element.getText()
      
      // If no direct text, try to get from nested elements
      if (!text || text.trim() === '') {
        const children = element.getChildren()
        if (children.length > 0) {
          // Recursively extract from children, preserving structure
          text = children.map(child => {
            const childText = child.getText()
            // If child has nested content, try to preserve it
            if (!childText && child.getChildren().length > 0) {
              return extractTextFromElement(child)
            }
            return childText || ''
          }).filter(t => t).join(' ')
        }
      }
      
      // Decode XML entities first (like &lt; &gt; &amp; etc.)
      // This is important because XML content may have entities that need decoding
      text = decodeXmlEntities(text)
      
      return text.trim()
    } catch (error) {
      Logger.log(`Error extracting text from element: ${error.message}`)
      return ''
    }
  }
  
  /**
   * Decode XML entities (separate from HTML entities)
   * XML entities are different from HTML entities
   */
  function decodeXmlEntities(text) {
    if (!text) return ''
    
    // XML standard entities
    const xmlEntityMap = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&apos;': "'"
    }
    
    let decoded = text
    // Replace XML entities (but be careful not to double-decode)
    // Only replace if they're actual XML entities, not already decoded HTML
    for (const [entity, char] of Object.entries(xmlEntityMap)) {
      // Use word boundaries to avoid partial matches
      decoded = decoded.replace(new RegExp(entity, 'g'), char)
    }
    
    // Also handle numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num, 10))
    })
    
    decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16))
    })
    
    return decoded
  }
  
  /**
   * Extract image URL from Atom entry
   */
  function extractImageFromAtomEntry(entry, namespace, contentElement) {
    try {
      const mediaNamespace = XmlService.getNamespace('media', 'http://search.yahoo.com/mrss/')
      const thumbnail = entry.getChild('thumbnail', mediaNamespace)
      if (thumbnail) {
        const url = thumbnail.getAttribute('url')?.getValue()
        if (url && isValidImageUrl(url)) return url
      }
      
      if (contentElement) {
        const contentText = extractHtmlFromElement(contentElement)
        // Handle both regular and XML-encoded quotes in src attribute
        const imgMatch = contentText.match(/<img[^>]+src=["']([^"']+)["']/i) ||
                        contentText.match(/<img[^>]+src=([^\s>]+)/i)
        if (imgMatch && isValidImageUrl(imgMatch[1])) {
          return decodeXmlEntities(imgMatch[1])
        }
      }
      
      const summary = entry.getChild('summary', namespace)
      if (summary) {
        const summaryText = extractHtmlFromElement(summary)
        const imgMatch = summaryText.match(/<img[^>]+src=["']([^"']+)["']/i) ||
                        summaryText.match(/<img[^>]+src=([^\s>]+)/i)
        if (imgMatch && isValidImageUrl(imgMatch[1])) {
          return decodeXmlEntities(imgMatch[1])
        }
      }
    } catch (error) {
      Logger.log(`Error extracting image from Atom entry: ${error.message}`)
    }
    
    return ''
  }
  
  /**
   * Extract image URL from RSS item
   */
  function extractImageFromRSSItem(item, description) {
    try {
      const mediaNamespace = XmlService.getNamespace('media', 'http://search.yahoo.com/mrss/')
      const thumbnail = item.getChild('thumbnail', mediaNamespace)
      if (thumbnail) {
        const url = thumbnail.getAttribute('url')?.getValue()
        if (url && isValidImageUrl(url)) return url
      }
      
      const enclosures = item.getChildren('enclosure')
      for (const enclosure of enclosures) {
        const type = enclosure.getAttribute('type')?.getValue() || ''
        if (type.startsWith('image/')) {
          const url = enclosure.getAttribute('url')?.getValue()
          if (url && isValidImageUrl(url)) return url
        }
      }
      
      if (description) {
        // Handle both regular and XML-encoded quotes in src attribute
        const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i) ||
                        description.match(/<img[^>]+src=([^\s>]+)/i)
        if (imgMatch && isValidImageUrl(imgMatch[1])) {
          return decodeXmlEntities(imgMatch[1])
        }
      }
    } catch (error) {
      Logger.log(`Error extracting image from RSS item: ${error.message}`)
    }
    
    return ''
  }
  
  /**
   * Validate image URL
   * Relaxed validation to allow more image URLs (including those without extensions)
   */
  function isValidImageUrl(url) {
    if (!url || url.trim() === '') return false
    
    // Basic URL check
    if (!url.match(/^https?:\/\//i)) return false
    
    // If it has an extension, it must be an image extension
    const extensionMatch = url.match(/\.([a-z0-9]+)(\?|$)/i)
    if (extensionMatch) {
      const ext = extensionMatch[1].toLowerCase()
      const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff']
      // If it has a known non-image extension (like html, php, asp), reject it
      // unless it's a known image serving endpoint
      const invalidExts = ['html', 'htm', 'php', 'asp', 'aspx', 'jsp', 'js', 'css']
      
      if (validExts.includes(ext)) return true
      if (invalidExts.includes(ext)) return false
    }
    
    // If no extension or unknown extension, assume it might be an image if it's a valid URL
    // This is risky but necessary for some CDNs
    return true
  }
  
  /**
   * Parse date string to Date object
   */
  function parseDate(dateString) {
    if (!dateString) return null
    
    try {
      let date = new Date(dateString)
      
      if (isNaN(date.getTime())) {
        date = new Date(dateString.replace(/(\d{1,2})\s+(\w{3})\s+(\d{4})/, '$2 $1, $3'))
      }
      
      if (isNaN(date.getTime())) {
        return null
      }
      
      return date
    } catch (error) {
      Logger.log(`Error parsing date: ${dateString} - ${error.message}`)
      return null
    }
  }
  
  /**
   * Decode HTML entities to proper characters
   */
  function decodeHtmlEntities(text) {
    if (!text) return ''
    
    const entityMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&#8217;': "'",
      '&#8216;': "'",
      '&#8220;': '"',
      '&#8221;': '"',
      '&#8230;': '...',
      '&#8211;': '–',
      '&#8212;': '—',
      '&#160;': ' ',
      '&hellip;': '...',
      '&mdash;': '—',
      '&ndash;': '–'
    }
    
    let decoded = text
    for (const [entity, char] of Object.entries(entityMap)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), char)
    }
    
    decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num, 10))
    })
    
    decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16))
    })
    
    return decoded
  }
  
  /**
   * Clean and normalize text spacing
   * Strips HTML tags and normalizes whitespace
   */
  function cleanTextSpacing(text) {
    if (!text) return ''
    
    // First decode XML/HTML entities
    text = decodeHtmlEntities(text)
    
    // Remove HTML tags but preserve spacing
    text = text.replace(/<[^>]+>/g, ' ')
    
    // Normalize whitespace
    text = text.replace(/[\s\u00A0]+/g, ' ')
    
    return text.trim()
  }
  
  /**
   * Extract raw HTML content from XML element (preserves HTML for parsing)
   * Use this when you need to preserve HTML structure for later parsing
   */
  function extractHtmlFromElement(element) {
    try {
      let html = element.getText()
      
      if (!html || html.trim() === '') {
        const children = element.getChildren()
        if (children.length > 0) {
          html = children.map(child => {
            const childText = child.getText()
            if (!childText && child.getChildren().length > 0) {
              return extractHtmlFromElement(child)
            }
            return childText || ''
          }).filter(t => t).join(' ')
        }
      }
      
      
      return html.trim()
    } catch (error) {
      Logger.log(`Error extracting HTML from element: ${error.message}`)
      return ''
    }
  }
  
  /**
   * Parse ArXiv API feed
   * 
   * @param {string} query - Search query
   * @param {Date} cutoffDate - Only return items published after this date
   * @param {string} baseUrl - ArXiv API base URL
   * @return {Array} Array of feed items
   */
  function parseArxiv(query, cutoffDate, baseUrl) {
    try {
      const encodedQuery = encodeURIComponent(query)
      const url = `${baseUrl}?search_query=${encodedQuery}&sortBy=${CONFIG.ARXIV.SORT_BY}&sortOrder=${CONFIG.ARXIV.SORT_ORDER}&max_results=${CONFIG.ARXIV.MAX_RESULTS}`
      
      Logger.log(`Fetching ArXiv feed: ${url}`)
      
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true
      })
      
      if (response.getResponseCode() !== 200) {
        throw new Error(`HTTP ${response.getResponseCode()}`)
      }
      
      const xmlContent = response.getContentText()
      const document = XmlService.parse(xmlContent)
      const root = document.getRootElement()
      
      // ArXiv uses Atom format
      const atomNamespace = XmlService.getNamespace('http://www.w3.org/2005/Atom')
      const entries = root.getChildren('entry', atomNamespace)
      
      const items = []
      
      entries.forEach(entry => {
        try {
          const published = entry.getChild('published', atomNamespace)
          if (!published) return
          
          const pubDate = new Date(published.getText())
          if (pubDate < cutoffDate) return
          
          const titleRaw = entry.getChild('title', atomNamespace)?.getText() || 'No title'
          const title = decodeHtmlEntities(titleRaw)
          
          const summary = entry.getChild('summary', atomNamespace)
          const description = summary ? cleanTextSpacing(summary.getText()) : ''
          
          // Get ArXiv ID and construct link
          const idElement = entry.getChild('id', atomNamespace)
          const arxivId = idElement ? idElement.getText().split('/').pop() : ''
          const link = arxivId ? `https://arxiv.org/abs/${arxivId}` : ''
          
          // Get authors
          const authors = entry.getChildren('author', atomNamespace)
          const authorNames = authors.map(author => {
            const name = author.getChild('name', atomNamespace)?.getText()
            return name || ''
          }).filter(name => name).join(', ')
          
          const source = authorNames ? `ArXiv (${authorNames})` : 'ArXiv'
          
          items.push({
            date: pubDate,
            source: source,
            title: title,
            description: description,
            link: link,
            imageUrl: '' // ArXiv doesn't provide images
          })
        } catch (error) {
          Logger.log(`Error parsing ArXiv entry: ${error.message}`)
        }
      })
      
      return items
    } catch (error) {
      Logger.log(`Error parsing ArXiv feed: ${error.message}`)
      Logger.log(`Error stack: ${error.stack}`)
      return []
    }
  }
  
  // Public API
  return {
    parseFeed: parseFeed,
    parseFeedContent: parseFeedContent,
    parseArxiv: parseArxiv,
    decodeHtmlEntities: decodeHtmlEntities,
    cleanTextSpacing: cleanTextSpacing,
    isValidImageUrl: isValidImageUrl
  }
})()

