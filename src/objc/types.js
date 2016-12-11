import {
  join,
  block,
  wrap,
  indent
} from '../utilities/printing';

import { camelCase } from 'change-case';

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLEnumType
} from 'graphql';

const builtInScalarPropertyAttributesMap = {
  [GraphQLString.name]: 'copy',
  [GraphQLInt.name]: 'strong',
  [GraphQLFloat.name]: 'strong',
  [GraphQLBoolean.name]: 'strong',
  [GraphQLID.name]: 'copy',
  [GraphQLList.name]: 'copy',
}

const builtInScalarMap = {
  [GraphQLString.name]: 'NSString',
  [GraphQLInt.name]: 'NSNumber',
  [GraphQLFloat.name]: 'NSNumber',
  [GraphQLBoolean.name]: 'NSNumber',
  [GraphQLID.name]: 'NSString',
}

export function propertyAttributeFromGraphQLType(type) {
  if (type instanceof GraphQLNonNull) {
    return propertyAttributeFromGraphQLType(type.ofType);
  } else if (type instanceof GraphQLList || type instanceof GraphQLScalarType) {
    return builtInScalarPropertyAttributesMap[type.name];
  } else {
    return 'strong';
  }
}

export function typeNameFromGraphQLType(context, type, bareTypeName) {
  if (type instanceof GraphQLNonNull) {
    return typeNameFromGraphQLType(context, type.ofType, bareTypeName)
  }

  let typeName;
  if (type instanceof GraphQLList) {
    typeName = 'NSArray<' + typeNameFromGraphQLType(context, type.ofType, bareTypeName) + ' *>';
  } else if (type instanceof GraphQLScalarType) {
    typeName = builtInScalarMap[type.name] || (context.passthroughCustomScalars ? type.name: GraphQLString);
  } else {
    typeName = bareTypeName || type.name;
  }

  return typeName;
}
