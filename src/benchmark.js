import { validateXML as xmllintValidate } from 'xmllint-wasm';
import { createProjectValidator } from 'xerces-wasm';
import fs from 'fs';
import path from 'path';

// --- Paths for Single Schema Benchmark ---
const singleXsdPath = path.resolve('tests/schemas/sample.xsd');
const singleXmlPath = path.resolve('tests/fixtures/sample.xml');

const singleXmlContent = fs.readFileSync(singleXmlPath, 'utf-8');
const singleXsdContent = fs.readFileSync(singleXsdPath, 'utf-8');

// --- Paths for Multi-Schema Benchmark ---
const multiSchemaDir = path.resolve('tests/schemas/multi');
const multiXmlPath = path.resolve('tests/fixtures/multi-order.xml');

const multiXmlContent = fs.readFileSync(multiXmlPath, 'utf-8');
const multiFilesMap = {
    'order.xsd': fs.readFileSync(path.join(multiSchemaDir, 'order.xsd'), 'utf-8'),
    'customer.xsd': fs.readFileSync(path.join(multiSchemaDir, 'customer.xsd'), 'utf-8'),
    'address.xsd': fs.readFileSync(path.join(multiSchemaDir, 'address.xsd'), 'utf-8'),
    'product.xsd': fs.readFileSync(path.join(multiSchemaDir, 'product.xsd'), 'utf-8'),
};
const multiPreloadList = Object.entries(multiFilesMap).map(([fileName, contents]) => ({ fileName, contents }));

const ITERATIONS = 1000;

async function runBenchmarkSuite() {
    console.log(`==================================================`);
    console.log(` XML VALIDATION BENCHMARK SUITE (${ITERATIONS} iterations)`);
    console.log(`==================================================\n`);

    // ==================================================
    // TEST 1: Single Schema Validation
    // ==================================================
    console.log(`--------------------------------------------------`);
    console.log(` TEST 1: Single Schema Benchmark (sample.xsd)`);
    console.log(`--------------------------------------------------\n`);

    // xmllint-wasm Single
    console.log('--- Testing xmllint-wasm (Single Schema) ---');
    console.time('xmllint: Cold First Run');
    await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
    console.timeEnd('xmllint: Cold First Run');

    console.time(`xmllint: Loop (${ITERATIONS} runs)`);
    for (let i = 0; i < ITERATIONS; i++) {
        await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
    }
    console.timeEnd(`xmllint: Loop (${ITERATIONS} runs)`);

    console.log('');

    // xerces-wasm Single
    console.log('--- Testing xerces-wasm (Single Schema) ---');
    console.time('xerces: Cold Run + Grammar Cache');
    const singleValidator = await createProjectValidator({
        entry: 'sample.xsd',
        files: { 'sample.xsd': singleXsdContent }
    });
    await singleValidator.validate(singleXmlContent);
    console.timeEnd('xerces: Cold Run + Grammar Cache');

    console.time(`xerces: Loop (${ITERATIONS} runs)`);
    for (let i = 0; i < ITERATIONS; i++) {
        await singleValidator.validate(singleXmlContent);
    }
    console.timeEnd(`xerces: Loop (${ITERATIONS} runs)`);

    singleValidator.destroy();

    // ==================================================
    // TEST 2: Multi-File Modular Schema Validation
    // ==================================================
    console.log(`\n--------------------------------------------------`);
    console.log(` TEST 2: Multi-File Modular Schemas (4 XSDs with includes)`);
    console.log(`--------------------------------------------------\n`);

    // xmllint-wasm Multi
    console.log('--- Testing xmllint-wasm (Multi-Schema) ---');
    console.time('xmllint: Cold First Run');
    await xmllintValidate({
        xml: multiXmlContent,
        schema: [multiFilesMap['order.xsd']],
        preload: multiPreloadList
    });
    console.timeEnd('xmllint: Cold First Run');

    console.time(`xmllint: Loop (${ITERATIONS} runs)`);
    for (let i = 0; i < ITERATIONS; i++) {
        await xmllintValidate({
            xml: multiXmlContent,
            schema: [multiFilesMap['order.xsd']],
            preload: multiPreloadList
        });
    }
    console.timeEnd(`xmllint: Loop (${ITERATIONS} runs)`);

    console.log('');

    // xerces-wasm Multi
    console.log('--- Testing xerces-wasm (Multi-Schema) ---');
    console.time('xerces: Cold Run + Grammar Cache');
    const multiValidator = await createProjectValidator({
        entry: 'order.xsd',
        files: multiFilesMap
    });
    await multiValidator.validate(multiXmlContent);
    console.timeEnd('xerces: Cold Run + Grammar Cache');

    console.time(`xerces: Loop (${ITERATIONS} runs)`);
    for (let i = 0; i < ITERATIONS; i++) {
        await multiValidator.validate(multiXmlContent);
    }
    console.timeEnd(`xerces: Loop (${ITERATIONS} runs)`);

    multiValidator.destroy();

    console.log(`\n==================================================`);
    console.log(` BENCHMARK SUITE COMPLETED`);
    console.log(`==================================================\n`);
}

runBenchmarkSuite().catch(console.error);