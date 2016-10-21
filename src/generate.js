import fs from 'fs'

import { ToolError, logError } from './errors'
import { loadSchema,  loadAndMergeQueryDocuments } from './loading'
import { validateQueryDocument } from './validation'
import { compileToIR, stringifyIR } from './compilation'
import { generateSwiftSource } from './swift'
import { generateObjCSource } from './objective-c'

export default function generate(inputPaths, schemaPath, outputPath, target, options) {
  const schema = loadSchema(schemaPath);

  const document = loadAndMergeQueryDocuments(inputPaths);

  validateQueryDocument(schema, document);

  const context = compileToIR(schema, document);
  Object.assign(context, options);

  let outputs;
  switch (target) {
    case 'json':
      outputs = [generateIR(context)];
      break;
    case 'objc':
      outputs = generateObjCSource(context, outputPath);
      break;
    default:
      outputs = generateSwiftSource(context);
      break;
  }

  if (outputPath) {
    outputs.forEach(output => {
      fs.writeFileSync(outputPath + output.extension, output.output);
    })
  } else {
    console.log(output);
  }
}

function generateIR(context) {
  return stringifyIR({
    operations: Object.values(context.operations),
    fragments: Object.values(context.fragments),
    typesUsed: context.typesUsed
  }, '\t');
}
