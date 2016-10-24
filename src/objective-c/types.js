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
  [GraphQLString.name]: 'NSString *',
  [GraphQLInt.name]: 'NSNumber *',
  [GraphQLFloat.name]: 'NSNumber *',
  [GraphQLBoolean.name]: 'NSNumber *',
  [GraphQLID.name]: 'GraphQLID',
}

export function objectTypeNameWithGraphQLType(typeName, bareTypeName, namespace = '') {
  return namespace + (bareTypeName || typeName);
}

export function typeNameFromGraphQLType(context, type, bareTypeName, namespace = '') {
  if (type instanceof GraphQLNonNull) {
    return typeNameFromGraphQLType(context, type.ofType, bareTypeName, namespace)
  }

  let typeName;
  if (type instanceof GraphQLList) {
    typeName = 'NSArray<' + typeNameFromGraphQLType(context, type.ofType, bareTypeName, namespace) + '> *';
  } else if (type instanceof GraphQLScalarType) {
    typeName = builtInScalarMap[type.name] || (context.passthroughCustomScalars ? type.name: GraphQLString);
  } else if (type instanceof GraphQLInputObjectType) {
    typeName = type.name + ' *';
  } else if (type instanceof GraphQLEnumType) {
    typeName = type.name + ' ';
  } else {
    typeName = objectTypeNameWithGraphQLType(type.name, bareTypeName, namespace) + ' *';
  }

  return typeName;
}
