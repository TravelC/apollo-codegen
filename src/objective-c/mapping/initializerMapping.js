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

  let value = '';
  const dictionaryAccessor = dictionaryName + (fieldName.length ? `[@"${ fieldName }"]` : '');
  if (fieldType instanceof GraphQLList) {
    value = `${dictionaryAccessor}.map(^id(NSDictionary *obj) { return ${valueForGraphQLType(context,
      {
      fieldType: fieldType.ofType,
      fieldName,
    },
    namespace,
    'obj')}})`
  } else if (fieldType instanceof GraphQLScalarType) {
    value = valueForScalar(fieldName, dictionaryAccessor);
  } else if (fieldType instanceof GraphQLEnumType) {
    value = fieldType.value;
  } else {
    console.log("prop name:" + propertyName);
    const propertyName = pascalCase(Inflector.singularize(fieldName));
    value = `[[${objectTypeNameWithGraphQLType(propertyName, propertyName, namespace)} alloc] initWithDictionary:${dictionaryAccessor}]`;
  }

  return value;
}
