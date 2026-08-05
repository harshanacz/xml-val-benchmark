# xml-val-benchmark

Publication-grade performance benchmark comparing WebAssembly XML validation engines: **`xmllint-wasm`** vs **`xerces-wasm`**.

---

## 🔬 Benchmark Methodology & Rigor

This benchmark enforces standard benchmarking best practices:
1. **Isolated Subprocess Cold-Starts:** Every cold-start measurement is executed in a dedicated, fresh Node.js subprocess to prevent WASM runtime/module warm contamination across tests.
2. **Correctness Assertions:** Every iteration asserts that `valid === true`. No engine can short-circuit or report unvalidated execution times.
3. **Statistical Sampling (n=5 trials):** Warm loops are executed across 5 measurement trials of 1,000 iterations each, reporting `Mean`, `Standard Deviation`, `Min`, and `Max`.
4. **Interleaved Execution & GC Isolation:** Execution order is alternated (`A -> B`, `B -> A`) between trials, with `global.gc()` triggered before timing blocks to eliminate Garbage Collection pauses and order bias.
5. **System Metadata Logging:** System hardware, OS kernel, and Node.js runtime environment details are captured.

---

## 📊 Benchmark Results

### Environment Baseline
- **Hardware:** Apple M4 (arm64)
- **OS:** Darwin 25.6.0
- **Runtime:** Node.js v22.22.1 (`--expose-gc`)
- **Iterations / Trial:** 1,000 | **Measurement Trials:** 5 (Interleaved)

---

### Test 1: Single Schema Benchmark (`sample.xsd`)

| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 49.45 ms | 22,484.05 ms (±902.97 ms) | 21,632.86 ms / 24,211.91 ms | Baseline |
| **`xerces-wasm`** | **25.61 ms** | **40.46 ms (±4.49 ms)** | **36.68 ms / 49.19 ms** | **555.6x faster** |

---

### Test 2: Multi-File Modular Schemas (4 Included XSDs)
*Structure:* `order.xsd` (includes `customer.xsd` & `product.xsd`, which includes `address.xsd`).

| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 35.28 ms | 23,395.49 ms (±129.34 ms) | 23,191.64 ms / 23,573.36 ms | Baseline |
| **`xerces-wasm`** | **24.71 ms** | **70.29 ms (±1.12 ms)** | **69.14 ms / 71.91 ms** | **332.8x faster** |

---

### 📋 Scientific Output Log

```text
======================================================================
 RIGOROUS XML VALIDATION BENCHMARK SUITE
======================================================================
 System Info: Darwin 25.6.0 (arm64) | CPU: Apple M4
 Runtime: Node.js v22.22.1 | Iterations/Trial: 1000 | Trials: 5
======================================================================

----------------------------------------------------------------------
 TEST 1: Single Schema Benchmark (sample.xsd)
----------------------------------------------------------------------
 Measuring Isolated Cold Start... Done.
   - xmllint-wasm cold: 49.45 ms
   - xerces-wasm cold:  25.61 ms

 Running Warm Loop Benchmark (5 trials of 1000 iterations, interleaved)...
   - xmllint-wasm loop: Mean=22484.05ms (±902.97ms) | Min=21632.86ms | Max=24211.91ms
   - xerces-wasm loop:  Mean=40.46ms (±4.49ms) | Min=36.68ms | Max=49.19ms

----------------------------------------------------------------------
 TEST 2: Multi-File Modular Schemas (4 Included XSDs)
----------------------------------------------------------------------
 Measuring Isolated Cold Start... Done.
   - xmllint-wasm cold: 35.28 ms
   - xerces-wasm cold:  24.71 ms

 Running Warm Loop Benchmark (5 trials of 1000 iterations, interleaved)...
   - xmllint-wasm loop: Mean=23395.49ms (±129.34ms) | Min=23191.64ms | Max=23573.36ms
   - xerces-wasm loop:  Mean=70.29ms (±1.12ms) | Min=69.14ms | Max=71.91ms

======================================================================
 SUMMARY & RATIOS
======================================================================
 Test 1 Warm Loop Speedup: (xmllint 22484.0ms vs xerces 40.5ms) => Xerces is 555.6x faster
 Test 2 Warm Loop Speedup: (xmllint 23395.5ms vs xerces 70.3ms) => Xerces is 332.8x faster
======================================================================
```

---

## 📁 Test Files Structure

```text
tests/
├── fixtures/
│   ├── sample.xml            # Single XML fixture
│   └── multi-order.xml       # Complex XML purchase order fixture
└── schemas/
    ├── sample.xsd            # Single XSD schema
    └── multi/                # Modular XSD schemas
        ├── address.xsd       # Address definition
        ├── customer.xsd      # Includes address.xsd
        ├── product.xsd       # Product definition
        └── order.xsd         # Main entry schema (includes customer & product)
```

---

## 🚀 Setup & How to Run

### 1. Prerequisites
- Node.js (v18+ recommended)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/harshanacz/xml-val-benchmark.git
cd xml-val-benchmark
npm install
```

### 3. Run Benchmark
Run the benchmark suite using `npm start` (with `--expose-gc` enabled):

```bash
npm start
```
or directly:
```bash
node --expose-gc src/benchmark.js
```
