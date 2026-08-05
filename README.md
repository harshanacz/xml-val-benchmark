# xml-val-benchmark

Publication-grade multi-dimensional performance benchmark comparing WebAssembly XML validation engines: **`xmllint-wasm`** vs **`xerces-wasm`**.

---

## 🔬 Architectural Execution Model & Trade-offs

A critical finding of this benchmark is that `xmllint-wasm` and `xerces-wasm` employ fundamentally different runtime execution architectures:

1. **`xmllint-wasm` (Worker-Thread Offloaded Architecture):**
   - Every `validateXML()` call spawns a dedicated Node.js `worker_threads.Worker`, instantiates the WASM module inside it, executes validation, and tears down the worker thread.
   - **Advantage:** **Zero Main-Thread Blocking.** Main event loop lag during validation is **<1.8 ms** even for 5MB payloads.
   - **Trade-off:** Pays a fixed OS thread spawn and worker creation tax (~23 ms) per validation call.

2. **`xerces-wasm` (Synchronous Main-Thread WASM Architecture):**
   - `createProjectValidator()` pre-parses XSD schemas and caches the compiled Grammar Pool in C++ WASM heap memory. Subsequent `validate()` calls execute synchronously on the Node.js **Main Thread**.
   - **Advantage:** **Extreme Warm-Loop Throughput.** Eliminates worker spawn taxes and schema parsing overhead (~0.06 ms per call for standard payloads).
   - **Trade-off:** **Main-Thread Event Loop Freezing.** Validating large payloads (e.g. 5MB) blocks the main Node.js event loop for **~145 ms**, freezing all incoming HTTP requests, timers, and I/O.

---

## 📊 Benchmark Results (All Modules $n=5$ Interleaved Trials)

### System Baseline
- **Hardware:** Apple M4 (arm64)
- **OS:** Darwin 25.6.0
- **Runtime:** Node.js v22.22.1 (`--expose-gc`)

---

### Module 1: Standard Schema Validation (1,000 Iterations)

#### 1A. Single Schema (`sample.xsd`)
| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 35.52 ms | 22,908.82 ms (±521.72 ms) | 22,084.57 ms / 23,373.96 ms | Baseline |
| **`xerces-wasm`** | **22.66 ms** | **41.71 ms (±6.59 ms)** | **37.54 ms / 54.79 ms** | **549.2x faster** |

#### 1B. Multi-File Modular Schemas (4 Included XSDs)
| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 35.73 ms | 23,916.85 ms (±1017.20 ms) | 22,929.79 ms / 25,844.40 ms | Baseline |
| **`xerces-wasm`** | **25.38 ms** | **69.06 ms (±1.95 ms)** | **67.82 ms / 72.94 ms** | **346.3x faster** |

---

### Module 2: Document-Size Payload Scaling ($n=5$ Trials)

Evaluating latency (Mean ± StdDev) and throughput (MB/s) against `order.xsd`:

| Payload Size | `xmllint-wasm` Mean Latency | `xmllint-wasm` Throughput | `xerces-wasm` Mean Latency | `xerces-wasm` Throughput | Winner / Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.2 KB** | 23.19 ms (±0.30 ms) | 0.05 MB/s | **0.06 ms (±0.00 ms)** | **17.70 MB/s** | **`xerces-wasm` (362.7x faster)** |
| **100 KB** | 26.98 ms (±0.55 ms) | 3.62 MB/s | **2.82 ms (±0.01 ms)** | **34.70 MB/s** | **`xerces-wasm` (9.6x faster)** |
| **1 MB** | 44.18 ms (±0.35 ms) | 22.63 MB/s | **28.42 ms (±0.06 ms)** | **35.19 MB/s** | **`xerces-wasm` (1.55x faster)** |
| **5 MB** | **98.61 ms (±0.36 ms)** | **50.71 MB/s** | 142.38 ms (±1.16 ms) | 35.12 MB/s | **`xmllint-wasm` (1.45x faster)** |

---

### Module 3: Invalid XML & Error-Path Performance ($n=5$ Trials)

Measuring validation latency on schema-invalid XML (`r.valid === false`):

| Invalid Scenario | `xmllint-wasm` Mean Latency | `xerces-wasm` Mean Latency | Speedup Ratio |
| :--- | :--- | :--- | :--- |
| **Missing Required Element** (`<street>`) | 24.59 ms (±0.77 ms) | **0.07 ms (±0.01 ms)** | **`xerces-wasm` (355.2x faster)** |
| **Invalid Datatype** (string in decimal) | 24.39 ms (±0.51 ms) | **0.07 ms (±0.01 ms)** | **`xerces-wasm` (336.8x faster)** |

---

### Module 4: Event-Loop Lag, Memory & Concurrency

#### 4A. Native Event Loop Freeze (`node:perf_hooks monitorEventLoopDelay`)
| Engine | Total Duration | Native Event-Loop Freeze | Thread Execution |
| :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 103.15 ms | **1.76 ms** | Offloaded Worker Thread (Non-Blocking) |
| **`xerces-wasm`** | 143.74 ms | **144.93 ms** | Synchronous Main Thread (Freezes Event Loop) |

#### 4B. Main-Thread Memory Allocation Footprint
| Engine | Main-Thread Heap Delta | Execution Memory Model |
| :--- | :--- | :--- |
| **`xmllint-wasm`** | +2.25 MB | Isolated inside transient Worker Threads |
| **`xerces-wasm`** | **+0.41 MB** | C++ WASM Heap in Main Process |

#### 4C. Parallel Execution (`Promise.all` across 50 Concurrent Validations)
| Engine | 50 Concurrent Promises | Execution Behavior |
| :--- | :--- | :--- |
| **`xmllint-wasm`** | 221.58 ms | Parallel execution scaling across OS thread pool |
| **`xerces-wasm`** | **3.57 ms** | Serialized synchronous execution on main thread |

---

## 📋 Complete Benchmark Log Output

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
     * xmllint-wasm cold: 35.52 ms
     * xerces-wasm cold:  22.66 ms
   - Running Warm Loop (5 interleaved trials of 1000 iterations)...
     * xmllint-wasm loop: Mean=22908.82ms (±521.72ms) | Min=22084.57ms | Max=23373.96ms
     * xerces-wasm loop:  Mean=41.71ms (±6.59ms) | Min=37.54ms | Max=54.79ms

 [1B] Multi-File Modular Schema Benchmark (4 Included XSDs)
   - Measuring Isolated Cold Start... Done.
     * xmllint-wasm cold: 35.73 ms
     * xerces-wasm cold:  25.38 ms
   - Running Warm Loop (5 interleaved trials of 1000 iterations)...
     * xmllint-wasm loop: Mean=23916.85ms (±1017.20ms) | Min=22929.79ms | Max=25844.40ms
     * xerces-wasm loop:  Mean=69.06ms (±1.95ms) | Min=67.82ms | Max=72.94ms

----------------------------------------------------------------------
 MODULE 2: Document-Size Scaling Benchmark (5 Interleaved Trials)
----------------------------------------------------------------------

   - Payload Size: 1.2KB (0.001 MB, 100 runs/trial x 5 trials)
     * xmllint-wasm: Mean=23.19ms/val (±0.30ms) | Throughput=0.05 MB/s
     * xerces-wasm:  Mean=0.06ms/val (±0.00ms) | Throughput=17.70 MB/s
     * Speedup Ratio: Xerces is 362.68x faster

   - Payload Size: 100KB (0.098 MB, 50 runs/trial x 5 trials)
     * xmllint-wasm: Mean=26.98ms/val (±0.55ms) | Throughput=3.62 MB/s
     * xerces-wasm:  Mean=2.82ms/val (±0.01ms) | Throughput=34.70 MB/s
     * Speedup Ratio: Xerces is 9.58x faster

   - Payload Size: 1MB (1.000 MB, 10 runs/trial x 5 trials)
     * xmllint-wasm: Mean=44.18ms/val (±0.35ms) | Throughput=22.63 MB/s
     * xerces-wasm:  Mean=28.42ms/val (±0.06ms) | Throughput=35.19 MB/s
     * Speedup Ratio: Xerces is 1.55x faster

   - Payload Size: 5MB (5.000 MB, 5 runs/trial x 5 trials)
     * xmllint-wasm: Mean=98.61ms/val (±0.36ms) | Throughput=50.71 MB/s
     * xerces-wasm:  Mean=142.38ms/val (±1.16ms) | Throughput=35.12 MB/s
     * Speedup Ratio: Xerces is 0.69x slower

----------------------------------------------------------------------
 MODULE 3: Invalid XML & Error-Path Performance Benchmark
----------------------------------------------------------------------

   - Invalid Scenario: Missing Tag (<street>)
     * xmllint-wasm: Mean=24.59ms/call (±0.77ms)
     * xerces-wasm:  Mean=0.07ms/call (±0.01ms)
     * Speedup Ratio: Xerces is 355.2x faster on error paths

   - Invalid Scenario: Invalid Datatype (string in decimal)
     * xmllint-wasm: Mean=24.39ms/call (±0.51ms)
     * xerces-wasm:  Mean=0.07ms/call (±0.01ms)
     * Speedup Ratio: Xerces is 336.8x faster on error paths

----------------------------------------------------------------------
 MODULE 4: Event-Loop Lag, Memory Footprint & Thread Parallelism
----------------------------------------------------------------------

 [4A] Native Main-Thread Event Loop Freeze Test (5MB Payload Validation)
     * xmllint-wasm: Duration=103.15ms | Max Event-Loop Freeze=1.76ms (Worker-Offloaded, Non-Blocking)
     * xerces-wasm:  Duration=143.74ms | Max Event-Loop Freeze=144.93ms (Main-Thread Synchronous, Freezes Event Loop)

 [4B] Main-Thread Memory Allocation Footprint
     * xmllint-wasm Main Heap Delta: +2.25 MB (Note: Work happens in Worker Threads)
     * xerces-wasm Main Heap Delta:  +0.41 MB (Note: WASM C++ Memory in Main Heap)

 [4C] Parallelism Test (50 Concurrent Promises via Promise.all)
     * xmllint-wasm (50 concurrent promises): 221.58 ms (Offloaded across Worker Threads)
     * xerces-wasm (50 concurrent promises):  3.57 ms (Serialized on Main Event Loop)

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
