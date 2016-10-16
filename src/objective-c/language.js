import {
  join,
  wrap,
} from '../utilities/printing';

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLObjectType
} from 'graphql';

export function classDeclaration(generator, { className, modifiers, superClass, adoptedProtocols = [], properties }, closure) {
  generator.printNewlineIfNeeded();
  generator.printNewline();
  generator.print(wrap('', join(modifiers, ' '), ' '));
  generator.printOnNewline(`@interface ${ className } : ${ superClass } `);
  generator.print(wrap('<', join(adoptedProtocols, ', '), '>'));
  generator.withinBlock(closure);
  generator.printOnNewline(`@end`);
}

export function structDeclaration(generator, { structName, description, adoptedProtocols = [] }, closure) {
  generator.printOnNewline(description);
  classDeclaration(generator, {
    className: structName,
    superClass: "NSObject",
    adoptedProtocols: adoptedProtocols
  }, closure)
}

const builtInRetainMap = {
  [GraphQLString.name]: 'copy',
  [GraphQLInt.name]: 'strong',
  [GraphQLFloat.name]: 'strong',
  [GraphQLBoolean.name]: 'strong',
}

function retainTypeWithFieldType(type) {
  if (type instanceof GraphQLNonNull) {
    return retainTypeWithFieldType(type.ofType);
  }

  if (type instanceof GraphQLList) {
    return 'copy';
  } else if (type instanceof GraphQLObjectType) {
    return 'strong';
  } else if (type instanceof GraphQLEnumType) {
    return 'assign';
  } else if (type instanceof GraphQLScalarType) {
    return builtInRetainMap[type.name] || retainTypeWithFieldType(GraphQLString);
  } else {
    console.log(type);
    return 'strong';
  }
}

function nullabilityWithFieldType(type) {
  return type instanceof GraphQLNonNull ? 'nonnull' : 'nullable';
}

export function propertyDeclaration(generator, { propertyName, typeName, description, fieldType }) {
  generator.printOnNewline(`@property (nonatomic, ${retainTypeWithFieldType(fieldType)}, readonly, ${nullabilityWithFieldType(fieldType)}) ${typeName}${propertyName};`);
  generator.print(description && ` // ${description}`);
}

export function propertyDeclarations(generator, properties) {
  if (!properties) return;
  properties.forEach(property => propertyDeclaration(generator, property));
}

export function protocolDeclaration(generator, { protocolName, adoptedProtocols, properties }, closure) {
  generator.printNewlineIfNeeded();
  generator.printOnNewline(`public protocol ${protocolName}`);
  generator.print(wrap('<', join(adoptedProtocols, ', '), '>'));
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
