import {
  join,
  wrap,
} from '../utilities/printing';

import {
  propertyAttributeFromGraphQLType
} from './types';

export function classDeclaration(generator, { className, superClass, adoptedProtocols = [], properties }, closure) {
  generator.printNewlineIfNeeded();
  generator.printNewline();
  generator.print(`@interface ${ className } : NSObject`);
  generator.print(wrap('<', join([superClass, ...adoptedProtocols], ', '), '>'));
  generator.pushScope({ typeName: className });
  generator.printOnNewline(closure());
  generator.popScope();
  generator.printOnNewline(`@end`);
}

export function structDeclaration(generator, { structName, description, adoptedProtocols = [] }, closure) {
  classDeclaration(
    generator,
    {
      className:structName,
      adoptedProtocols
    },
    closure
  )
}

export function classImplementation(generator, { className, superClass, adoptedProtocols = [], properties }, closure) {
  generator.printNewlineIfNeeded();

  if (adoptedProtocols.length > 0) {
    generator.printOnNewline(`@interface ${ className } ()`);
    generator.pushScope({ typeName: className });
    generator.print(wrap('<', join([superClass, ...adoptedProtocols], ', '), '>'));
    generator.popScope();
    generator.printOnNewline(`@end`);
  }

  generator.printNewlineIfNeeded();
  generator.printNewline();
  generator.print(`@implementation ${ className }`);
  generator.pushScope({ typeName: className });
  generator.printOnNewline(closure());
  generator.popScope();
  generator.printOnNewline(`@end`);
}

export function propertyDeclaration(generator, { propertyName, type, typeName, isOptional, description }) {
  const nullabilitySpecifier = isOptional ? 'nullable' : 'nonnull';
  const propertyAttribute = propertyAttributeFromGraphQLType(type);
  generator.printOnNewline(description && ` /// ${description}`);
  generator.printOnNewline(`@property (nonatomic, ${propertyAttribute}, ${nullabilitySpecifier}, readonly) ${typeName} *${propertyName};`);
}

export function propertyDeclarations(generator, properties) {
  if (!properties) return;
  properties.forEach(property => propertyDeclaration(generator, property));
}

export function protocolDeclaration(generator, { protocolName, adoptedProtocols, properties }, closure) {
  generator.printNewlineIfNeeded();
  generator.printOnNewline(`public protocol ${protocolName}`);
  generator.print(wrap(': ', join(adoptedProtocols, ', ')));
  generator.pushScope({ typeName: protocolName });
  generator.withinBlock(closure);
  generator.popScope();
}

export function protocolPropertyDeclaration(generator, { propertyName, typeName }) {
  generator.printOnNewline(`var ${propertyName}: ${typeName} { get }`);
}

export function protocolPropertyDeclarations(generator, properties) {
  if (!properties) return;
  properties.forEach(property => protocolPropertyDeclaration(generator, property));
}
