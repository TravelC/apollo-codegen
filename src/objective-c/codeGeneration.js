import {
  GraphQLError,
  getNamedType,
  isCompositeType,
  isAbstractType,
  isEqualType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLObjectType
} from 'graphql'

import  { isTypeProperSuperTypeOf } from '../utilities/graphql'

import { camelCase, pascalCase } from 'change-case';
import Inflector from 'inflected';

import {
  join,
  wrap,
} from '../utilities/printing';

import {
  classDeclaration,
  classImplementation,
  structDeclaration,
  structImplementation,
  propertyDeclaration,
  propertyDeclarations
} from './language';

import { escapedString, multilineString } from './strings';

import {
  baseTypeNameFromGraphQLType,
  typeNameFromGraphQLType,
} from './types';

import {
  initializeProperty,
} from './mapping';


import CodeGenerator from '../utilities/CodeGenerator';

export function generateObjCSource(context, outputPath) {
  return [
    {
      output: generateObjCSourceHeader(context),
      extension: '.h'
    },
    {
      output: generateObjCSourceImplementation(context, outputPath.split("/").pop() + '.h'),
      extension: '.m'
    }
  ];
}

function generateObjCSourceHeader(context) {
  const generator = new CodeGenerator(context);

  // Implementation
  generator.printOnNewline('//  This file was automatically generated and should not be edited.');
  generator.printNewline();
  generator.printOnNewline('#import <Foundation/Foundation.h>');
  generator.printNewline();
  generator.printOnNewline('#import <RNGraphQLNetworker/RNGraphQLDefinitions.h>');
  generator.printOnNewline('#import <Realm/Realm.h>');
  generator.printNewline();

  const objectTypes = context.typesUsed.filter((type) => {
    return (type instanceof GraphQLObjectType);
  })
  typeForwardDeclarationsForTypes(generator, objectTypes);

  context.typesUsed.forEach(type => {
    typeDeclarationForGraphQLType(generator, type);
  });

  Object.values(context.operations).forEach(operation => {
    structDeclarationsForOperation(generator, operation);
  });

  Object.values(context.operations).forEach(operation => {
    classDeclarationForOperation(generator, operation);
  });

  Object.values(context.fragments).forEach(fragment => {
    structDeclarationForFragment(generator, fragment);
  });

  return generator.output;
}

function typeForwardDeclarationsForTypes(generator, types) {
  generator.printOnNewline(`@class`);
  generator.withIndent(() => {
    types.forEach((fieldType, index) => {
      const isLastItem = (types.length - 1) == index;
      generator.printOnNewline(`${ fieldType.name }${ isLastItem ? ';' : ',' }`);
    })
  })
}

function generateObjCSourceImplementation(context, headerFile) {
  const generator = new CodeGenerator(context);

  // Implementation
  generator.printOnNewline('//  This file was automatically generated and should not be edited.');
  generator.printNewline();
  generator.printOnNewline(`#import "${headerFile}"`);
  generator.printNewline();
  generator.printOnNewline('#import <RNFoundation/NSArray+Map.h>');
  generator.printOnNewline('#import <Realm/Realm.h>');

  context.typesUsed.forEach(type => {
    typeImplementionForGraphQLType(generator, type);
  });

  Object.values(context.operations).forEach(operation => {
    structImplementationForOperation(generator, operation);
  });

  Object.values(context.operations).forEach(operation => {
    classImplementationForOperation(generator, operation);
  });

  Object.values(context.fragments).forEach(fragment => {
    structDeclarationForFragment(generator, fragment);
  });

  return generator.output;
}

export function structImplementationForOperation(
  generator,
  {
    operationName,
    operationType,
    variables,
    fields,
    fragmentsReferenced,
    source
  }
) {
  let className;
  switch (operationType) {
    case 'query':
      className = `${pascalCase(operationName)}Query`;
      break;
    case 'mutation':
      className = `${pascalCase(operationName)}Mutation`;
      break;
    default:
      throw new GraphQLError(`Unsupported operation type "${operationType}"`);
  }

  structImplementationForSelectionSet(
    generator,
    {
      structName: className + 'Data',
      fields
    }
  );
}

function objectPropertiesMapForType(
  type,
  mapAccumulator = {}
) {
  if (type instanceof GraphQLObjectType) {
    if (mapAccumulator[type.name]) {

    }
  } else if (type instanceof GraphQLNonNull) {
    generateObjectPropertiesMap(type.toType);
  } else if (type instanceof GraphQLList) {
    generateObjectPropertiesMap(type.toType);
  }
}

export function structDeclarationsForOperation(
  generator,
  {
    operationName,
    operationType,
    variables,
    fields,
    fragmentsReferenced,
    source
  }
) {
  let className;
  switch (operationType) {
    case 'query':
      className = `${pascalCase(operationName)}Query`;
      break;
    case 'mutation':
      className = `${pascalCase(operationName)}Mutation`;
      break;
    default:
      throw new GraphQLError(`Unsupported operation type "${operationType}"`);
  }

  structDeclarationForSelectionSet(
    generator,
    {
      structName: className + 'Data',
      fields
    }
  );
}

export function classDeclarationForOperation(
  generator,
  {
    operationName,
    operationType,
    variables,
    fields,
    fragmentsReferenced,
    source
  }
) {
  let className;
  let protocol;

  switch (operationType) {
    case 'query':
      className = `${pascalCase(operationName)}Query`;
      protocol = 'GraphQLQuery';
      break;
    case 'mutation':
      className = `${pascalCase(operationName)}Mutation`;
      protocol = 'GraphQLMutation';
      break;
    default:
      throw new GraphQLError(`Unsupported operation type "${operationType}"`);
  }

  generator.printNewlineIfNeeded()
  classDeclaration(generator, {
    className:className,
    superClass: "NSObject",
    modifiers: [],
    adoptedProtocols: [protocol],
  },
  () => {
    if (variables && variables.length > 0) {
      const properties = propertiesFromFields(generator.context, variables);
      generator.printNewlineIfNeeded();
      initializerDeclarationForProperties(generator, properties);
      generator.printNewlineIfNeeded();
      propertyDeclarations(generator, properties);
      generator.printNewlineIfNeeded();
    }
  });
}

export function classImplementationForOperation(
  generator,
  {
    operationName,
    operationType,
    variables,
    fields,
    fragmentsReferenced,
    source
  },
) {
  let className;
  let protocol;

  switch (operationType) {
    case 'query':
      className = `${pascalCase(operationName)}Query`;
      protocol = 'GraphQLQuery';
      break;
    case 'mutation':
      className = `${pascalCase(operationName)}Mutation`;
      protocol = 'GraphQLMutation';
      break;
    default:
      throw new GraphQLError(`Unsupported operation type "${operationType}"`);
  }

  classImplementation(generator, {
    className,
    superClass: "NSObject",
    modifiers: [],
    adoptedProtocols: [protocol],
  },
  () => {
    if (variables && variables.length > 0) {
      const properties = propertiesFromFields(generator.context, variables);
      generator.printNewlineIfNeeded();
      initializerImplementationForProperties(generator, properties);
      generator.printNewlineIfNeeded();
      mappedProperty(generator, { propertyName: 'variables', propertyType: 'NSDictionary *', nullable: false }, properties);
      generator.printNewlineIfNeeded();
    }

    if (source) {
      generator.printOnNewline(`- (nonnull NSString *)operationDefinition`);
      generator.withinBlock(() => {
        generator.withIndent(() => {
          multilineString(generator, source);
        })
      });

      generator.printNewlineIfNeeded();
      generator.printOnNewline(`- (nonnull NSString *)responseDataClassName`);
      generator.withinBlock(() => {
        generator.withIndent(() => {
          const responseDataClassName = className + 'Data';
          generator.printOnNewline(`return @"${responseDataClassName}";`);
        });
      });
      generator.printNewlineIfNeeded();
    }

    if (fragmentsReferenced && fragmentsReferenced.length > 0) {
      generator.printOnNewline('public static let queryDocument = operationDefinition');
      fragmentsReferenced.forEach(fragment => {
        generator.print(`.appending(${typeNameForFragmentName(fragment)}.fragmentDefinition)`)
      });
    }
  });
}

export function initializerDeclarationForProperties(generator, properties = '') {
  generator.printOnNewline(`- (nonnull instancetype)initWith`);
  generator.print(
    join(
      properties.map(({ propertyName, fieldType }, index) => {
        const fieldName = index == 0 ? pascalCase(propertyName) : camelCase(propertyName);
        const fieldNullibility = (fieldType instanceof GraphQLNonNull) ? 'nonnull ' : 'nullable ';
        const fieldTypeName = baseTypeNameFromGraphQLType(generator.context, fieldType);

        return `${fieldName}:(${fieldNullibility}${fieldTypeName} *)${propertyName}`
      })
      , ' '
    )
  );
  generator.print(';');
}

export function initializerImplementationForProperties(generator, properties) {
  initializerDeclarationForProperties(generator, properties);
  generator.withinBlock(() => {
    generator.withIndent(() => {
      generator.printOnNewline('if (self = [super init]) {');
      generator.withIndent(() => {
        properties.forEach(({ propertyName }) => {
          generator.printOnNewline(`_${propertyName} = ${propertyName};`);
        });
      });
      generator.printOnNewline('}');
      generator.printOnNewline('return self;');
    });
  });
}

export function mappedProperty(generator, { propertyName, propertyType, nullable = true }, properties) {
  const nullabilityString = nullable ? 'nullable' : 'nonnull';
  generator.printOnNewline(`- (${nullabilityString} ${propertyType})${propertyName}`);
  generator.withinBlock(() => {
    generator.printOnNewline('return @{');
    generator.withIndent(() => {
      properties.map(({ fieldName, fieldType }) => {
        const nullabilitySafeguard = fieldType instanceof GraphQLNonNull ? '' : ' ?: [NSNull null]';
        generator.printOnNewline(
          `@"${fieldName}": ${valueForProperty(fieldName, fieldType)}${nullabilitySafeguard}, `
        );
      })
    });
    generator.printOnNewline('};');
  })
}

export function valueForProperty(fieldName, fieldType) {
  if (fieldType instanceof GraphQLNonNull) {
    return valueForProperty(fieldName, fieldType.ofType);
  }

  if (fieldType instanceof GraphQLEnumType) {
    return `[[self class] ${enumStringMappingFunctionNameForType(fieldType)}]`
  } else if (fieldType instanceof GraphQLInputObjectType) {
    return `[_${camelCase(fieldName)} jsonValue]`
  } else if (fieldType === GraphQLString) {
    return `[_${camelCase(fieldName)} copy]`
  } else {
    return `_${camelCase(fieldName)}`
  }
}

export function structDeclarationForFragment(
  generator,
  {
    fragmentName,
    typeCondition,
    fields,
    inlineFragments,
    fragmentSpreads,
    source
  }
) {
  const structName = pascalCase(fragmentName);
  structDeclarationForSelectionSet(generator, {
    structName,
    adoptedProtocols: ['GraphQLNamedFragment'],
    parentType: typeCondition,
    possibleTypes: possibleTypesForType(generator.context, typeCondition),
    fields,
    fragmentSpreads,
    inlineFragments
  }, () => {
    if (source) {
      generator.printOnNewline('public static let fragmentDefinition =');
      generator.withIndent(() => {
        multilineString(generator, source);
      });
    }
  });
}

export function structImplementationForSelectionSet(
  generator,
  {
    structName,
    adoptedProtocols = [],
    parentType,
    possibleTypes,
    fields,
    fragmentSpreads,
    inlineFragments,
  }
) {
  structImplementation(
    generator,
    {
      structName,
      adoptedProtocols,
    },
    () => {
      const properties = fields && propertiesFromFields(generator.context, fields);
      const fragmentProperties = fragmentSpreads && fragmentSpreads.map(fragmentName => {
        const fragment = generator.context.fragments[fragmentName];
        if (!fragment) {
          throw new GraphQLError(`Cannot find fragment "${fragmentName}"`);
        }
        const propertyName = camelCase(fragmentName);
        const typeName = typeNameForFragmentName(fragmentName);
        const isProperSuperType = isTypeProperSuperTypeOf(generator.context.schema, fragment.typeCondition, parentType);
        return { propertyName, typeName, bareTypeName: typeName, isProperSuperType };
      });

      const inlineFragmentProperties = inlineFragments && inlineFragments.map(inlineFragment => {
        const bareTypeName = 'As' + pascalCase(String(inlineFragment.typeCondition));
        const propertyName = camelCase(bareTypeName);
        const typeName = bareTypeName + '?'
        return { ...inlineFragment, propertyName, typeName, bareTypeName };
      });

      if (fragmentProperties && fragmentProperties.length > 0) {
        generator.printNewlineIfNeeded();
        propertyDeclaration(generator, { propertyName: 'fragments', typeName: 'Fragments' });
      }

      if (inlineFragmentProperties && inlineFragmentProperties.length > 0) {
        generator.printNewlineIfNeeded();
        propertyDeclarations(generator, inlineFragmentProperties);
      }

      generator.printNewlineIfNeeded();
      generator.printOnNewline('- (nonnull instancetype)initWithDictionary:(nonnull NSDictionary *)dictionary');
      generator.withinBlock(() => {
        generator.printOnNewline('if (self = [super init])');
        generator.withinBlock(() => {
          if (parentType && isAbstractType(parentType)) {
            generator.printOnNewline(`__typename = try map.value(forKey: "__typename")`);
          }

          if (properties) {
            initializationsForProperties(generator, properties);
          }

          if (fragmentProperties && fragmentProperties.length > 0) {
            generator.printNewlineIfNeeded();
            fragmentProperties.forEach(({ propertyName, typeName, bareTypeName, isProperSuperType }) => {
              generator.printOnNewline(`let ${propertyName} = try ${typeName}(map: map`);
              if (isProperSuperType) {
                generator.print(')');
              } else {
                generator.print(`, ifTypeMatches: __typename)`);
              }
            });
            generator.printOnNewline(`fragments = Fragments(`);
            generator.print(join(fragmentSpreads.map(fragmentName => {
              const propertyName = camelCase(fragmentName);
              return `${propertyName}: ${propertyName}`;
            }), ', '));
            generator.print(')');
          }

          if (inlineFragmentProperties && inlineFragmentProperties.length > 0) {
            generator.printNewlineIfNeeded();
            inlineFragmentProperties.forEach(({ propertyName, typeName, bareTypeName }) => {
              generator.printOnNewline(`${propertyName} = try ${bareTypeName}(map: map, ifTypeMatches: __typename)`);
            });
          }
        });

        if (fragmentProperties && fragmentProperties.length > 0) {
          structDeclaration(
            generator,
            {
              structName: 'Fragments'
            },
            () => {
              fragmentProperties.forEach(({ propertyName, typeName, isProperSuperType }) => {
                if (!isProperSuperType) {
                  typeName += '?';
                }
                propertyDeclaration(generator, { propertyName, typeName });
              })
            }
          );
        }

        if (inlineFragmentProperties && inlineFragmentProperties.length > 0) {
          inlineFragmentProperties.forEach(property => {
            structDeclarationForSelectionSet(
              generator,
              {
                structName: property.bareTypeName,
                parentType: property.typeCondition,
                possibleTypes: possibleTypesForType(generator.context, property.typeCondition),
                adoptedProtocols: ['GraphQLConditionalFragment'],
                fields: property.fields,
                fragmentSpreads: property.fragmentSpreads,
              }
            );
          });
        }
        generator.printOnNewline('return self;');
        });
        generator.printNewlineIfNeeded();
    });
}

export function structDeclarationForSelectionSet(
  generator,
  {
    structName,
    adoptedProtocols = [],
    parentType,
    possibleTypes,
    fields,
    fragmentSpreads,
    inlineFragments,
  }
) {
  structDeclaration(
    generator,
    {
      structName,
      adoptedProtocols,
    },
    () => {
      const properties = fields && propertiesFromFields(generator.context, fields);
      if (possibleTypes) {
        generator.printNewlineIfNeeded();
        generator.printOnNewline('public static let possibleTypes = [');
        generator.print(join(possibleTypes.map(type => `"${String(type)}"`), ', '));
        generator.print(']');
      }

      generator.printNewlineIfNeeded();

      if (parentType) {
        propertyDeclaration(generator, { propertyName: '__typename', typeName: 'NSString *', fieldType: GraphQLString });
        // if (isAbstractType(parentType)) {
        //   generator.print(`: String`);
        // } else {
        //   generator.print(` = "${String(parentType)}"`);
        // }
      }

      propertyDeclarations(generator, properties);

      generator.printNewlineIfNeeded();
      generator.printOnNewline('- (nonnull instancetype)initWithDictionary:(nonnull NSDictionary *)dictionary;');
      generator.printNewlineIfNeeded();
  });
}

export function initializationsForProperties(generator, properties) {
  properties.forEach(property => initializationForProperty(generator, property));
}

export function initializationForProperty(generator, property) {
  initializeProperty(generator, property);
}

export function propertiesFromFields(context, fields) {
  return fields.map(field => propertyFromField(context, field));
}

export function propertyFromField(context, field) {
  const { name: fieldName, type: fieldType, description, fragmentSpreads, inlineFragments } = field;

  const propertyName = camelCase(fieldName);

  let property = { fieldName, fieldType, propertyName, description };

  const namedType = getNamedType(fieldType);

  if (isCompositeType(namedType)) {
    const bareTypeName = pascalCase(Inflector.singularize(propertyName));
    const typeName = typeNameFromGraphQLType(context, fieldType);
    return { ...property, typeName, bareTypeName, fields: field.fields, isComposite: true, fragmentSpreads, inlineFragments };
  } else {
    const typeName = typeNameFromGraphQLType(context, fieldType);
    return { ...property, typeName, isComposite: false };
  }
}

export function structNameForProperty(context, property) {
  return baseTypeNameFromGraphQLType(context, property.fieldType);
}

export function typeNameForFragmentName(fragmentName) {
  return pascalCase(fragmentName);
}

export function possibleTypesForType(context, type) {
  if (isAbstractType(type)) {
    return context.schema.getPossibleTypes(type);
  } else {
    return [type];
  }
}

export function typeDeclarationForGraphQLType(generator, type) {
  if (type instanceof GraphQLEnumType) {
    enumerationDeclaration(generator, type);
  } else if (type instanceof GraphQLInputObjectType) {
    structDeclarationForInputObjectType(generator, type);
  } else if (type instanceof GraphQLObjectType) {
    classDeclarationForObjectType(generator, type);
  }
}

function enumerationDeclaration(generator, type) {
  const { name, description } = type;
  const values = type.getValues();

  generator.printNewlineIfNeeded();
  generator.printOnNewline(description && `// ${description}`);
  generator.printOnNewline(`typedef NS_ENUM(NSUInteger, ${name})`);
  generator.withinBlock(() => {
    values.forEach(value =>
      generator.printOnNewline(`${name}${pascalCase(value.name)}, ${wrap(' // ', value.description)}`)
    );
  });
  generator.print(';');
}

function classDeclarationForObjectType(generator, type) {
  const { name: structName, description } = type;
  // const adoptedProtocols = ['JSONEncodable'];
  const adoptedProtocols = [];
  const properties = propertiesFromFields(generator.context, Object.values(type.getFields()));

  structDeclaration(generator, { structName, description, adoptedProtocols }, () => {
    // generator.printOnNewline('- (nullable NSDictionary)dictionaryValue;');
    generator.printNewline();
    generator.printOnNewline('- (nonnull instancetype)initWithDictionary:(nonnull NSDictionary *)dictionary;');
    generator.printNewline();
    propertyDeclarations(generator, properties);
    generator.printNewline();
  }, 'RLMObject');
  generator.printOnNewline(`RLM_ARRAY_TYPE(${ structName })`);
}

function classImplementationForObjectType(generator, type) {
  const { name: structName } = type;
  structImplementationForSelectionSet(
    generator,
    {
      structName,
      fields: Object.values(type.getFields())
    }
  );
}

function structDeclarationForInputObjectType(generator, type) {
  const { name: structName, description } = type;
  // const adoptedProtocols = ['JSONEncodable'];
  const adoptedProtocols = [];
  const properties = propertiesFromFields(generator.context, Object.values(type.getFields()));

  structDeclaration(generator, { structName, description, adoptedProtocols }, () => {
    // generator.printOnNewline('- (nullable NSDictionary)dictionaryValue;');
    generator.printNewline();
    initializerDeclarationForProperties(generator, properties);
    generator.printNewline();
    propertyDeclarations(generator, properties);
    generator.printNewline();
  });
}

export function typeImplementionForGraphQLType(generator, type) {
  if (type instanceof GraphQLEnumType) {
    enumerationImplementation(generator, type);
  } else if (type instanceof GraphQLInputObjectType) {
    structImplementationForInputObjectType(generator, type);
  } else if (type instanceof GraphQLObjectType) {
    classImplementationForObjectType(generator, type);
  }
}

function structImplementationForInputObjectType(generator, type) {
  const { name: structName, description } = type;
  // const adoptedProtocols = ['JSONEncodable'];
  const adoptedProtocols = [];
  const properties = propertiesFromFields(generator.context, Object.values(type.getFields()));

  structImplementation(generator, { structName, description, adoptedProtocols }, () => {
    generator.printNewlineIfNeeded();
    initializerImplementationForProperties(generator, properties);
    generator.printNewline();
    mappedProperty(generator, { propertyName: 'jsonValue', propertyType: 'NSDictionary *' }, properties);
    generator.printNewlineIfNeeded();
  });
}

function enumerationImplementation(generator, type) {
  const { name, description } = type;

  // Generate mapping
  const mappingName = camelCase(name + 'Mapping');
  generator.printNewlineIfNeeded();
  generator.printOnNewline(description && `// ${description}`);
  generator.printOnNewline(`+ (nonnull NSDictionary *)${mappingName}`);
  generator.withinBlock(() => {
    generator.printOnNewline(`return @{`);
    type.getValues().forEach(value => {
        generator.withIndent(() => {
          generator.printOnNewline(`@(${name}${pascalCase(value.name)}) : @"${value.value}", ${wrap(' // ', value.description)}`)
        });
    });
    generator.printOnNewline(`};`)
  });
  generator.printNewlineIfNeeded();

  // Mapping function
  generator.printOnNewline(`+ (nonnull NSString *)${enumStringMappingFunctionNameForType(type)}:(${name})mapping`);
  generator.withinBlock(() => {
    generator.printOnNewline(`return self.${mappingName}[mapping];`)
  });
  generator.printNewlineIfNeeded();
}

function enumStringMappingFunctionNameForType(type) {
  const { name } = type;
  const mappingName = camelCase(name + 'Mapping');
  return `stringWith${pascalCase(mappingName)}`;
}
