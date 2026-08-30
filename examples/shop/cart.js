export class Cart {
  constructor() {
    this.items = [];
  }

  // ai-context: Adds a SKU line; quantity defaults to 1
  add(sku, quantity = 1) {
    this.items.push({ sku, quantity });
  }

  // ai-context: Running total after catalog lookup
  // ai-deps: findProduct
  total() {
    return this.items.reduce((sum, line) => {
      const product = findProduct(line.sku);
      return sum + product.price * line.quantity;
    }, 0);
  }
}

// ai-context: Looks up a product by SKU in the catalog
export function findProduct(sku) {
  return { sku, price: 10 };
}
