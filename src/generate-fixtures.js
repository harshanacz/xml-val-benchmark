import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('tests/fixtures/generated');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function generateOrderXML(targetSizeBytes) {
    const itemTemplate = (i) => `
    <item>
      <sku>PROD-${String(i).padStart(6, '0')}</sku>
      <name>Enterprise Storage Component Unit ${i}</name>
      <price>${(19.99 + (i % 100)).toFixed(2)}</price>
      <quantity>${(i % 10) + 1}</quantity>
      <category>Hardware Category ${(i % 5) + 1}</category>
    </item>`;

    const header = `<?xml version="1.0" encoding="UTF-8"?>
<purchaseOrder>
  <orderId>PO-SCALED-TEST</orderId>
  <orderDate>2026-08-05T20:00:00Z</orderDate>
  <customer>
    <id>CUST-9999</id>
    <name>Scaled Benchmark Customer</name>
    <email>benchmark.customer@example.com</email>
    <phone>+1-555-0199</phone>
    <address>
      <street>100 Scaled Benchmark Way</street>
      <city>San Jose</city>
      <state>CA</state>
      <zipCode>95110</zipCode>
      <country>USA</country>
    </address>
  </customer>
  <items>`;

    const footer = `
  </items>
  <shippingAddress>
    <street>500 Enterprise Park</street>
    <city>San Francisco</city>
    <state>CA</state>
    <zipCode>94105</zipCode>
    <country>USA</country>
  </shippingAddress>
  <totalAmount>999999.99</totalAmount>
</purchaseOrder>`;

    let xml = header;
    let itemCount = 0;
    while (Buffer.byteLength(xml + footer, 'utf-8') < targetSizeBytes) {
        itemCount++;
        xml += itemTemplate(itemCount);
    }
    xml += footer;
    return { xml, itemCount, actualBytes: Buffer.byteLength(xml, 'utf-8') };
}

const sizes = [
    { name: 'order-1kb.xml', bytes: 1024 },
    { name: 'order-100kb.xml', bytes: 100 * 1024 },
    { name: 'order-1mb.xml', bytes: 1024 * 1024 },
    { name: 'order-5mb.xml', bytes: 5 * 1024 * 1024 }
];

console.log('Generating scaled XML fixtures...');
for (const s of sizes) {
    const filePath = path.join(outputDir, s.name);
    const result = generateOrderXML(s.bytes);
    fs.writeFileSync(filePath, result.xml, 'utf-8');
    console.log(` Generated ${s.name}: ${(result.actualBytes / 1024).toFixed(1)} KB (${result.itemCount} items)`);
}
console.log('Done generating fixtures.');
