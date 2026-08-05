# xml-val-benchmark

Performance comparison for WebAssembly XML validation engines: **xmllint-wasm** vs **xerces-wasm**.

## Overview & Focus Areas
- **Cold Start:** Initial execution speed including WASM initialization and schema loading.
- **Warm Loop:** Performance during repeated validations (1,000 iterations) utilizing XSD grammar caching (`xerces-wasm`) vs re-parsing schemas per validation (`xmllint-wasm`).
- **Single vs Multi-File Schemas:** Benchmarking standalone XSDs vs complex modular XSD architecture (multiple XSD files with `xs:include`).

---

##  Benchmark Results (1,000 Iterations)

### Test 1: Single Schema Benchmark (`sample.xsd`)

| Engine | Cold Start | Warm Loop (1,000 runs) | Avg / Validation |
| :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | ~29.8 ms | ~20.85 s | ~20.8 ms |
| **`xerces-wasm`** | ~23.5 ms | **~56.9 ms (0.05 s)** | **~0.057 ms** |

---

### Test 2: Multi-File Modular Schemas (4 Included XSDs)
*Structure:* `order.xsd` (includes `customer.xsd` & `product.xsd`, which includes `address.xsd`).

| Engine | Cold Start + Grammar Cache | Warm Loop (1,000 runs) | Avg / Validation |
| :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | ~27.2 ms | ~21.25 s | ~21.2 ms |
| **`xerces-wasm`** | ~2.1 ms | **~82.8 ms (0.08 s)** | **~0.083 ms** |

---

###  Full Benchmark Execution Log

```text
==================================================
 XML VALIDATION BENCHMARK SUITE (1000 iterations)
==================================================

--------------------------------------------------
 TEST 1: Single Schema Benchmark (sample.xsd)
--------------------------------------------------

--- Testing xmllint-wasm (Single Schema) ---
xmllint: Cold First Run: 29.85ms
xmllint: Loop (1000 runs): 20.845s

--- Testing xerces-wasm (Single Schema) ---
xerces: Cold Run + Grammar Cache: 23.52ms
xerces: Loop (1000 runs): 56.88ms

--------------------------------------------------
 TEST 2: Multi-File Modular Schemas (4 XSDs with includes)
--------------------------------------------------

--- Testing xmllint-wasm (Multi-Schema) ---
xmllint: Cold First Run: 27.247ms
xmllint: Loop (1000 runs): 21.250s

--- Testing xerces-wasm (Multi-Schema) ---
xerces: Cold Run + Grammar Cache: 2.115ms
xerces: Loop (1000 runs): 82.788ms

==================================================
 BENCHMARK SUITE COMPLETED
==================================================
```

### 💡 Key Takeaway
In both single-file and multi-file schema architectures, `xerces-wasm` uses `createProjectValidator` to pre-parse XSDs and cache the Grammar Pool in WASM memory. Reusing this cached pool provides a **~250x to ~360x speedup** over `xmllint-wasm` in high-throughput validation scenarios.

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
Run the benchmark suite using `npm start` or directly via Node:

```bash
npm start
```
or
```bash
node src/benchmark.js
```
