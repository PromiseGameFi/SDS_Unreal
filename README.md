Unreal Blueprint Usage: Somnia Service Nodes

This guide explains how each Blueprint async node maps to a somnia-service endpoint and how to use them in Unreal.

Overview
- All nodes are asynchronous and expose two delegates: OnSuccess(ResponseJson, StatusCode) and OnError(ErrorMessage, StatusCode).
- Base URL defaults to http://localhost:3000. Change it at runtime if needed.

Setup (Base URL)
- Node name: USomniaServiceConfig.SetBaseUrl
- Usage: Call once (e.g., in BeginPlay) with your service URL. Trailing slashes are trimmed.

Core Info Nodes
- Health → Node: USomniaEndpointAsync.Health (GET /health)
- Status → Node: USomniaEndpointAsync.Status (GET /status)
- Publisher → Node: USomniaEndpointAsync.Publisher (GET /publisher)

Schemas (Definition)
- Compute schemaId → Node: USomniaEndpointAsync.SchemasCompute (POST /schemas/compute)
- Register schema → Node: USomniaEndpointAsync.SchemasRegister (POST /schemas/register)
- List schemas → Node: USomniaEndpointAsync.SchemasList (GET /schemas)
- Get schema by label → Node: USomniaEndpointAsync.SchemasGet (GET /schemas/:label)

Schema Versioning (Optional)
- Register version → Node: USomniaEndpointAsync.SchemasRegisterVersion (POST /schemas/registerVersion)
- Set latest → Node: USomniaEndpointAsync.SchemasSetLatest (POST /schemas/setLatest)
- List versions → Node: USomniaEndpointAsync.SchemasVersions (GET /schemas/versions/:label)
- Get version → Node: USomniaEndpointAsync.SchemasVersion (GET /schemas/version/:label/:version)
- Deprecate version → Node: USomniaEndpointAsync.SchemasDeprecate (POST /schemas/deprecate)
- Diff schemas → Node: USomniaEndpointAsync.SchemasDiff (POST /schemas/diff)

Encode & Publish
- Encode values → Node: USomniaEndpointAsync.SchemasEncode (POST /schemas/encode)
- Publish data → Node: USomniaEndpointAsync.DataPublish (POST /data/publish)
  Example ValuesJson for chat schema ("uint64 timestamp, string message, address sender"):
  {
    "timestamp": 1762545795960,
    "message": "hello somnia",
    "sender": "0xc8F59daEa91f30F4F6D85E5c510d78bd1ac4b19e"
  }
  Tips:
  - Use integer milliseconds for timestamp.
  - Use the checksummed publisher address (retrieve via Publisher node).
  - On success, ResponseJson contains schemaId and dataId.

Read by Key
- Read data → Node: USomniaEndpointAsync.DataGetByKey (POST /data/getByKey)
  Provide schemaId, publisher, and dataId.

Subscriptions (Push Updates)
- Create subscription → Node: USomniaEndpointAsync.Subscribe (POST /subscribe)
- Simple subscription → Node: USomniaEndpointAsync.SubscribeSimple (POST /subscribe)
- Streams subscription → Node: USomniaEndpointAsync.StreamsSubscribe (POST /streams/subscribe)
- Streams simple → Node: USomniaEndpointAsync.StreamsSubscribeSimple (POST /streams/subscribe)
  Note: To receive push data, connect a WebSocket client to ws://localhost:3000/ws.

Test Utilities
- Ping → Node: USomniaEndpointAsync.TestPing (GET /test/ping)
- Emit test data → Node: USomniaEndpointAsync.TestEmit (POST /test/emit)

Generic Raw Caller
- Node: USomniaEndpointAsync.CallRaw
- Use for custom methods/paths/bodies not covered by dedicated nodes.

Typical Chat Flow in Blueprints
1) BeginPlay: USomniaServiceConfig.SetBaseUrl("http://localhost:3000"); then call Health and Status.
2) Ensure schema: USomniaEndpointAsync.SchemasRegister("chat", "uint64 timestamp, string message, address sender").
3) Get publisher: USomniaEndpointAsync.Publisher → store Address.
4) Publish: USomniaEndpointAsync.DataPublish("chat", "", "", ValuesJson).
5) Read back: USomniaEndpointAsync.DataGetByKey("chat", schemaId, Address, dataId); verify contents.

Handling JSON
- ResponseJson is a string. Use a JSON parsing plugin or add C++ helpers if you need structured Blueprint pins.

Error Tips
- Address invalid → use the checksummed address from Publisher.
- Timestamp issues → must be integer milliseconds.
- Deprecated schema version → either switch to latest or set AllowDeprecated=true when publishing.

Source Locations
- Header: Source/UnrealCpp/Public/SomniaServiceBlueprintNodes.h
- Implementation: Source/UnrealCpp/Private/SomniaServiceBlueprintNodes.cpp