import { validateXML as xmllintValidate } from 'xmllint-wasm';
import { createProjectValidator } from 'xerces-wasm';
import fs from 'fs';
import path from 'path';

const xsdPath = path.resolve('tests/schemas/sample.xsd');
const xmlPath = path.resolve('tests/fixtures/sample.xml');

const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
const xsdContent = fs.readFileSync(xsdPath, 'utf-8');

const ITERATIONS = 1000;

async function runBenchmark() {
    console.log(`\n==========================================`);
    console.log(` STARTING BENCHMARK (${ITERATIONS} iterations)`);
    console.log(`==========================================\n`);

    // --- xmllint-wasm ---
    console.log('--- Testing xmllint-wasm ---');
    console.time('xmllint: Cold First Run');
    await xmllintValidate({ xml: xmlContent, schema: [xsdContent] });
    console.timeEnd('xmllint: Cold First Run');

    console.time(`xmllint: Loop (${ITERATIONS} runs)`);
    for (let i = 0; i < ITERATIONS; i++) {
        await xmllintValidate({ xml: xmlContent, schema: [xsdContent] });
    }
    console.timeEnd(`xmllint: Loop (${ITERATIONS} runs)`);

    console.log('\n------------------------------------------\n');

    // --- xerces-wasm ---
    console.log('--- Testing xerces-wasm ---');
    console.time('xerces: Cold Run + Grammar Cache');
    const validator = await createProjectValidator({
        entry: path.basename(xsdPath),
        files: { [path.basename(xsdPath)]: xsdContent }
    });
    await validator.validate(xmlContent);
    console.timeEnd('xerces: Cold Run + Grammar Cache');

    console.time(`xerces: Loop (${ITERATIONS} runs)`);
    for (let i = 0; i < ITERATIONS; i++) {
        await validator.validate(xmlContent);
    }
    console.timeEnd(`xerces: Loop (${ITERATIONS} runs)`);

    // Free WASM C++ memory allocations
    validator.destroy();
}

runBenchmark().catch(console.error);