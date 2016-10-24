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

import { camelCase, pascalCase } from 'change-case';
import Inflector from 'inflected';

import {
  typeNameFromGraphQLType
} from './types';

export function classDeclaration(generator, { className, modifiers, superClass, adoptedProtocols = [], properties }, namespace = '', closure) {
  generator.print(wrap('', join(modifiers, ' '), ' '));
  generator.printOnNewline(`@interface ${namespace}${ className } : ${ superClass } `);
  generator.print(wrap('<', join(adoptedProtocols, ', '), '>'));
  generator.printOnNewline(closure());
  generator.printOnNewline(`@end`);
}

export function classImplementation(generator, { className, modifiers, superClass, adoptedProtocols = [], properties },  namespace = '', closure) {
  generator.print(wrap('', join(modifiers, ' '), ' '));
  generator.printOnNewline(`@implementation ${namespace}${ className }`);
  // generator.print(wrap('<', join(adoptedProtocols, ', '), '>'));
  generator.printOnNewline(closure());
  generator.printOnNewline(`@end`);
}


export function structDeclaration(generator, { structName, description, adoptedProtocols = []}, namespace = '', closure) {
  generator.printNewlineIfNeeded();
  if (description != undefined) {
    generator.printOnNewline('// ' + description);
  }
  classDeclaration(generator, {
    className: structName,
    superClass: "NSObject",
    adoptedProtocols: adoptedProtocols,
  }, namespace, closure)
}

export function structImplementation(generator, { structName, description, adoptedProtocols = [] }, namespace = '', closure) {
  generator.printNewlineIfNeeded();
  if (description != undefined) {
    generator.printOnNewline('// ' + description);
  }
  classImplementation(generator, {
    className: structName,
    superClass: "NSObject",
    adoptedProtocols: adoptedProtocols,
  }, namespace, closure)
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
    return 'strong';
  }
}

function nullabilityWithFieldType(type) {
  if (type instanceof GraphQLEnumType) {
    return '';
  }
  return type instanceof GraphQLNonNull ? 'nonnull' : 'nullable';
}

export function propertyDeclaration(generator, { propertyName, description, fieldType}, namespace = '') {
  const nullabilitySpecifier = nullabilityWithFieldType(fieldType);
  const nullabilityComponent = nullabilitySpecifier.length > 0 ? (' ' + nullabilitySpecifier + ',') : '';
  const fieldTypeName = typeNameFromGraphQLType(generator.context, fieldType, namespace);

  generator.printOnNewline(`@property (nonatomic, ${retainTypeWithFieldType(fieldType)},${nullabilityComponent} readonly) ${fieldTypeName}${propertyName};`);
  generator.print(description && ` // ${description}`);
}

export function propertyDeclarations(generator, properties, namespace) {
  if (!properties) return;
  properties.forEach(property => propertyDeclaration(generator, property, namespace));
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
