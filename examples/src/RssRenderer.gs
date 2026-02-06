/**
 * RSS Renderer Module
 * Handles rendering of feed items to Google Docs
 */
var RssRenderer = {
  /**
   * Process items (sort, group) and render
   * @param {Body} body - The document body to render to
   * @param {Array} items - The feed items to render
   */
  processAndRenderItems: function(body, items) {
    if (items.length === 0) {
      const para = body.appendParagraph('No items found.')
      para.setForegroundColor(CONFIG.THEME.NO_ITEMS_COLOR)
      para.setItalic(true)
      return
    }

    // Sort by date (newest first)
    items.sort((a, b) => new Date(b.date) - new Date(a.date))

    const itemsByDate = this.groupItemsByDate(items)
    this.writeItemsToBody(body, itemsByDate)
  },

  /**
   * Group items by date
   */
  groupItemsByDate: function(items) {
    const groups = {}
    
    items.forEach(item => {
      const dateObj = new Date(item.date)
      const dateKey = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'MMMM dd, yyyy')
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateObj,
          items: []
        }
      }
      groups[dateKey].items.push(item)
    })
    
    return groups
  },

  /**
   * Write grouped items to the document body
   * @param {Body} body - The document body
   * @param {Object} itemsByDate - Items grouped by date
   */
  writeItemsToBody: function(body, itemsByDate) {
    // Sort dates
    const sortedDates = Object.keys(itemsByDate).sort((a, b) => {
      return itemsByDate[b].date - itemsByDate[a].date
    })

    // Check if image loading is enabled (default: true)
    const loadImages = CONFIG.SETTINGS.LOAD_IMAGES !== false

    // Pre-fetch images in parallel (only if enabled)
    const imageMap = new Map()
    const fallbackSet = new Set()

    if (loadImages) {
      const imageRequests = []
      const imageUrls = []
      // Map to store link for each image URL to derive domain for fallback
      const urlToLinkMap = new Map()

      sortedDates.forEach(dateKey => {
        const dateGroup = itemsByDate[dateKey]
        dateGroup.items.forEach(item => {
          if (item.imageUrl && RssParser.isValidImageUrl(item.imageUrl)) {
            imageRequests.push({
              url: item.imageUrl,
              muteHttpExceptions: true
            })
            imageUrls.push(item.imageUrl)
            urlToLinkMap.set(item.imageUrl, item.link)
          }
        })
      })

      if (imageRequests.length > 0) {
        Logger.log(`Fetching ${imageRequests.length} images...`)

        try {
          const responses = UrlFetchApp.fetchAll(imageRequests)
          const fallbackRequests = []
          const fallbackOriginalUrls = []

          responses.forEach((response, i) => {
            const url = imageUrls[i]
            const code = response.getResponseCode()
            const blob = response.getBlob()
            const type = blob.getContentType()

            if (code === 200 && type.startsWith('image/') && type !== 'image/webp') {
              // Check size limit (5MB)
              if (blob.getBytes().length > 5 * 1024 * 1024) {
                Logger.log(`Image too large (${Math.round(blob.getBytes().length / 1024 / 1024)}MB): ${url}. Fallback to logo.`)
                // Trigger fallback by not setting it in imageMap
                const link = urlToLinkMap.get(url)
                const domain = this.extractDomain(link)
                if (domain) {
                  const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
                  fallbackRequests.push({
                    url: logoUrl,
                    muteHttpExceptions: true
                  })
                  fallbackOriginalUrls.push(url)
                }
              } else {
                imageMap.set(url, blob)
              }
            } else {
              // Fallback to logo if WebP or failure
              if (type === 'image/webp') {
                Logger.log(`WebP detected for ${url}. Attempting fallback to source logo.`)
              } else {
                Logger.log(`Image fetch failed for ${url} (Code: ${code}). Attempting fallback to source logo.`)
              }

              const link = urlToLinkMap.get(url)
              const domain = this.extractDomain(link)
              if (domain) {
                const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
                fallbackRequests.push({
                  url: logoUrl,
                  muteHttpExceptions: true
                })
                fallbackOriginalUrls.push(url)
              }
            }
          })

          // Execute fallback fetches
          if (fallbackRequests.length > 0) {
            Logger.log(`Fetching ${fallbackRequests.length} fallback logos...`)
            try {
              const logoResponses = UrlFetchApp.fetchAll(fallbackRequests)
              logoResponses.forEach((res, i) => {
                if (res.getResponseCode() === 200) {
                  const blob = res.getBlob()
                  if (blob.getContentType().startsWith('image/')) {
                    const originalUrl = fallbackOriginalUrls[i]
                    imageMap.set(originalUrl, blob)
                    fallbackSet.add(originalUrl)
                  }
                }
              })
            } catch (e) {
              Logger.log(`Fallback logo fetch failed: ${e.message}`)
            }
          }

        } catch (e) {
          Logger.log(`Batch image fetch failed: ${e.message}. Continuing without images.`)
        }
      }
    } else {
      Logger.log('Image loading disabled (LOAD_IMAGES=false)')
    }
    
    // Render items
    sortedDates.forEach(dateKey => {
      const dateGroup = itemsByDate[dateKey]
      
      // Date Header
      const dateHeader = body.appendParagraph(dateKey)
      dateHeader.setHeading(DocumentApp.ParagraphHeading.HEADING2)
      dateHeader.setFontFamily(CONFIG.THEME.FONT_FAMILY)
      dateHeader.setForegroundColor(CONFIG.THEME.HEADING_COLOR)
      
      dateGroup.items.forEach(item => {
        // Title (Now First and Larger - H3)
        const titlePara = body.appendParagraph(item.title)
        titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING3)
        titlePara.setFontFamily(CONFIG.THEME.FONT_FAMILY)
        titlePara.setForegroundColor(CONFIG.THEME.HEADING_COLOR)

        // Source (Now Second and Smaller - H4)
        const sourcePara = body.appendParagraph(item.source)
        sourcePara.setHeading(DocumentApp.ParagraphHeading.HEADING4)
        sourcePara.setFontFamily(CONFIG.THEME.FONT_FAMILY)
        sourcePara.setForegroundColor(CONFIG.THEME.HEADING_COLOR)
        
        // Image
        if (item.imageUrl && imageMap.has(item.imageUrl)) {
          try {
            const image = body.appendImage(imageMap.get(item.imageUrl))
            const originalWidth = image.getWidth()
            const originalHeight = image.getHeight()
            
            // Check if it's a fallback logo
            const isFallback = fallbackSet.has(item.imageUrl)
            const targetWidth = isFallback ? 80 : 400 // 80 is 20% of 400
            
            // Calculate new height to maintain aspect ratio
            const targetHeight = Math.round((originalHeight / originalWidth) * targetWidth)
            
            image.setWidth(targetWidth)
            image.setHeight(targetHeight)
          } catch (e) {
            const blob = imageMap.get(item.imageUrl)
            const type = blob ? blob.getContentType() : 'unknown'
            const size = blob ? blob.getBytes().length : 0
            Logger.log(`Failed to insert image (${item.imageUrl}): ${e.message}. Type: ${type}, Size: ${size}`)
          }
        }
        
        // Description
        const descPara = body.appendParagraph('')
        this.parseAndInsertHtml(descPara, item.description)
        descPara.setSpacingAfter(12)
        
        // Link
        if (item.link) {
          const linkPara = body.appendParagraph('Read more →')
          linkPara.setLinkUrl(item.link)
          linkPara.setFontFamily(CONFIG.THEME.FONT_FAMILY)
          linkPara.setForegroundColor(CONFIG.THEME.LINK_COLOR)
          linkPara.setUnderline(true)
          linkPara.setSpacingAfter(24)
        }
      })
    })
  },

  /**
   * Parse HTML content and insert into paragraph with formatting
   */
  parseAndInsertHtml: function(paragraph, htmlContent) {
    if (!htmlContent || !htmlContent.trim()) return
    
    try {
      htmlContent = RssParser.decodeHtmlEntities(htmlContent)
      htmlContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      htmlContent = htmlContent.replace(/<(?:iframe|object|embed|form)[^>]*>[\s\S]*?<\/(?:iframe|object|embed|form)>/gi, '')
      
      // Combined pattern for quoted and unquoted hrefs
      const linkPattern = /<a[^>]+href\s*=\s*(?:["']([^"']+)["']|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi
      
      const segments = []
      let lastIndex = 0
      let foundLinks = false
      
      let match
      while ((match = linkPattern.exec(htmlContent)) !== null) {
        foundLinks = true
        
        if (match.index > lastIndex) {
          const beforeText = htmlContent.substring(lastIndex, match.index)
          const cleanText = this.cleanHtmlText(beforeText)
          if (cleanText) {
            segments.push({ type: 'text', content: cleanText, index: match.index })
          }
        }
        
        let linkUrl = match[1] || match[2]
        linkUrl = RssParser.decodeHtmlEntities(linkUrl)
        linkUrl = linkUrl.replace(/&amp;/g, '&')
        
        let linkTextRaw = match[3]
        linkTextRaw = linkTextRaw.replace(/<[^>]+>/g, '')
        const linkText = this.cleanHtmlText(linkTextRaw) || linkUrl
        
        segments.push({ 
          type: 'link', 
          url: linkUrl, 
          text: linkText,
          index: match.index 
        })
        
        lastIndex = match.index + match[0].length
      }
      
      segments.sort((a, b) => a.index - b.index)
      
      if (foundLinks && lastIndex < htmlContent.length) {
        const afterText = htmlContent.substring(lastIndex)
        const cleanText = this.cleanHtmlText(afterText)
        if (cleanText) {
          segments.push({ type: 'text', content: cleanText, index: htmlContent.length })
        }
      }
      
      if (!foundLinks || segments.length === 0) {
        const plainText = this.cleanHtmlText(htmlContent)
        if (plainText) {
          const limitedText = plainText.length > 1000 ? plainText.substring(0, 1000) + '...' : plainText
          const textElement = paragraph.appendText(limitedText)
          textElement.setFontFamily(CONFIG.THEME.FONT_FAMILY)
        }
        return
      }
      
      segments.forEach((segment, index) => {
        if (segment.type === 'text') {
          let textContent = segment.content
          if (index > 0 && segments[index - 1].type === 'link') {
            textContent = ' ' + textContent
          }
          
          const limitedText = textContent.length > 1000 ? textContent.substring(0, 1000) + '...' : textContent
          if (limitedText) {
            const textElement = paragraph.appendText(limitedText)
            textElement.setFontFamily(CONFIG.THEME.FONT_FAMILY)
          }
        } else if (segment.type === 'link') {
          if (index > 0) {
            if (segments[index - 1].type === 'link') {
              const separator = paragraph.appendText(' | ')
              separator.setFontFamily(CONFIG.THEME.FONT_FAMILY)
              separator.setForegroundColor(CONFIG.THEME.SEPARATOR_COLOR)
              separator.setUnderline(false)
            } else {
              const spaceText = paragraph.appendText(' ')
              spaceText.setFontFamily(CONFIG.THEME.FONT_FAMILY)
              spaceText.setForegroundColor(CONFIG.THEME.SEPARATOR_COLOR)
              spaceText.setUnderline(false)
            }
          }
          
          const linkText = paragraph.appendText(segment.text || segment.url)
          linkText.setLinkUrl(segment.url)
          linkText.setForegroundColor(CONFIG.THEME.LINK_COLOR)
          linkText.setFontFamily(CONFIG.THEME.FONT_FAMILY)
          linkText.setUnderline(true)
        }
      })
      
    } catch (error) {
      Logger.log(`Error parsing HTML: ${error.message}`)
      const plainText = this.cleanHtmlText(htmlContent)
      if (plainText) {
        const limitedText = plainText.length > 1000 ? plainText.substring(0, 1000) + '...' : plainText
        const textElement = paragraph.appendText(limitedText)
        textElement.setFontFamily(CONFIG.THEME.FONT_FAMILY)
      }
    }
  },

  /**
   * Clean HTML text content
   */
  cleanHtmlText: function(text) {
    if (!text) return ''
    text = text.replace(/<[^>]+>/g, ' ')
    text = RssParser.decodeHtmlEntities(text)
    text = text.replace(/[\s\u00A0\u200B]+/g, ' ')
    return text.trim()
  },

  /**
   * Extract domain from URL
   */
  extractDomain: function(url) {
    if (!url) return null
    try {
      const match = url.match(/^https?:\/\/([^\/?#]+)(?:[\/?#]|$)/i)
      return match && match[1]
    } catch (e) {
      return null
    }
  }
}
