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
  objectTypeNameWithGraphQLType
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

export function initializeProperty(generator, property, namespace) {
  const propertyValue = valueForGraphQLType(
    generator.context,
    property,
    namespace,
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
  namespace,
  dictionaryName
) {
  if (fieldType instanceof GraphQLNonNull) {
    return valueForGraphQLType(
      context,
      {
        fieldType: fieldType.ofType,
        fieldName,
      },
      namespace,
      dictionaryName
    )
  }

  const dictionaryAccessor = dictionaryName + (fieldName.length ? `[@"${ fieldName }"]` : '');
  if (fieldType instanceof GraphQLList) {
    const scopedDictionaryName = Inflector.singularize(fieldName);
    const subValue = valueForGraphQLType(
      context,
      {
        fieldType: fieldType.ofType,
        fieldName,
      },
      namespace,
      scopedDictionaryName
    )
    return `${dictionaryAccessor}.map(^id(NSDictionary *${scopedDictionaryName}) { return ${subValue};})`
  } else if (fieldType instanceof GraphQLScalarType) {
    return valueForScalar(fieldName, dictionaryAccessor);
  } else if (fieldType instanceof GraphQLEnumType) {
    return fieldType.value;
  } else {
    const propertyName = pascalCase(Inflector.singularize(fieldName));
    return `[[${objectTypeNameWithGraphQLType(propertyName, propertyName, namespace)} alloc] initWithDictionary:${dictionaryAccessor}]`;
  }
}
