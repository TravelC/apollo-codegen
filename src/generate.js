import fs from 'fs'

import { ToolError, logError } from './errors'
import { loadSchema,  loadAndMergeQueryDocuments } from './loading'
import { validateQueryDocument } from './validation'
import { compileToIR } from './compilation'
import serializeToJSON from './serializeToJSON'
import { generateSource as generateSwiftSource } from './swift'
import { generateSource as generateTypescriptSource } from './typescript'
import { generateSource as generateObjCSource } from './objc'

export default function generate(inputPaths, schemaPath, outputPath, target, options) {
  const schema = loadSchema(schemaPath);

  const document = loadAndMergeQueryDocuments(inputPaths);

  validateQueryDocument(schema, document);

  const context = compileToIR(schema, document);
  Object.assign(context, options);

  let outputs;
  switch (target) {
    case 'json':
      outputs = [serializeToJSON(context)];
      break;
    case 'objc':
      outputs = generateObjCSource(context);
      break;
    case 'ts':
    case 'typescript':
      outputs = generateTypescriptSource(context);
      break;
    case 'swift':
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
