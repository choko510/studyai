// JS Injection functionality
class JSInjector {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const response = await fetch('/js-injection-config.json');
      this.config = await response.json();
    } catch (error) {
      console.error('Failed to load JS injection config:', error);
      this.config = { injections: [] };
    }
  }

  // Check if current URL matches any injection patterns
  shouldInject(currentUrl) {
    if (!this.config || !this.config.injections) return [];
    
    return this.config.injections.filter(injection => {
      if (!injection.enabled) return false;
      
      // Simple pattern matching - can be enhanced
      return currentUrl.includes(injection.url_pattern);
    });
  }

  // Inject scripts into the iframe
  injectScripts(iframe, injections) {
    if (!iframe || !iframe.contentDocument || !injections.length) return;

    const doc = iframe.contentDocument;
    
    injections.forEach(injection => {
          injection.js_urls.forEach(jsUrl => {
            // Convert relative URLs to absolute URLs
            const absoluteUrl = jsUrl.startsWith('http') ? jsUrl :
              `${window.location.origin}/${jsUrl.replace(/^\/+/, '')}`;
            
            // Check if script is already injected
            const existingScript = doc.querySelector(`script[data-injected-url="${jsUrl}"]`);
            if (existingScript) return;
    
            // Try to fetch the script content and inject it directly
            fetch(absoluteUrl)
              .then(response => response.text())
              .then(scriptContent => {
                const script = doc.createElement('script');
                script.type = 'text/javascript';
                script.setAttribute('data-injected-url', jsUrl);
                script.textContent = scriptContent;
                
                // Add error handling
                try {
                  doc.head.appendChild(script);
                  console.log(`Successfully injected: ${jsUrl}`);
                } catch (error) {
                  console.error(`Failed to inject script: ${jsUrl}`, error);
                }
              })
              .catch(error => {
                console.error(`Failed to fetch script: ${jsUrl}`, error);
                // Fallback: try injecting as external script
                const script = doc.createElement('script');
                script.src = absoluteUrl;
                script.type = 'text/javascript';
                script.setAttribute('data-injected-url', jsUrl);
                script.crossOrigin = 'anonymous';
                script.onload = () => {
                  console.log(`Successfully injected (fallback): ${jsUrl}`);
                };
                script.onerror = () => {
                  console.error(`Failed to inject (fallback): ${jsUrl}`);
                };
                
                try {
                  doc.head.appendChild(script);
                } catch (error) {
                  console.error(`Failed to append script: ${jsUrl}`, error);
                }
              });
          });
        });
  }

  // Monitor iframe URL changes and inject when needed
  monitorIframe(iframe) {
    if (!iframe) return;

    // Initial check
    this.checkAndInject(iframe);

    // Monitor for URL changes
    let lastUrl = '';
    const checkUrl = () => {
      try {
        const currentUrl = iframe.contentWindow.location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          // Wait a bit more for the page to fully load
          setTimeout(() => {
            this.checkAndInject(iframe);
          }, 2000);
        }
      } catch (error) {
        // Cross-origin restrictions - this is expected
      }
    };

    // Check periodically
    setInterval(checkUrl, 2000);

    // Also check on iframe load events
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        this.checkAndInject(iframe);
      }, 1500);
    });

    // Add additional event listeners for better detection
    iframe.addEventListener('loadstart', () => {
      console.log('Iframe load started');
    });

    iframe.addEventListener('loadend', () => {
      setTimeout(() => {
        this.checkAndInject(iframe);
      }, 500);
    });
  }

  checkAndInject(iframe) {
    try {
      const currentUrl = iframe.contentWindow.location.href;
      const injections = this.shouldInject(currentUrl);
      
      if (injections.length > 0) {
        console.log(`Injecting scripts for URL: ${currentUrl}`);
        this.injectScripts(iframe, injections);
      }
    } catch (error) {
      // Cross-origin restrictions - this is expected for some sites
    }
  }

  // Update config (for future admin interface)
  async updateConfig(newConfig) {
    this.config = newConfig;
    // In a real implementation, you'd save this to the server
    console.log('Config updated:', newConfig);
  }
}

// Global instance
window.jsInjector = new JSInjector();
