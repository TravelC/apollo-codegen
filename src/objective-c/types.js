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
  GraphQLObjectType
} from 'graphql';

const builtInScalarMap = {
  [GraphQLString.name]: 'NSString *',
  [GraphQLInt.name]: 'NSNumber *',
  [GraphQLFloat.name]: 'NSNumber *',
  [GraphQLBoolean.name]: 'NSNumber *',
  [GraphQLID.name]: 'GraphQLID',
}

export function typeNameFromGraphQLType(context, type, bareTypeName, namespace = '') {
  if (type instanceof GraphQLNonNull) {
    return typeNameFromGraphQLType(context, type.ofType, bareTypeName, namespace)
  }

  let typeName;
  if (type instanceof GraphQLList) {
    typeName = 'NSArray<' + typeNameFromGraphQLType(context, type.ofType, bareTypeName) + '> *';
  } else if (type instanceof GraphQLScalarType) {
    typeName = builtInScalarMap[type.name] || (context.passthroughCustomScalars ? type.name: GraphQLString);
  } else if (type instanceof GraphQLEnumType) {
    typeName = type.name + ' ';
  } else {
    typeName = namespace + (bareTypeName || type.name) + ' ';
  }

  return typeName;
}
