# xml-val-benchmark

Publication-grade multi-dimensional performance benchmark comparing WebAssembly XML validation engines: **`xmllint-wasm`** vs **`xerces-wasm`**.

---

## 🔬 Benchmark Methodology & Dimensions

This suite evaluates validation engines across 4 core operational dimensions:

1. **Standard Schema Validation:** Isolated cold-starts and warm-loop validation across Single and Multi-File XSD architecture.
2. **Document-Size Scaling:** Scaling characteristics across 1KB, 100KB, 1MB, and 5MB XML payloads.
3. **Invalid XML / Error-Path Performance:** Validation latency and error handling when processing schema-invalid XML (missing tags, data-type mismatches).
4. **Memory Footprint & Concurrency:** Heap memory allocation delta during batch processing and parallel execution via `Promise.all`.

---

## 📊 Comprehensive Benchmark Results

### Environment Baseline
- **Hardware:** Apple M4 (arm64)
- **OS:** Darwin 25.6.0
- **Runtime:** Node.js v22.22.1 (`--expose-gc`)

---

### Module 1: Standard Schema Validation (1,000 Iterations)

#### 1A. Single Schema (`sample.xsd`)
| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 34.59 ms | 22,101.66 ms (±198.43 ms) | 21,781.47 ms / 22,302.54 ms | Baseline |
| **`xerces-wasm`** | **22.79 ms** | **41.35 ms (±5.61 ms)** | **37.91 ms / 52.51 ms** | **534.5x faster** |

#### 1B. Multi-File Modular Schemas (4 Included XSDs)
| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 36.34 ms | 23,487.12 ms (±268.93 ms) | 23,273.55 ms / 24,009.64 ms | Baseline |
| **`xerces-wasm`** | **25.46 ms** | **69.40 ms (±1.88 ms)** | **68.09 ms / 73.14 ms** | **338.4x faster** |

---

### Module 2: Document-Size Payload Scaling

Evaluating throughput (MB/s) and latency as XML document size increases against `order.xsd`:

| Payload Size | `xmllint-wasm` Latency | `xmllint-wasm` Throughput | `xerces-wasm` Latency | `xerces-wasm` Throughput | Speedup / Winner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1 KB** | 23.67 ms | 0.05 MB/s | **0.06 ms** | **17.62 MB/s** | **`xerces-wasm` (368.3x faster)** |
| **100 KB** | 27.96 ms | 3.50 MB/s | **2.83 ms** | **34.61 MB/s** | **`xerces-wasm` (9.9x faster)** |
| **1 MB** | 45.05 ms | 22.20 MB/s | **28.91 ms** | **34.59 MB/s** | **`xerces-wasm` (1.6x faster)** |
| **5 MB** | **101.87 ms** | **49.08 MB/s** | 141.77 ms | 35.27 MB/s | **`xmllint-wasm` (1.4x faster)** |

> **Key Discovery:** For small to medium payloads (<1MB), schema compilation overhead dominates `xmllint-wasm`, making `xerces-wasm` up to **368x faster**. For large payloads (>5MB), `xmllint`'s stream processing throughput reaches **~49 MB/s** as payload parsing outweighs schema overhead.

---

### Module 3: Invalid XML & Error-Path Performance

Measuring validation speed when XML violates schema constraints (`r.valid === false`):

| Invalid Scenario | `xmllint-wasm` Latency | `xerces-wasm` Latency | Speedup |
| :--- | :--- | :--- | :--- |
| **Missing Required Element** (`<street>`) | 23.44 ms / call | **0.07 ms / call** | **`xerces-wasm` (359.4x faster)** |
| **Invalid Datatype** (string in decimal) | 23.98 ms / call | **0.07 ms / call** | **`xerces-wasm` (345.1x faster)** |

---

### Module 4: Memory Footprint & Concurrency

#### 4A. Heap Memory Allocation Delta (after batch processing)
| Engine | Heap Memory Delta | Memory Efficiency |
| :--- | :--- | :--- |
| **`xmllint-wasm`** | +9.86 MB | Baseline |
| **`xerces-wasm`** | **+0.69 MB** | **~14x lower memory footprint** |

#### 4B. Concurrency (`Promise.all` across 50 parallel validations)
| Engine | 50 Parallel Validations | Speedup |
| :--- | :--- | :--- |
| **`xmllint-wasm`** | 252.31 ms | Baseline |
| **`xerces-wasm`** | **3.66 ms** | **69.0x faster parallel execution** |

---

### 📋 Full Benchmark Execution Log

```text
======================================================================
 RIGOROUS MULTI-DIMENSIONAL XML BENCHMARK SUITE
======================================================================
 System Info: Darwin 25.6.0 (arm64) | CPU: Apple M4
 Runtime: Node.js v22.22.1 | Iterations/Trial: 1000 | Trials: 5
======================================================================

----------------------------------------------------------------------
 MODULE 1: Standard Schema Validation
----------------------------------------------------------------------

 [1A] Single Schema Benchmark (sample.xsd)
   - Measuring Isolated Cold Start... Done.
     * xmllint-wasm cold: 34.59 ms
     * xerces-wasm cold:  22.79 ms
   - Running Warm Loop (5 trials of 1000 iterations, interleaved)...
     * xmllint-wasm loop: Mean=22101.66ms (±198.43ms) | Min=21781.47ms | Max=22302.54ms
     * xerces-wasm loop:  Mean=41.35ms (±5.61ms) | Min=37.91ms | Max=52.51ms

 [1B] Multi-File Modular Schema Benchmark (4 Included XSDs)
   - Measuring Isolated Cold Start... Done.
     * xmllint-wasm cold: 36.34 ms
     * xerces-wasm cold:  25.46 ms
   - Running Warm Loop (5 trials of 1000 iterations, interleaved)...
     * xmllint-wasm loop: Mean=23487.12ms (±268.93ms) | Min=23273.55ms | Max=24009.64ms
     * xerces-wasm loop:  Mean=69.40ms (±1.88ms) | Min=68.09ms | Max=73.14ms

----------------------------------------------------------------------
 MODULE 2: Document-Size Scaling Benchmark (1KB, 100KB, 1MB, 5MB)
----------------------------------------------------------------------

   - Payload Size: 1KB (0.001 MB, 100 runs)
     * xmllint-wasm: 23.67 ms/val | Throughput: 0.05 MB/s
     * xerces-wasm:  0.06 ms/val | Throughput: 17.62 MB/s
     * Speedup:      Xerces is 368.3x faster

   - Payload Size: 100KB (0.098 MB, 50 runs)
     * xmllint-wasm: 27.96 ms/val | Throughput: 3.50 MB/s
     * xerces-wasm:  2.83 ms/val | Throughput: 34.61 MB/s
     * Speedup:      Xerces is 9.9x faster

   - Payload Size: 1MB (1.000 MB, 10 runs)
     * xmllint-wasm: 45.05 ms/val | Throughput: 22.20 MB/s
     * xerces-wasm:  28.91 ms/val | Throughput: 34.59 MB/s
     * Speedup:      Xerces is 1.6x faster

   - Payload Size: 5MB (5.000 MB, 5 runs)
     * xmllint-wasm: 101.87 ms/val | Throughput: 49.08 MB/s
     * xerces-wasm:  141.77 ms/val | Throughput: 35.27 MB/s
     * Speedup:      Xerces is 0.7x faster

----------------------------------------------------------------------
 MODULE 3: Invalid XML & Error-Path Performance Benchmark
----------------------------------------------------------------------

   - Invalid Scenario: Missing Tag (<street>)
     * xmllint-wasm error validation: 23.44 ms/call | Errors caught: 1
     * xerces-wasm error validation:  0.07 ms/call | Errors caught: 1
     * Speedup:                       Xerces is 359.4x faster on error paths

   - Invalid Scenario: Invalid Datatype (string in decimal)
     * xmllint-wasm error validation: 23.98 ms/call | Errors caught: 1
     * xerces-wasm error validation:  0.07 ms/call | Errors caught: 1
     * Speedup:                       Xerces is 345.1x faster on error paths

----------------------------------------------------------------------
 MODULE 4: Memory Footprint & Concurrency Benchmark
----------------------------------------------------------------------

 [4A] Memory Footprint (Heap Used Delta after 1,000 validations)
     * xmllint-wasm Heap Delta: +9.86 MB
     * xerces-wasm Heap Delta:  +0.69 MB

 [4B] Concurrency Benchmark (50 Parallel Validations via Promise.all)
     * xmllint-wasm (50 parallel calls): 252.31 ms
     * xerces-wasm (50 parallel calls):  3.66 ms
     * Speedup:                          Xerces is 69.0x faster in parallel execution

======================================================================
 BENCHMARK SUITE COMPLETED SUCCESSFULLY
======================================================================
```

---

## 🚀 Setup & How to Run

### 1. Prerequisites
- Node.js (v18+ recommended)

### 2. Installation & Fixture Generation
```bash
git clone https://github.com/harshanacz/xml-val-benchmark.git
cd xml-val-benchmark
npm install
node src/generate-fixtures.js
```

### 3. Run Benchmark Suite
Run the full multi-dimensional benchmark suite:

```bash
npm start
```
