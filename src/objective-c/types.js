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
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLInputObjectType
} from 'graphql';

const builtInScalarMap = {
  [GraphQLString.name]: 'NSString',
  [GraphQLInt.name]: 'NSNumber',
  [GraphQLFloat.name]: 'NSNumber',
  [GraphQLBoolean.name]: 'NSNumber',
  [GraphQLID.name]: 'GraphQLID',
}

export function baseTypeNameFromGraphQLType(context, type, bareTypeName) {
  if (type instanceof GraphQLNonNull) {
    return baseTypeNameFromGraphQLType(context, type.ofType, bareTypeName)
  }

  let typeName;
  if (type instanceof GraphQLList) {
    typeName = baseTypeNameFromGraphQLType(context, type.ofType, bareTypeName);
  } else if (type instanceof GraphQLScalarType) {
    typeName = builtInScalarMap[type.name] || (context.passthroughCustomScalars ? type.name: GraphQLString);
  } else if (type instanceof GraphQLObjectType) {
    typeName = type.name;
  } else {
    typeName = bareTypeName || type.name;
  }

  return typeName;
}

export function typeNameFromGraphQLType(context, type, bareTypeName) {
  if (type instanceof GraphQLList) {
    const subType = typeNameFromGraphQLType(context, type.ofType, bareTypeName);
    return `NSArray<${subType} *>`;
  } else {
    return baseTypeNameFromGraphQLType(context, type, bareTypeName);
  }
}
