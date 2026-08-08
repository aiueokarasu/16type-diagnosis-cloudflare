const Storage = {
  key: "sixteenTypeDiagnosis",
  save(result) { localStorage.setItem(this.key, JSON.stringify(result)); },
  get() { try { return JSON.parse(localStorage.getItem(this.key)); } catch { return null; } },
  clear() { localStorage.removeItem(this.key); }
};
