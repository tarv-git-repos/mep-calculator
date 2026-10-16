// Calculator Loader and Registry
(function() {
  window.CalculatorRegistry = window.CalculatorRegistry || {};

  window.registerCalculator = function(config) {
    window.CalculatorRegistry[config.id] = config;
  };

  window.loadCalculator = function(id) {
    const container = document.getElementById('calculator-container');
    const template = window.CalculatorTemplates ? window.CalculatorTemplates[id] : null;

    console.log("Loading calculator:", id);
    console.log("Template found:", template);
    console.log("Container:", container);

    if (!container) {
      console.warn("Target container 'calculator-container' not found!");
      return null;
    }

    if (!template) {
      console.warn("Template not found for calculator ID:", id);
      return null;
    }

    let pageDiv = document.getElementById('page-' + id);
    if (!pageDiv) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = template.trim();
      pageDiv = tempDiv.firstElementChild;
      if (pageDiv) {
        pageDiv.id = 'page-' + id;
        if (id === 'home') {
          pageDiv.classList.add('active');
          pageDiv.style.maxWidth = 'none!important';
        }
        container.appendChild(pageDiv);
      }
    }
    return pageDiv;
  };

  // Render all registered pages immediately
  const container = document.getElementById('calculator-container');
  if (container && window.CalculatorTemplates) {
    Object.keys(window.CalculatorTemplates).forEach(id => {
      window.loadCalculator(id);
    });
  }

  // Setup Event Delegation for data-action-* attributes
  function setupEventDelegation() {
    const events = ['click', 'change', 'input', 'keydown', 'mouseover', 'mouseout'];
    
    events.forEach(evtName => {
      document.addEventListener(evtName, (e) => {
        const attrName = 'data-action-' + evtName;
        const target = e.target.closest('[' + attrName + ']');
        if (target) {
          const expr = target.getAttribute(attrName);
          try {
            const fn = new Function('event', expr);
            fn.call(target, e);
          } catch (err) {
            console.error('Error executing delegated ' + evtName + ' action:', expr, err);
          }
        }
      });
    });

    // Handle blur separately (does not bubble, use capture phase)
    document.addEventListener('blur', (e) => {
      const target = e.target.closest('[data-action-blur]');
      if (target) {
        const expr = target.getAttribute('data-action-blur');
        try {
          const fn = new Function('event', expr);
          fn.call(target, e);
        } catch (err) {
          console.error('Error executing delegated blur action:', expr, err);
        }
      }
    }, true);
  }

  setupEventDelegation();
})();
