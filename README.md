# xml-val-benchmark

Performance comparison for WebAssembly XML validation engines: **xmllint-wasm** vs **xerces-wasm**.

## Overview & Focus Areas
- **Cold Start:** Initial execution speed including WASM initialization and schema loading.
- **Warm Loop:** Performance during repeated validations (1000 iterations) utilizing XSD grammar caching (`xerces-wasm`) vs re-parsing schemas per validation (`xmllint-wasm`).

---

##  Benchmark Results

Test run with **1,000 iterations** validating XML against an XSD schema:

| Engine | Cold Start / First Run | Warm Loop (1,000 runs) | Avg Time / Validation |
| :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | ~36.2 ms | ~19,968 ms (19.97 s) | ~19.9 ms |
| **`xerces-wasm`** | ~24.1 ms | **~50 ms (0.05 s)** | **~0.05 ms** |

### Execution Log Output

```text
==========================================
 STARTING BENCHMARK (1000 iterations)
==========================================

--- Testing xmllint-wasm ---
xmllint: Cold First Run: 36.237ms
xmllint: Loop (1000 runs): 19.968s

------------------------------------------

--- Testing xerces-wasm ---
xerces: Cold Run + Grammar Cache: 24.189ms
xerces: Loop (1000 runs): 50.057ms
```

### Key Takeaway
`xerces-wasm` pre-parses and caches the XSD Grammar Pool in WASM memory using `createProjectValidator`. In batch or high-throughput scenarios, reusing the cached grammar pool provides a **~400x speedup** over `xmllint-wasm`.

---

##  Setup & How to Run

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
Run the benchmark script using `npm start` or directly via Node:

```bash
npm start
```
or
```bash
node src/benchmark.js
```
