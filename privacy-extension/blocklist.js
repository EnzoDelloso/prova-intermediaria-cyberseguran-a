
const CustomBlocklist = {
  domains: new Set(),

  async load() {
    const stored = await browser.storage.local.get("customBlocklist");
    if (stored.customBlocklist) {
      this.domains = new Set(stored.customBlocklist);
    }
  },

  async add(domain) {
    this.domains.add(domain);
    await this.persist();
  },

  async remove(domain) {
    this.domains.delete(domain);
    await this.persist();
  },

  has(domain) {
    return this.domains.has(domain);
  },

  async persist() {
    await browser.storage.local.set({ customBlocklist: Array.from(this.domains) });
  }
};

CustomBlocklist.load();
