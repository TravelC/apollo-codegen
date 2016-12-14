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
  GraphQLInputObjectType
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
  propertyDeclarations,
} from './language';

import { escapedString, multilineString } from './strings';

import {
  typeNameFromGraphQLType,
  propertyAttributeFromGraphQLType,
} from './types';

import CodeGenerator from '../utilities/CodeGenerator';

export function generateSource(context) {
  const generator = new CodeGenerator(context);
  return [
    {
      output: generateObjCSourceHeader(context),
      extension: '.h'
    },
    {
      output: generateObjCSourceImplementation(context),
      extension: '.m'
    }
  ];
}

function generateObjCSourceHeader(context) {
  const generator = new CodeGenerator(context);
  generator.printOnNewline('//  This file was automatically generated and should not be edited.');
  generator.printOnNewline(`#import <RNGraphQLNetworker/RNGraphQLDefinitions.h>`);

  // Generate forward declarations of all types Unsupported
  // generator.printOnNewline('@class');
  // generator.withIndent(() => {
  //   context.typesUsed.forEach((type, index) => {
  //     generator.printOnNewline(type);
  //     if (type != context.typesUsed.length - 1) {
  //       generator.print(',');
  //     }
  //   });
  // });
  // generator.print(';');

  // // Generate declarations for response types
  // Object.values(context.typesUsed).forEach(operation => {
  //   classDeclarationForOperation(generator, operation);
  // });
  //
  // // Generate declarations for query types
  // Object.values(context.operations).forEach(operation => {
  //   classDeclarationForOperation(generator, operation);
  // });

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

function generateObjCSourceImplementation(context) {
  const generator = new CodeGenerator(context);
  generator.printOnNewline('//  This file was automatically generated and should not be edited.');
  generator.printOnNewline(`#import "RNNetworkFetchQueries.h"`);

  context.typesUsed.forEach(type => {
    typeImplementationForGraphQLType(generator, type);
  });

  Object.values(context.operations).forEach(operation => {
    classImplementationForOperation(generator, operation);
  });

  Object.values(context.fragments).forEach(fragment => {
    structImplementationForFragment(generator, fragment);
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
    source,
  },
  namespace
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

  classDeclaration(generator, {
    className,
    modifiers: ['public', 'final'],
    adoptedProtocols: [protocol]
  }, () => {
    // if (source) {
    //   generator.printOnNewline('public static let operationDefinition =');
    //   generator.withIndent(() => {
    //     multilineString(generator, source);
    //   });
    // }

    if (fragmentsReferenced && fragmentsReferenced.length > 0) {
      generator.printOnNewline('public static let queryDocument = operationDefinition');
      fragmentsReferenced.forEach(fragment => {
        generator.print(`.appending(${typeNameForFragmentName(fragment)}.fragmentDefinition)`)
      });
    }

    if (variables && variables.length > 0) {
      const properties = variables.map(({ name, type }) => {
        const propertyName = camelCase(name);
        const typeName = typeNameFromGraphQLType({context:generator.context, type, operationName});
        const isOptional = !(type instanceof GraphQLNonNull || type.ofType instanceof GraphQLNonNull);
        return { propertyName, type, typeName, isOptional };
      });
      generator.printNewlineIfNeeded();
      propertyDeclarations(generator, properties, namespace);
      generator.printNewlineIfNeeded();
      initializerDeclarationForProperties(generator, properties);
      generator.printNewlineIfNeeded();
      // generator.printOnNewline(`public var variables: GraphQLMap?`);
      // generator.withinBlock(() => {
      //   generator.printOnNewline(wrap(
      //     `return [`,
      //     join(properties.map(({ propertyName }) => `"${propertyName}": ${propertyName}`), ', '),
      //     `]`
      //   ));
      // });
    } else {
      initializerDeclarationForProperties(generator, []);
    }
  });
  const baseStructName = operationName + 'Data';
  structDeclarationForSelectionSet(
    generator,
    {
      structName: baseStructName,
      fields
    },
    baseStructName
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
    source,
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

  classImplementation(generator, {
    className,
    modifiers: ['public', 'final'],
    adoptedProtocols: [protocol]
  }, () => {
    if (source) {
      generator.printOnNewline('- (NSString *)operationDefinition');
      generator.withinBlock(() => {
        multilineString(generator, source);
      });
    }

    if (fragmentsReferenced && fragmentsReferenced.length > 0) {
      generator.printOnNewline('public static let queryDocument = operationDefinition');
      fragmentsReferenced.forEach(fragment => {
        generator.print(`.appending(${typeNameForFragmentName(fragment)}.fragmentDefinition)`)
      });
    }

    generator.printOnNewline('- (nonnull Class)responseDataClass');
    generator.withinBlock(() => {
        const responseDataClassName = operationName + 'Data';
        generator.printOnNewline(`return NSClassFromString(@"${responseDataClassName}");`);
    });

    if (variables && variables.length > 0) {
      const properties = variables.map(({ name, type }) => {
        const propertyName = camelCase(name);
        const typeName = typeNameFromGraphQLType({context:generator.context, type, operationName});
        const isOptional = !(type instanceof GraphQLNonNull || type.ofType instanceof GraphQLNonNull);
        return { propertyName, type, typeName, isOptional };
      });
      generator.printNewlineIfNeeded();
      initializerImplementationForProperties(generator, properties);
      generator.printNewlineIfNeeded();
      generator.printOnNewline(`- (NSDictionary *)variables`);
      generator.withinBlock(() => {
        generator.printOnNewline(wrap(
          `return @{`,
          join(properties.map(({ propertyName }) => `@"${propertyName}" : _${propertyName}`), ', '),
          `};`
        ));
      });
    } else {
      initializerImplementationForProperties(generator, []);
    }
  });
  const baseStructName = operationName + 'Data';
  structImplementationForSelectionSet(
    generator,
    {
      structName: baseStructName,
      fields
    },
    baseStructName
  );
}

export function initializerDeclarationForProperties(generator, properties, namespace) {
  generator.printOnNewline(`- (nonnull instancetype)initWith`);
  generator.print(
    join(
      properties.map(({ propertyName, type }, index) => {
        const fieldName = index == 0 ? pascalCase(propertyName) : camelCase(propertyName);
        const fieldNullibility = (type instanceof GraphQLNonNull) ? 'nonnull ' : 'nullable ';
        const fieldTypeName = typeNameFromGraphQLType({context:generator.context, type, namespace});

        return `${fieldName}:(${fieldNullibility}${fieldTypeName} *)${propertyName}`
      })
      , ' '
    )
  );
  generator.print(';');
}

export function initializerImplementationForProperties(generator, properties, namespace) {
  initializerDeclarationForProperties(generator, properties, namespace);
  generator.withinBlock(() => {
    generator.withIndent(() => {
      generator.printOnNewline('if (self = [super init]) {');
      generator.withIndent(() => {
        properties.forEach(({ propertyName, type }) => {
          const propertyAttribute = propertyAttributeFromGraphQLType(type);
          const propertyAssigner = propertyAttribute === 'copy' ?  `[${propertyName} copy]` : `${propertyName}`
          generator.printOnNewline(`_${propertyName} = ${propertyAssigner};`);
        });
      });
      generator.printOnNewline('}');
      generator.printOnNewline('return self;');
    });
  });
}

export function mappedProperty(generator, { functionName, nullable = true }, properties) {
  generator.printOnNewline(`- (nonnull NSDictionary *)${functionName}`);
  generator.withinBlock(() => {
    generator.printOnNewline('return @{');
    generator.withIndent(() => {
      properties.map(({ propertyName, propertyType, isOptional }) => {
        const nullabilitySafeguard = isOptional ? ' ?: [NSNull null]' : '';
        generator.printOnNewline(
          `@"${propertyName}": ${valueForProperty(propertyName, propertyType)}${nullabilitySafeguard}, `
        );
      })
    });
    generator.printOnNewline('};');
  })
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

export function structDeclarationForSelectionSet(
  generator,
  {
    structName,
    adoptedProtocols = ['GraphQLMappable'],
    parentType,
    possibleTypes,
    fields,
    fragmentSpreads,
    inlineFragments
  },
  namespace = '',
  beforeClosure
) {
  const properties = fields && propertiesFromFields(generator.context, fields, namespace);
  if (properties) {
    properties.filter(property => property.isComposite).forEach(property => {
      structDeclarationForSelectionSet(
        generator,
        {
          structName: namespace + structNameForProperty(property),
          parentType: getNamedType(property.type),
          fields: property.fields,
          fragmentSpreads: property.fragmentSpreads,
          inlineFragments: property.inlineFragments
        },
        namespace
      );
    });
  }
  structDeclaration(generator, { structName: structName, adoptedProtocols }, () => {
    if (beforeClosure) {
      beforeClosure();
    }

    if (possibleTypes) {
      generator.printNewlineIfNeeded();
      generator.printOnNewline('public static let possibleTypes = [');
      generator.print(join(possibleTypes.map(type => `"${String(type)}"`), ', '));
      generator.print(']');
    }

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

    generator.printNewlineIfNeeded();

                // if (parentType) {
                //   generator.printOnNewline('- (NSString *)__typename');
                //   generator.withinBlock(() => {
                //     if (isAbstractType(parentType)) {
                //       generator.print(`: String`);
                //     } else {
                //       generator.printOnNewline(`return @"${String(parentType)}"`);
                //     }
                //   });
                // }

    propertyDeclarations(generator, properties, namespace);

    if (fragmentProperties && fragmentProperties.length > 0) {
      generator.printNewlineIfNeeded();
      propertyDeclaration(generator, { propertyName: 'fragments', typeName: 'Fragments' }, namespace)
    }

    if (inlineFragmentProperties && inlineFragmentProperties.length > 0) {
      generator.printNewlineIfNeeded();
      propertyDeclarations(generator, inlineFragmentProperties, namespace);
    }

    generator.printNewlineIfNeeded();
    generator.printOnNewline('- (nonnull instancetype)initWithDictionary:(nullable NSDictionary *)dictionary;');
    // generator.withinBlock(() => {
    //   if (parentType && isAbstractType(parentType)) {
    //     generator.printOnNewline(`__typename = try reader.value(for: Field(responseName: "__typename"))`);
    //   }
    //
    //   if (properties) {
    //     properties.forEach(property => initializationForProperty(generator, property));
    //   }
    //
    //   if (fragmentProperties && fragmentProperties.length > 0) {
    //     generator.printNewlineIfNeeded();
    //     fragmentProperties.forEach(({ propertyName, typeName, bareTypeName, isProperSuperType }) => {
    //       generator.printOnNewline(`let ${propertyName} = try ${typeName}(reader: reader`);
    //       if (isProperSuperType) {
    //         generator.print(')');
    //       } else {
    //         generator.print(`, ifTypeMatches: __typename)`);
    //       }
    //     });
    //     generator.printOnNewline(`fragments = Fragments(`);
    //     generator.print(join(fragmentSpreads.map(fragmentName => {
    //       const propertyName = camelCase(fragmentName);
    //       return `${propertyName}: ${propertyName}`;
    //     }), ', '));
    //     generator.print(')');
    //   }
    //
    //   if (inlineFragmentProperties && inlineFragmentProperties.length > 0) {
    //     generator.printNewlineIfNeeded();
    //     inlineFragmentProperties.forEach(({ propertyName, typeName, bareTypeName }) => {
    //       generator.printOnNewline(`${propertyName} = try ${bareTypeName}(reader: reader, ifTypeMatches: __typename)`);
    //     });
    //   }
    // });

    if (fragmentProperties && fragmentProperties.length > 0) {
      structDeclaration(
        generator,
        {
          structName: namespace + 'Fragments'
        },
        () => {
          fragmentProperties.forEach(({ propertyName, typeName, isProperSuperType }) => {
            if (!isProperSuperType) {
              typeName += '?';
            }
            propertyDeclaration(generator, { propertyName, typeName }, namespace);
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
            fragmentSpreads: property.fragmentSpreads
          }
        );
      });
    }
  });
}
export function structImplementationForSelectionSet(
  generator,
  {
    structName,
    adoptedProtocols = ['GraphQLMappable'],
    parentType,
    possibleTypes,
    fields,
    fragmentSpreads,
    inlineFragments
  },
  namespace = '',
  beforeClosure,
) {
  const properties = fields && propertiesFromFields(generator.context, fields, namespace);
  if (properties) {
    properties.filter(property => property.isComposite).forEach(property => {
      structImplementationForSelectionSet(
        generator,
        {
          structName: namespace + structNameForProperty(property),
          parentType: getNamedType(property.type),
          fields: property.fields,
          fragmentSpreads: property.fragmentSpreads,
          inlineFragments: property.inlineFragments
        },
        namespace
      );
    });
  }
  structImplementation(generator, { structName: structName, adoptedProtocols }, () => {
    if (beforeClosure) {
      beforeClosure();
    }

    if (possibleTypes) {
      generator.printNewlineIfNeeded();
      generator.printOnNewline('public static let possibleTypes = [');
      generator.print(join(possibleTypes.map(type => `"${String(type)}"`), ', '));
      generator.print(']');
    }

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

    generator.printNewlineIfNeeded();

    // if (parentType) {
    //   generator.printOnNewline('- (NSString *)__typename');
    //   generator.withinBlock(() => {
    //     if (isAbstractType(parentType)) {
    //       generator.print(`: String`);
    //     } else {
    //       generator.printOnNewline(`return @"${String(parentType)}"`);
    //     }
    //   });
    // }

    // propertyImplementations(generator, properties);
    //
    // if (fragmentProperties && fragmentProperties.length > 0) {
    //   generator.printNewlineIfNeeded();
    //   propertyImplementation(generator, { propertyName: 'fragments', typeName: 'Fragments' })
    // }
    //
    // if (inlineFragmentProperties && inlineFragmentProperties.length > 0) {
    //   generator.printNewlineIfNeeded();
    //   propertyImplementations(generator, inlineFragmentProperties);
    // }

    generator.printNewlineIfNeeded();
    generator.printOnNewline('- (nonnull instancetype)initWithDictionary:(nullable NSDictionary *)dictionary');
    generator.withinBlock(() => {
      generator.printOnNewline('if (self = [super init])');
      generator.withinBlock(() => {
        generator.withinBlock(() => {
          if (parentType && isAbstractType(parentType)) {
            generator.printOnNewline(`__typename = try reader.value(for: Field(responseName: "__typename"))`);
          }

          if (properties) {
            properties.forEach(property => initializationForProperty(generator, property, namespace));
          }

          if (fragmentProperties && fragmentProperties.length > 0) {
            generator.printNewlineIfNeeded();
            fragmentProperties.forEach(({ propertyName, typeName, bareTypeName, isProperSuperType }) => {
              generator.printOnNewline(`let ${propertyName} = try ${typeName}(reader: reader`);
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
              generator.printOnNewline(`${propertyName} = try ${bareTypeName}(reader: reader, ifTypeMatches: __typename)`);
            });
          }
        });
      });
      generator.printOnNewline('return self;');
    });

    if (fragmentProperties && fragmentProperties.length > 0) {
      structImplementation(
        generator,
        {
          structName: namespace + 'Fragments'
        },
        () => {
          fragmentProperties.forEach(({ propertyName, typeName, isProperSuperType }) => {
            if (!isProperSuperType) {
              typeName += '?';
            }
            propertyImplementation(generator, { propertyName, typeName });
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
            fragmentSpreads: property.fragmentSpreads
          }
        );
      });
    }
  });
}

export function mapAssignmentValueForProperty(context, fieldName, type, className, responseName, dictionaryName = 'dictionary') {
  if (type instanceof GraphQLNonNull) {
    return mapAssignmentValueForProperty(
      context,
      fieldName,
      type.ofType,
      className,
      responseName
    )
  }
  if (type instanceof GraphQLList) {
    return 'list';
  } else if (type instanceof GraphQLScalarType) {
    return `${dictionaryName}[@"${fieldName}"]`
  } else {
    return `[[${className} alloc] initWithDictionary:${dictionaryName}[@"${fieldName}"]]`;
  }
}

export function initializationForProperty(generator, { propertyName, responseName, fieldName, type, isOptional }, namespace) {
  const className = namespace + structNameForProperty({responseName: responseName});
  console.log(className);
  generator.printOnNewline(`_${propertyName} = ${mapAssignmentValueForProperty(
    generator.context,
    fieldName,
    type,
    className,
    responseName
  )};`);
}

export function propertiesFromFields(context, fields, namespace) {
  return fields.map(field => propertyFromField(context, field, namespace));
}

export function propertyFromField(context, field, namespace) {
  const name = field.name || field.responseName;
  const propertyName = camelCase(name);

  const type = field.type;
  const isOptional = field.isConditional || !(type instanceof GraphQLNonNull || type.ofType instanceof GraphQLNonNull);
  const bareType = getNamedType(type);

  if (isCompositeType(bareType)) {
    const bareTypeName = pascalCase(Inflector.singularize(propertyName));
    const typeName = typeNameFromGraphQLType({context, type, bareTypeName, isOptional, namespace});
    return { ...field, propertyName, typeName, bareTypeName, isOptional, isComposite: true };
  } else {
    const typeName = typeNameFromGraphQLType({context, type, isOptional, namespace});
    return { ...field, propertyName, typeName, isOptional, isComposite: false };
  }
}

export function structNameForProperty({responseName}) {
  return pascalCase(Inflector.singularize(responseName));
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

export function typeDeclarationForGraphQLType(generator, type, namespace = '') {
  if (type instanceof GraphQLEnumType) {
    enumerationDeclaration(generator, type);
  } else if (type instanceof GraphQLInputObjectType) {
    structDeclarationForInputObjectType(generator, type, namespace);
  }
}

export function typeImplementationForGraphQLType(generator, type, namespace = '') {
  if (type instanceof GraphQLEnumType) {
    enumerationImplementation(generator, type);
  } else if (type instanceof GraphQLInputObjectType) {
    structImplementationForInputObjectType(generator, type, namespace);
  }
}

function enumerationDeclaration(generator, type) {
  const { name, description } = type;
  const values = type.getValues();

  generator.printNewlineIfNeeded();
  generator.printOnNewline(description && `/// ${description}`);
  generator.printOnNewline(`public enum ${name}: String`);
  generator.withinBlock(() => {
    values.forEach(value =>
      generator.printOnNewline(`case ${camelCase(value.name)} = "${value.value}"${wrap(' /// ', value.description)}`)
    );
  });
  generator.printNewline();
  generator.printOnNewline(`extension ${name}: JSONDecodable, JSONEncodable {}`);
}

function structDeclarationForInputObjectType(generator, type, namespace) {
  const { name: structName, description } = type;
  const adoptedProtocols = ['GraphQLMapConvertible'];
  const properties = propertiesFromFields(generator.context, Object.values(type.getFields()));

  structDeclaration(generator, { structName, description, adoptedProtocols }, () => {
    // Compute permutations with and without optional properties
    let permutations = [[]];
    for (const property of properties) {
      permutations = [].concat(...permutations.map(prefix => {
        if (property.isOptional) {
          return [prefix, [...prefix, property]];
        } else {
          return [[...prefix, property]];
        }
      }));
    }

    permutations.forEach(properties => {
      generator.printNewlineIfNeeded();
      initializerDeclarationForProperties(generator, properties, namespace);
    });

    // Declare properties
    properties.forEach(property => {
      propertyDeclaration(generator, property);
    })
  });

  generator.printNewlineIfNeeded();
}

function structImplementationForInputObjectType(generator, type) {
  const { name: structName, description } = type;
  const adoptedProtocols = ['GraphQLMapConvertible'];
  const properties = propertiesFromFields(generator.context, Object.values(type.getFields()));

  structImplementation(generator, { structName, description, adoptedProtocols }, () => {
    // Compute permutations with and without optional properties
    let permutations = [[]];
    for (const property of properties) {
      permutations = [].concat(...permutations.map(prefix => {
        if (property.isOptional) {
          return [prefix, [...prefix, property]];
        } else {
          return [[...prefix, property]];
        }
      }));
    }

    permutations.forEach(properties => {
      generator.printNewlineIfNeeded();
      initializerImplementationForProperties(generator, properties);
    });
    generator.printNewline();
    mappedProperty(generator, { functionName: 'dictionaryRepresentation' }, properties);
    generator.printNewlineIfNeeded();
  });
}

export function valueForProperty(propertyName, type) {
  if (type instanceof GraphQLNonNull) {
    return valueForProperty(propertyName, type.ofType);
  }

  if (type instanceof GraphQLEnumType) {
    // return `[[self class] ${enumStringMappingFunctionNameForType(fieldType)}]`
    return `NOT YET SUPPORTED`
  } else if (type instanceof GraphQLInputObjectType) {
    return `[_${camelCase(propertyName)} dictionaryRepresentation]`
  } else if (type === GraphQLScalarType) {
    const propertyAttribute = propertyAttributeFromGraphQLType(propertyType);
    return propertyAttribute === 'copy' ?  `[_${propertyName} copy]` : `${propertyName}`
  } else {
    return `_${propertyName}`
  }
}
