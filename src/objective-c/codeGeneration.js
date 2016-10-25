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
  GraphQLString
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
  // generator.printOnNewline('#import <Apollo/Apollo-swift.h>');

  context.typesUsed.forEach(type => {
    typeDeclarationForGraphQLType(generator, type);
  });

  Object.values(context.operations).forEach(operation => {
    classDeclarationForOperation(generator, operation);
  });

  Object.values(context.fragments).forEach(fragment => {
    structDeclarationForFragment(generator, fragment);
  });

  return generator.output;
}

function generateObjCSourceImplementation(context, headerFile) {
  const generator = new CodeGenerator(context);

  // Implementation
  generator.printOnNewline('//  This file was automatically generated and should not be edited.');
  generator.printNewline();
  generator.printOnNewline(`#import "${headerFile}"`);

  context.typesUsed.forEach(type => {
    typeImplementionForGraphQLType(generator, type);
  });

  Object.values(context.operations).forEach(operation => {
    // classDeclarationForOperation(generator, operation);
    classImplementationForOperation(generator, operation);
  });

  Object.values(context.fragments).forEach(fragment => {
    structDeclarationForFragment(generator, fragment);
  });

  return generator.output;
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

  let namespace = className;

  generator.printNewlineIfNeeded()
  classDeclaration(generator, {
    className:className,
    superClass: "NSObject",
    modifiers: [],
    // adoptedProtocols: [protocol],
  },
  '',
  () => {
    if (variables && variables.length > 0) {
      const properties = propertiesFromFields(generator.context, variables);
      generator.printNewlineIfNeeded();
      initializerDeclarationForProperties(generator, properties, namespace);
      generator.printNewlineIfNeeded();
      propertyDeclarations(generator, properties, namespace);
      generator.printNewlineIfNeeded();
    }
  });

  structDeclarationForSelectionSet(
    generator,
    {
      structName: "Data",
      fields
    },
    namespace + 'Response'
  );
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

  let namespace = className + 'Response';
  classImplementation(generator, {
    className,
    superClass: "NSObject",
    modifiers: [],
    // adoptedProtocols: [protocol],
  },
  '',
  () => {
    if (variables && variables.length > 0) {
      const properties = propertiesFromFields(generator.context, variables);
      generator.printNewlineIfNeeded();
      initializerImplementationForProperties(generator, properties);
      generator.printNewlineIfNeeded();
      mappedProperty(generator, { propertyName: 'variables', propertyType: 'NSDictionary *' }, properties);
      generator.printNewlineIfNeeded();
    }

    if (source) {
      generator.printOnNewline(`- (nonnull NSString *)operationDefinition`);
      generator.withinBlock(() => {
        generator.withIndent(() => {
          multilineString(generator, source);
        })
      });
    }

    if (fragmentsReferenced && fragmentsReferenced.length > 0) {
      generator.printOnNewline('public static let queryDocument = operationDefinition');
      fragmentsReferenced.forEach(fragment => {
        generator.print(`.appending(${typeNameForFragmentName(fragment)}.fragmentDefinition)`)
      });
    }
  });

  structImplementationForSelectionSet(
    generator,
    {
      structName: "Data",
      fields
    },
    namespace
  );
}

export function initializerDeclarationForProperties(generator, properties, namespace = '') {
  generator.printOnNewline(`- (nonnull instancetype)initWith`);
  generator.print(
    join(
      properties.map(({ propertyName, fieldType }, index) => {
        const fieldName = index == 0 ? pascalCase(propertyName) : camelCase(propertyName);
        const fieldNullibility = (fieldType instanceof GraphQLNonNull) ? 'nonnull ' : 'nullable ';
        const fieldTypeName = typeNameFromGraphQLType(generator.context, fieldType, namespace);

        return `${fieldName}:(${fieldNullibility}${fieldTypeName})${propertyName}`
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

export function mappedProperty(generator, { propertyName, propertyType }, properties) {
  generator.printOnNewline(`- (nullable ${propertyType})${propertyName}`);
  generator.withinBlock(() => {
    generator.printOnNewline('return @{');
    generator.withIndent(() => {
      properties.map(({ fieldName, fieldType }) => {
        const nullabilitySafeguard = fieldType instanceof GraphQLNonNull ? '' : ' ?: [NSNull null]';
        generator.printOnNewline(
          `@"${fieldName}": ${stringValueForProperty(fieldName, fieldType)}${nullabilitySafeguard}, `
        );
      })
    });
    generator.printOnNewline('};');
  })
}

export function stringValueForProperty(fieldName, fieldType) {
  if (fieldType instanceof GraphQLNonNull) {
    return stringValueForProperty(fieldName, fieldType.ofType);
  }

  if (fieldType instanceof GraphQLEnumType) {
    return `[[self class] ${enumStringMappingFunctionNameForType(fieldType)}]`
  } else if (fieldType instanceof GraphQLInputObjectType) {
    return `[_${camelCase(fieldName)} jsonValue]`
  } else if (fieldType === GraphQLString) {
    return `[_${camelCase(fieldName)} copy]`
  } else {
    return `[_${camelCase(fieldName)} stringValue]`
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
  },
  namespace
) {
  const properties = fields && propertiesFromFields(generator.context, fields, namespace);
  const superNamespace = namespace;
  namespace += structName;
  if (properties) {
    properties.filter(property => property.isComposite).forEach(property => {
      structImplementationForSelectionSet(
        generator,
        {
          structName: structNameForProperty(property),
          parentType: getNamedType(property.fieldType),
          fields: property.fields,
          fragmentSpreads: property.fragmentSpreads,
          inlineFragments: property.inlineFragments,
        },
        namespace
      );
    });
  }

  structImplementation(
    generator,
    {
      structName,
      adoptedProtocols,
    },
    superNamespace,
    () => {

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
        propertyDeclaration(generator, { propertyName: 'fragments', typeName: 'Fragments', namespace });
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
            initializationsForProperties(generator, properties, namespace);
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
            namespace,
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
              },
              namespace
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
  },
  namespace
) {
  const properties = fields && propertiesFromFields(generator.context, fields, namespace);
  const superNamespace = namespace;
  namespace += structName;
  if (properties) {
    properties.filter(property => property.isComposite).forEach(property => {
      structDeclarationForSelectionSet(
        generator,
        {
          structName: structNameForProperty(property),
          parentType: getNamedType(property.fieldType),
          fields: property.fields,
          fragmentSpreads: property.fragmentSpreads,
          inlineFragments: property.inlineFragments,
        },
        namespace
      );
    });
  }

  structDeclaration(
    generator,
    {
      structName,
      adoptedProtocols,
    },
    superNamespace,
    () => {
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

      propertyDeclarations(generator, properties, namespace);

      generator.printNewlineIfNeeded();
      generator.printOnNewline('- (nonnull instancetype)initWithDictionary:(nonnull NSDictionary *)dictionary;');
      generator.printNewlineIfNeeded();
  });
}

export function initializationsForProperties(generator, properties, namespace) {
  properties.forEach(property => initializationForProperty(generator, property, namespace));
}

export function initializationForProperty(generator, property, namespace) {
  initializeProperty(generator, property, namespace);
}

export function propertiesFromFields(context, fields, namespace) {
  return fields.map(field => propertyFromField(context, field, namespace));
}

export function propertyFromField(context, field, namespace) {
  const { name: fieldName, type: fieldType, description, fragmentSpreads, inlineFragments } = field;

  const propertyName = camelCase(fieldName);

  let property = { fieldName, fieldType, propertyName, description };

  const namedType = getNamedType(fieldType);

  if (isCompositeType(namedType)) {
    const bareTypeName = pascalCase(Inflector.singularize(propertyName));
    const typeName = typeNameFromGraphQLType(context, fieldType, namespace);
    return { ...property, typeName, bareTypeName, fields: field.fields, isComposite: true, fragmentSpreads, inlineFragments };
  } else {
    const typeName = typeNameFromGraphQLType(context, fieldType, namespace);
    return { ...property, typeName, isComposite: false };
  }
}

export function structNameForProperty(property) {
  return pascalCase(Inflector.singularize(property.propertyName));
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

function structDeclarationForInputObjectType(generator, type) {
  const { name: structName, description } = type;
  // const adoptedProtocols = ['JSONEncodable'];
  const adoptedProtocols = [];
  const properties = propertiesFromFields(generator.context, Object.values(type.getFields()));

  structDeclaration(generator, { structName, description, adoptedProtocols }, '', () => {
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
  }
}

function structImplementationForInputObjectType(generator, type) {
  const { name: structName, description } = type;
  // const adoptedProtocols = ['JSONEncodable'];
  const adoptedProtocols = [];
  const properties = propertiesFromFields(generator.context, Object.values(type.getFields()));

  structImplementation(generator, { structName, description, adoptedProtocols }, '', () => {
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
