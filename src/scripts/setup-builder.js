/**
 * Zero-Latency Setup Builder Engine
 * Handles local state and Amazon multi-item integration.
 */

class SetupBuilder extends HTMLElement {
  constructor() {
    super();
    this.items = [];
    try {
      this.items = JSON.parse(localStorage.getItem('selectstream_setup') || '[]');
    } catch (e) {
      this.items = [];
    }
  }

  connectedCallback() {
    // Initial render and setup event listeners
    this.updateGlobalState();
    
    window.addEventListener('add-to-setup', (e) => {
      this.addItem(e.detail);
    });

    window.addEventListener('remove-from-setup', (e) => {
      this.removeItem(e.detail);
    });

    window.addEventListener('request-setup-checkout', () => {
      const url = this.getCheckoutUrl();
      if (this.items.length > 0) {
        window.open(url, '_blank');
      } else {
        alert('Your setup is empty. Add some essentials first.');
      }
    });
  }

  addItem(product) {
    if (!this.items.find(item => item.id === product.id)) {
      this.items.push(product);
      this.save();
      console.log(`[SetupBuilder] Added: ${product.title}`);
    } else {
      console.log(`[SetupBuilder] ${product.title} already in setup.`);
    }
  }

  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.save();
  }

  removeItems(ids) {
    this.items = this.items.filter(item => !ids.includes(item.id));
    this.save();
  }

  save() {
    localStorage.setItem('selectstream_setup', JSON.stringify(this.items));
    this.updateGlobalState();
  }

  updateGlobalState() {
    window.dispatchEvent(new CustomEvent('setup-updated', { detail: this.items }));
  }

  async syncToCloud(email) {
    if (!email) return { success: false, message: 'Email required.' };
    
    try {
      const response = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, items: this.items })
      });
      
      const data = await response.json();
      if (response.ok) {
        console.log(`[SetupBuilder] Cloud Sync: ${data.message}`);
        return { success: true, message: data.message };
      }
      throw new Error(data.message);
    } catch (e) {
      console.error('[SetupBuilder] Sync Failed:', e.message);
      return { success: false, message: e.message };
    }
  }

  getCheckoutUrl() {
    // Amazon multi-item "Add to Cart" URL format
    const baseUrl = "https://www.amazon.com/gp/aws/cart/add.html";
    const params = new URLSearchParams({
      AssociateTag: "selectstream-20",
    });

    this.items.forEach((item, index) => {
      if (item.asin) {
        params.append(`ASIN.${index + 1}`, item.asin);
        params.append(`Quantity.${index + 1}`, "1");
      }
    });

    return `${baseUrl}?${params.toString()}`;
  }
}

if (!customElements.get('setup-builder')) {
  customElements.define('setup-builder', SetupBuilder);
}
