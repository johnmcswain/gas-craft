/**
 * AI Advisor Feed - RSS Feed Aggregator
 * Updates document tabs with RSS feed content
 */

/**
 * Triggered when the document opens
 */
function onOpen() {
  try {
    const ui = DocumentApp.getUi()
    const menu = ui.createMenu('AI Feed')
    menu.addItem('Refresh', 'refreshAllTabs')
    menu.addSeparator()
    menu.addItem('Get NotebookLM Import URL', 'generateNotebookLMUrl')
    menu.addToUi()
    Logger.log('Menu created. Use "AI Feed > Refresh" to update tabs.')
  } catch (error) {
    Logger.log(`Error in onOpen: ${error.message}`)
  }
}

/**
 * Refresh all tabs - called from menu
 */
function refreshAllTabs() {
  try {
    Logger.log('Starting refresh...')
    const doc = DocumentApp.getActiveDocument()
    updateAllTabsWithRetry(doc)
    Logger.log('Refresh complete!')
  } catch (error) {
    Logger.log(`Error refreshing tabs: ${error.message}`)
    DocumentApp.getUi().alert(`Error refreshing tabs: ${error.message}`)
  }
}

/**
 * Update all tabs with retry logic
 */
function updateAllTabsWithRetry(doc, attempt, maxAttempts) {
  attempt = attempt || 1
  maxAttempts = maxAttempts || CONFIG.SETTINGS.MAX_RETRIES

  try {
    if (attempt === 1) Utilities.sleep(500)

    let tabs
    try {
      tabs = doc.getTabs()
    } catch (e) {
      throw new Error(`Error getting tabs: ${e.message}`)
    }

    if (!tabs || tabs.length === 0) throw new Error('No tabs found')

    // Verify access
    try {
      const testTab = tabs[0]
      doc.getTab(testTab.getId()).asDocumentTab().getBody()
    } catch (e) {
      throw new Error(`Tabs not ready: ${e.message}`)
    }

    Logger.log(`Attempt ${attempt}: Tabs are ready, updating...`)
    updateAllTabs(doc)

  } catch (error) {
    Logger.log(`Attempt ${attempt} failed: ${error.message}`)

    if (attempt < maxAttempts) {
      const delay = attempt * CONFIG.SETTINGS.RETRY_DELAY_MS
      Logger.log(`Retrying in ${delay}ms...`)
      Utilities.sleep(delay)
      return updateAllTabsWithRetry(doc, attempt + 1, maxAttempts)
    } else {
      Logger.log('Max retries reached')
      DocumentApp.getUi().alert(`Failed to update tabs after ${maxAttempts} attempts. Please try again.`)
    }
  }
}

/**
 * Update all tabs with their respective content
 */
function updateAllTabs(doc) {
  const tabs = doc.getTabs()
  const errors = []

  tabs.forEach((tab) => {
    const title = tab.getTitle()
    if (!title) return

    try {
      const tabBody = doc.getTab(tab.getId()).asDocumentTab().getBody()

      if (title === 'Commercial Research') {
        updateCommercialResearchTab(tabBody, errors)
      } else if (title === 'Academic Research') {
        updateAcademicResearchTab(tabBody, errors)
      }
    } catch (e) {
      errors.push(`Failed to update tab "${title}": ${e.message}`)
    }
  })

  if (errors.length > 0) {
    reportErrors(doc, errors)
  }
}

/**
 * Update Commercial Research tab
 */
function updateCommercialResearchTab(body, errors) {
  Logger.log('Updating Commercial Research tab')
  setupTab(body, 'Commercial Research')

  if (typeof COMMERCIAL_RESEARCH_FEEDS === 'undefined') {
    body.appendParagraph('Error: Feed URLs not configured.')
    return
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - CONFIG.SETTINGS.COMMERCIAL_DAYS_LOOKBACK)

  Logger.log(`Fetching ${COMMERCIAL_RESEARCH_FEEDS.length} RSS sources...`)

  // Use CacheManager to handle fetching and caching
  const allItems = CacheManager.fetchAndCacheFeeds(
    COMMERCIAL_RESEARCH_FEEDS,
    sevenDaysAgo,
    errors
  )

  Logger.log(`Found ${allItems.length} articles, filtering...`)

  // Filter items to limit posts per source per day
  const filteredItems = filterItemsBySourceAndDay(allItems)

  Logger.log(`Writing ${filteredItems.length} articles to document`)

  RssRenderer.processAndRenderItems(body, filteredItems)
}

/**
 * Update Academic Research tab
 */
function updateAcademicResearchTab(body, errors) {
  Logger.log('Updating Academic Research tab')
  setupTab(body, 'Academic Research')

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - CONFIG.SETTINGS.ACADEMIC_MONTHS_LOOKBACK)

  const query = CONFIG.ARXIV.SEARCH_QUERY
  const cacheKey = `arxiv_${Utilities.base64Encode(query)}`

  // Try cache first
  let items = CacheManager.get(cacheKey)

  if (items) {
    Logger.log(`Loaded ${items.length} ArXiv papers from cache`)
  } else {
    Logger.log('Fetching ArXiv API...')

    // Fetch if not in cache
    // Use global ARXIV_API_URL from FeedUrls.gs
    if (typeof ARXIV_API_URL === 'undefined') {
      errors.push('Error: ArXiv API URL not configured.')
      return
    }

    items = RssParser.parseArxiv(query, cutoffDate, ARXIV_API_URL)

    if (items.length > 0) {
      // Use longer cache duration for academic content (6 hours)
      CacheManager.putWithDuration(cacheKey, items, CONFIG.SETTINGS.ACADEMIC_CACHE_DURATION_SECONDS)
    }
  }

  Logger.log(`Writing ${items.length} papers to document`)

  RssRenderer.processAndRenderItems(body, items)
}

/**
 * Helper: Setup tab with header and timestamp
 */
function setupTab(body, title) {
  body.clear()
  
  const header = body.appendParagraph(title)
  header.setHeading(DocumentApp.ParagraphHeading.HEADING1)
  header.setFontFamily(CONFIG.THEME.FONT_FAMILY)
  header.setForegroundColor(CONFIG.THEME.HEADING_COLOR)
  header.setSpacingAfter(12)
  
  const updateDate = body.appendParagraph(
    `Last updated: ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy')}`
  )
  updateDate.setForegroundColor(CONFIG.THEME.DATE_COLOR)
  updateDate.setFontSize(10)
  updateDate.setFontFamily(CONFIG.THEME.FONT_FAMILY)
  updateDate.setSpacingAfter(24)
}

/**
 * Helper: Report errors at the end of the document
 */
function reportErrors(doc, errors) {
  try {
    const tabs = doc.getTabs()
    const mainTab = tabs.find(t => t.getTitle() === 'Commercial Research')
    if (mainTab) {
      const body = doc.getTab(mainTab.getId()).asDocumentTab().getBody()
      
      body.appendParagraph('') // Spacer
      const header = body.appendParagraph('⚠️ Status Report')
      header.setHeading(DocumentApp.ParagraphHeading.HEADING2)
      header.setForegroundColor(CONFIG.THEME.ERROR_COLOR)
      
      errors.forEach(err => {
        const p = body.appendParagraph(`• ${err}`)
        p.setForegroundColor(CONFIG.THEME.ERROR_COLOR)
        p.setFontSize(9)
      })
    }
  } catch (e) {
    Logger.log(`Failed to report errors: ${e.message}`)
  }
}

/**
 * Generate NotebookLM import URL
 */
function generateNotebookLMUrl() {
  try {
    const doc = DocumentApp.getActiveDocument()
    const docUrl = doc.getUrl()
    const notebookLMUrl = `https://notebooklm.google.com/?import=${encodeURIComponent(docUrl)}`
    
    const ui = DocumentApp.getUi()
    const htmlOutput = HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body { font-family: 'Roboto', sans-serif; padding: 20px; color: #202124; }
            .url-container { background: #f1f3f4; padding: 12px; margin: 15px 0; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; }
            .button { background-color: #1a73e8; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 500; text-decoration: none; display: inline-block; margin-right: 10px; }
            .button:hover { background-color: #1765cc; box-shadow: 0 1px 2px rgba(60,64,67,0.3); }
            .secondary-button { background-color: white; color: #1a73e8; border: 1px solid #dadce0; }
            .secondary-button:hover { background-color: #f8f9fa; color: #174ea6; }
            h2 { font-size: 18px; margin-top: 0; }
            p { font-size: 14px; line-height: 1.5; color: #5f6368; }
            .steps { margin: 15px 0; padding-left: 20px; font-size: 14px; color: #3c4043; }
            .steps li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <h2>Add to NotebookLM</h2>
          <p>NotebookLM does not currently support direct import links. Please follow these steps:</p>
          
          <ol class="steps">
            <li>Copy this document's URL below.</li>
            <li>Open NotebookLM in a new tab.</li>
            <li>Create a new notebook (or open an existing one).</li>
            <li>Click <strong>Add Source</strong> > <strong>Google Docs</strong> (or Website) and paste/select this document.</li>
          </ol>

          <div class="url-container" id="docUrl">${docUrl}</div>
          
          <div style="display: flex; align-items: center;">
            <button class="button secondary-button" onclick="copyUrl()">Copy URL</button>
            <a href="https://notebooklm.google.com/" target="_blank" class="button">Open NotebookLM</a>
          </div>

          <script>
            function copyUrl() {
              const url = document.getElementById('docUrl').innerText;
              navigator.clipboard.writeText(url).then(() => {
                const btn = document.querySelector('.secondary-button');
                const originalText = btn.innerText;
                btn.innerText = 'Copied!';
                setTimeout(() => btn.innerText = originalText, 2000);
              });
            }
          </script>
        </body>
      </html>
    `).setWidth(500).setHeight(450)
    
    ui.showModalDialog(htmlOutput, 'NotebookLM Import URL')
  } catch (error) {
    DocumentApp.getUi().alert(`Error: ${error.message}`)
  }
}

/**
 * Filter items to limit posts per source per day.
 * Keeps the most recent posts for each source/day combination.
 */
function filterItemsBySourceAndDay(items) {
  if (!items || items.length === 0) return []
  
  // Sort by date descending, but prioritize NVIDIA posts for the same day
  const sortedItems = [...items].sort((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)
    
    // Compare dates (YYYY-MM-DD)
    const dayA = dateA.toISOString().split('T')[0]
    const dayB = dateB.toISOString().split('T')[0]
    
    if (dayA === dayB) {
      // If same day, check for NVIDIA source
      const isNvidiaA = (a.source || '').toLowerCase().includes('nvidia')
      const isNvidiaB = (b.source || '').toLowerCase().includes('nvidia')
      
      if (isNvidiaA && !isNvidiaB) return -1
      if (!isNvidiaA && isNvidiaB) return 1
      
      // If both or neither, sort by time newest first
      return dateB - dateA
    }
    
    // Different days: newest first
    return dateB - dateA
  })
  
  const counts = {}
  const filtered = []
  const maxPerDay = CONFIG.SETTINGS.MAX_POSTS_PER_SOURCE_PER_DAY || 2
  
  for (const item of sortedItems) {
    // Create a key based on source and date (YYYY-MM-DD)
    const dateStr = new Date(item.date).toISOString().split('T')[0]
    const key = `${item.source}_${dateStr}`
    
    if (!counts[key]) {
      counts[key] = 0
    }
    
    if (counts[key] < maxPerDay) {
      filtered.push(item)
      counts[key]++
    }
  }
  
  return filtered
}
