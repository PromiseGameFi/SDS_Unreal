#include "SomniaServiceBlueprintNodes.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"

// USomniaServiceConfig
FString USomniaServiceConfig::BaseUrl = TEXT("http://localhost:3000");

void USomniaServiceConfig::SetBaseUrl(const FString& InBaseUrl) {
  FString Tmp = InBaseUrl;
  while (Tmp.EndsWith(TEXT("/"))) { Tmp = Tmp.LeftChop(1); }
  BaseUrl = Tmp;
}

FString USomniaServiceConfig::GetBaseUrl() {
  return BaseUrl;
}

// Helpers (file-local)
static FString BuildArrayJson(const TArray<FString>& Arr, bool bRaw) {
  FString Out = TEXT("[");
  for (int32 i = 0; i < Arr.Num(); ++i) {
    Out += bRaw ? USomniaEndpointAsync::RawJson(Arr[i]) : USomniaEndpointAsync::QuoteJson(Arr[i]);
    if (i < Arr.Num() - 1) { Out += TEXT(","); }
  }
  Out += TEXT("]");
  return Out;
}

// USomniaEndpointAsync static helpers
FString USomniaEndpointAsync::QuoteJson(const FString& S) {
  FString Esc = S;
  Esc.ReplaceInline(TEXT("\\"), TEXT("\\\\"));
  Esc.ReplaceInline(TEXT("\""), TEXT("\\\""));
  return FString::Printf(TEXT("\"%s\""), *Esc);
}

FString USomniaEndpointAsync::RawJson(const FString& Json) {
  return Json.IsEmpty() ? TEXT("null") : Json;
}

// Factory
USomniaEndpointAsync* USomniaEndpointAsync::CallRaw(const FString& Method, const FString& Path, const FString& BodyJson) {
  USomniaEndpointAsync* Node = NewObject<USomniaEndpointAsync>();
  Node->Verb = Method;
  Node->EndpointPath = Path;
  Node->Body = BodyJson;
  return Node;
}

// Utility
USomniaEndpointAsync* USomniaEndpointAsync::Health() { return CallRaw(TEXT("GET"), TEXT("/health")); }
USomniaEndpointAsync* USomniaEndpointAsync::Status() { return CallRaw(TEXT("GET"), TEXT("/status")); }
USomniaEndpointAsync* USomniaEndpointAsync::Publisher() { return CallRaw(TEXT("GET"), TEXT("/publisher")); }

// Schemas basic
USomniaEndpointAsync* USomniaEndpointAsync::SchemasCompute(const FString& Schema) {
  const FString Body = FString::Printf(TEXT("{\"schema\":%s}"), *QuoteJson(Schema));
  return CallRaw(TEXT("POST"), TEXT("/schemas/compute"), Body);
}

USomniaEndpointAsync* USomniaEndpointAsync::SchemasRegister(const FString& Label, const FString& Schema, const FString& ParentSchemaId, bool IgnoreIfRegistered) {
  const FString Body = FString::Printf(TEXT("{\"label\":%s,\"schema\":%s,\"parentSchemaId\":%s,\"ignoreIfRegistered\":%s}"), *QuoteJson(Label), *QuoteJson(Schema), *QuoteJson(ParentSchemaId), IgnoreIfRegistered ? TEXT("true") : TEXT("false"));
  return CallRaw(TEXT("POST"), TEXT("/schemas/register"), Body);
}

USomniaEndpointAsync* USomniaEndpointAsync::SchemasList() { return CallRaw(TEXT("GET"), TEXT("/schemas")); }

USomniaEndpointAsync* USomniaEndpointAsync::SchemasGet(const FString& Label) {
  return CallRaw(TEXT("GET"), FString::Printf(TEXT("/schemas/%s"), *Label));
}

// Versioning
USomniaEndpointAsync* USomniaEndpointAsync::SchemasRegisterVersion(const FString& Label, const FString& Version, const FString& Schema, const FString& ParentSchemaId, bool IgnoreIfRegistered) {
  const FString Body = FString::Printf(TEXT("{\"label\":%s,\"version\":%s,\"schema\":%s,\"parentSchemaId\":%s,\"ignoreIfRegistered\":%s}"), *QuoteJson(Label), *QuoteJson(Version), *QuoteJson(Schema), *QuoteJson(ParentSchemaId), IgnoreIfRegistered ? TEXT("true") : TEXT("false"));
  return CallRaw(TEXT("POST"), TEXT("/schemas/registerVersion"), Body);
}

USomniaEndpointAsync* USomniaEndpointAsync::SchemasSetLatest(const FString& Label, const FString& Version) {
  const FString Body = FString::Printf(TEXT("{\"label\":%s,\"version\":%s}"), *QuoteJson(Label), *QuoteJson(Version));
  return CallRaw(TEXT("POST"), TEXT("/schemas/setLatest"), Body);
}

USomniaEndpointAsync* USomniaEndpointAsync::SchemasVersions(const FString& Label) {
  return CallRaw(TEXT("GET"), FString::Printf(TEXT("/schemas/versions/%s"), *Label));
}

USomniaEndpointAsync* USomniaEndpointAsync::SchemasVersion(const FString& Label, const FString& Version) {
  return CallRaw(TEXT("GET"), FString::Printf(TEXT("/schemas/version/%s/%s"), *Label, *Version));
}

USomniaEndpointAsync* USomniaEndpointAsync::SchemasDiff(const FString& LeftLabel, const FString& LeftVersion, const FString& LeftSchema,
                                                        const FString& RightLabel, const FString& RightVersion, const FString& RightSchema) {
  const FString LeftObj = FString::Printf(TEXT("{\"label\":%s,\"version\":%s,\"schema\":%s}"), *QuoteJson(LeftLabel), *QuoteJson(LeftVersion), *QuoteJson(LeftSchema));
  const FString RightObj = FString::Printf(TEXT("{\"label\":%s,\"version\":%s,\"schema\":%s}"), *QuoteJson(RightLabel), *QuoteJson(RightVersion), *QuoteJson(RightSchema));
  const FString Body = FString::Printf(TEXT("{\"left\":%s,\"right\":%s}"), *LeftObj, *RightObj);
  return CallRaw(TEXT("POST"), TEXT("/schemas/diff"), Body);
}

USomniaEndpointAsync* USomniaEndpointAsync::SchemasDeprecate(const FString& Label, const FString& Version, bool Deprecated) {
  const FString Body = FString::Printf(TEXT("{\"label\":%s,\"version\":%s,\"deprecated\":%s}"), *QuoteJson(Label), *QuoteJson(Version), Deprecated ? TEXT("true") : TEXT("false"));
  return CallRaw(TEXT("POST"), TEXT("/schemas/deprecate"), Body);
}

// Encode and Publish
USomniaEndpointAsync* USomniaEndpointAsync::SchemasEncode(const FString& Label, const FString& Schema, const FString& ValuesJson, const FString& Version) {
  const FString Body = FString::Printf(TEXT("{\"label\":%s,\"schema\":%s,\"values\":%s,\"version\":%s}"), *QuoteJson(Label), *QuoteJson(Schema), *RawJson(ValuesJson), *QuoteJson(Version));
  return CallRaw(TEXT("POST"), TEXT("/schemas/encode"), Body);
}

USomniaEndpointAsync* USomniaEndpointAsync::DataPublish(const FString& Label, const FString& Schema, const FString& SchemaId, const FString& ValuesJson, const FString& DataId, const FString& ParentSchemaId, const FString& Version, bool AllowDeprecated) {
  const FString Body = FString::Printf(TEXT("{\"label\":%s,\"schema\":%s,\"schemaId\":%s,\"values\":%s,\"dataId\":%s,\"parentSchemaId\":%s,\"version\":%s,\"allowDeprecated\":%s}"), *QuoteJson(Label), *QuoteJson(Schema), *QuoteJson(SchemaId), *RawJson(ValuesJson), *QuoteJson(DataId), *QuoteJson(ParentSchemaId), *QuoteJson(Version), AllowDeprecated ? TEXT("true") : TEXT("false"));
  return CallRaw(TEXT("POST"), TEXT("/data/publish"), Body);
}

USomniaEndpointAsync* USomniaEndpointAsync::DataGetByKey(const FString& Label, const FString& SchemaId, const FString& Publisher, const FString& DataId) {
  const FString Body = FString::Printf(TEXT("{\"label\":%s,\"schemaId\":%s,\"publisher\":%s,\"dataId\":%s}"), *QuoteJson(Label), *QuoteJson(SchemaId), *QuoteJson(Publisher), *QuoteJson(DataId));
  return CallRaw(TEXT("POST"), TEXT("/data/getByKey"), Body);
}

// Subscriptions
USomniaEndpointAsync* USomniaEndpointAsync::SubscribeSimple(const FString& EventId, const FString& Context, bool OnlyPushChanges, bool LatestOnly, bool ExcludeDeprecated) {
  TArray<FString> Labels;
  return Subscribe(EventId, Context, OnlyPushChanges, LatestOnly, ExcludeDeprecated, Labels);
}

USomniaEndpointAsync* USomniaEndpointAsync::StreamsSubscribeSimple(const FString& EventId, const TArray<FString>& EthCalls, const FString& Context, bool OnlyPushChanges, bool LatestOnly, bool ExcludeDeprecated) {
  TArray<FString> Labels;
  return StreamsSubscribe(EventId, EthCalls, Context, OnlyPushChanges, LatestOnly, ExcludeDeprecated, Labels);
}

USomniaEndpointAsync* USomniaEndpointAsync::StreamsSubscribe(const FString& EventId, const TArray<FString>& EthCalls, const FString& Context, bool OnlyPushChanges, bool LatestOnly, bool ExcludeDeprecated, const TArray<FString>& Labels) {
  const FString LabelsJson = BuildArrayJson(Labels, /*bRaw*/false);
  const FString EthCallsJson = BuildArrayJson(EthCalls, /*bRaw*/true);
  const FString Body = FString::Printf(TEXT("{\"somniaStreamsEventId\":%s,\"ethCalls\":%s,\"context\":%s,\"onlyPushChanges\":%s,\"latestOnly\":%s,\"excludeDeprecated\":%s,\"labels\":%s}"), *QuoteJson(EventId), *EthCallsJson, *QuoteJson(Context), OnlyPushChanges ? TEXT("true") : TEXT("false"), LatestOnly ? TEXT("true") : TEXT("false"), ExcludeDeprecated ? TEXT("true") : TEXT("false"), *LabelsJson);
  return CallRaw(TEXT("POST"), TEXT("/streams/subscribe"), Body);
}

// Test
USomniaEndpointAsync* USomniaEndpointAsync::TestPing() { return CallRaw(TEXT("GET"), TEXT("/test/ping")); }

USomniaEndpointAsync* USomniaEndpointAsync::TestEmit(const FString& DataJson) {
  const FString Body = FString::Printf(TEXT("{\"data\":%s}"), *RawJson(DataJson));
  return CallRaw(TEXT("POST"), TEXT("/test/emit"), Body);
}

// Execute
void USomniaEndpointAsync::Activate() {
  FString Path = EndpointPath;
  if (!Path.StartsWith(TEXT("/"))) { Path = TEXT("/") + Path; }
  const FString Url = USomniaServiceConfig::GetBaseUrl() + Path;

  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
  Request->SetURL(Url);
  Request->SetVerb(Verb);
  Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
  if (!Body.IsEmpty()) { Request->SetContentAsString(Body); }

  Request->OnProcessRequestComplete().BindLambda([this](FHttpRequestPtr Req, FHttpResponsePtr Resp, bool bWasSuccessful) {
    const int32 Status = (Resp.IsValid() ? Resp->GetResponseCode() : -1);
    if (bWasSuccessful && Resp.IsValid() && Status >= 200 && Status < 300) {
      OnSuccess.Broadcast(Resp->GetContentAsString(), Status);
    } else {
      const FString Err = Resp.IsValid() ? Resp->GetContentAsString() : TEXT("Request failed");
      OnError.Broadcast(Err, Status);
    }
  });

  Request->ProcessRequest();
}