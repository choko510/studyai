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
        // Check if script is already injected
        const existingScript = doc.querySelector(`script[src="${jsUrl}"]`);
        if (existingScript) return;

        const script = doc.createElement('script');
        script.src = jsUrl;
        script.type = 'text/javascript';
        script.onload = () => {
          console.log(`Successfully injected: ${jsUrl}`);
        };
        script.onerror = () => {
          console.error(`Failed to inject: ${jsUrl}`);
        };
        
        doc.head.appendChild(script);
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
          // Wait a bit for the page to load
          setTimeout(() => {
            this.checkAndInject(iframe);
          }, 1000);
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
      }, 1000);
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
