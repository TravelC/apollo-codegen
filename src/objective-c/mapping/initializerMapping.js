import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLEnumType,
} from 'graphql';

import Inflector from 'inflected';

import {
  baseTypeNameFromGraphQLType,
  typeNameFromGraphQLType
} from './../types';

import { pascalCase } from 'change-case';

export function valueForScalar(scalar, accessorName) {
  if (scalar === GraphQLString) {
    return `[${accessorName} copy]`;
  } else if (scalar === GraphQLInt) {
    return `@([${accessorName} integerValue])`;
  } else if (scalar === GraphQLFloat) {
    return `@([${accessorName} floatValue])`;
  } else if (scalar === GraphQLBoolean) {
    return `@([${accessorName} boolValue])`;
  } else {
    return `${accessorName}`;
  }
}

export function initializeProperty(generator, property) {
  const propertyValue = valueForGraphQLType(
    generator.context,
    property,
    'dictionary'
  );
  generator.printOnNewline(`_${property.propertyName} = ${propertyValue};`);
}

export function valueForGraphQLType(
  context,
  {
    fieldType,
    fieldName,
  },
  dictionaryName,
  dictionaryKey = fieldName
) {
  if (fieldType instanceof GraphQLNonNull) {
    return valueForGraphQLType(
      context,
      {
        fieldType: fieldType.ofType,
        fieldName,
      },
      dictionaryName
    )
  }

  const dictionaryAccessor = dictionaryName + (dictionaryKey.length ? `[@"${ dictionaryKey }"]` : '');
  if (fieldType instanceof GraphQLList) {
    const scopedDictionaryName = Inflector.singularize(fieldName);
    const subValue = valueForGraphQLType(
      context,
      {
        fieldType: fieldType.ofType,
        fieldName,
      },
      scopedDictionaryName,
      ''
    )
    return `[${dictionaryAccessor} map:(^id(NSDictionary *${scopedDictionaryName}) { return ${subValue};})];`
  } else if (fieldType instanceof GraphQLScalarType) {
    return valueForScalar(fieldName, dictionaryAccessor);
  } else if (fieldType instanceof GraphQLEnumType) {
    return fieldType.value;
  } else {
    return `[[${baseTypeNameFromGraphQLType(context, fieldType)} alloc] initWithDictionary:${dictionaryAccessor}]`;
  }
}
