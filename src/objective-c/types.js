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

const builtInScalarMap = {
  [GraphQLString.name]: 'NSString *',
  [GraphQLInt.name]: 'NSNumber *',
  [GraphQLFloat.name]: 'NSNumber *',
  [GraphQLBoolean.name]: 'NSNumber *',
  [GraphQLID.name]: 'GraphQLID',
}

export function typeNameFromGraphQLType(context, type, bareTypeName) {
  let typeName;
  if (type instanceof GraphQLList) {
    typeName = '[' + typeNameFromGraphQLType(context, type.ofType, bareTypeName) + ']';
  } else if (type instanceof GraphQLScalarType) {
    typeName = builtInScalarMap[type.name] || (context.passthroughCustomScalars ? type.name: GraphQLString);
  } else {
    typeName = bareTypeName || type.name;
  }

  return typeName;
}
