# xml-val-benchmark

Performance comparison for WebAssembly XML validation engines: **xmllint-wasm** vs **xerces-wasm**.

## Focus Areas
* **Cold Start:** Single file validation speed.
* **Warm Loop:** Batch validation speed with XSD grammar caching (Xerces) vs re-parsing schemas (xmllint).

## Setup & Run

1. Clone & install dependencies:
   ```bash
   git clone <your-repo-url>
   cd xml-val-benchmark
   npm install
