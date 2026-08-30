// ai-context: Generates the sum of two numbers
// ai-body: off
function sum(a, b) {
  const total = a + b;
  return total;
}

// ai-context: Multiplies two numbers together
function mul(a, b) {
  return a * b;
}

class Calculator {
  // ai-context: Adds a value to the running total
  // ai-body: off
  add(value) {
    this.total = (this.total ?? 0) + value;
    return this.total;
  }
}
