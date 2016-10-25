# Apollo GraphQL code generator

[![GitHub license](https://img.shields.io/badge/license-MIT-lightgrey.svg?maxAge=2592000)](https://raw.githubusercontent.com/apollostack/apollo-ios/master/LICENSE) [![npm](https://img.shields.io/npm/v/apollo-codegen.svg)](https://www.npmjs.com/package/apollo-codegen) [![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](http://www.apollostack.com/#slack)

This is a tool to generate API code based on a GraphQL schema and query documents.

It currently only generates Swift code, but we hope to add support for other targets in the future. See [Apollo iOS](https://github.com/apollostack/apollo-ios) for details on the mapping from GraphQL results to Swift types, as well as runtime support for executing queries and mutations.

## Usage

If you want to experiment with the tool, you can install the `apollo-codegen` command globally:

```sh
npm install -g apollo-codegen
```

To download a GraphQL schema by sending an introspection query to a server:

```sh
apollo-codegen download-schema http://localhost:8080/graphql --output schema.json
```

You can use the `header` option to add additional HTTP headers to the request. For example, to include an authentication token, use `--header "Authorization: Bearer <token>"`.

To generate Swift code from a set of query definitions in `.graphql` files:

```sh
apollo-codegen generate **/*.graphql --schema schema.json --output API --target swift
```


To generate Objc code from a set of query definitions in `.graphql` files:

```sh
apollo-codegen generate **/*.graphql --schema schema.json --output API --target objc
```


Heres a really basic setup I made for the purposes of testing out objc target for now

```objc
AFHTTPSessionManager *manager = [AFHTTPSessionManager manager];
UpcomingUserEventsQuery *query = [[UpcomingUserEventsQuery alloc] initWithAuthToken:@"<auth_token>"
                                                                              query:nil
                                                                               page:nil
                                                                            perPage:nil];

NSDictionary *operationDef = [query performSelector:@selector(operationDefinition)];
NSDictionary *variables = [query performSelector:@selector(variables)];

NSMutableDictionary *dict = [variables mutableCopy];
NSArray *keysForNullValues = [dict allKeysForObject:[NSNull null]];
[dict removeObjectsForKeys:keysForNullValues];

[manager POST:@"http://localhost:3000/queries"
   parameters:@{
                @"query" : operationDef,
                @"variables" : dict
                }
constructingBodyWithBlock:nil
     progress:nil
      success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
          UpcomingUserEventsQueryResponseData *data = [[UpcomingUserEventsQueryResponseData alloc] initWithDictionary:responseObject[@"data"]];
          NSLog(@"%@", data.user.events.results.firstObject.toNode.title);
      }
      failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {

      }];
```

Still a ton of low hanging fruit here and am by no means close to finish on this yet so use at your own risk!

## Contributing

[![Build status](https://travis-ci.org/apollostack/apollo-codegen.svg?branch=master)](https://travis-ci.org/apollostack/apollo-codegen)

Running tests locally:

```
npm install
npm test
```
