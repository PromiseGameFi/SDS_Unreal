#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintAsyncActionBase.h"
#include "SomniaServiceBlueprintNodes.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSomniaEndpointSuccess, FString, ResponseJson, int32, StatusCode);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSomniaEndpointError, FString, ErrorMessage, int32, StatusCode);

UCLASS(BlueprintType)
class USomniaServiceConfig : public UObject {
  GENERATED_BODY()
public:
  UFUNCTION(BlueprintCallable, Category="SomniaService")
  static void SetBaseUrl(const FString& InBaseUrl);

  UFUNCTION(BlueprintPure, Category="SomniaService")
  static FString GetBaseUrl();

private:
  static FString BaseUrl;
};

UCLASS(BlueprintType)
class USomniaEndpointAsync : public UBlueprintAsyncActionBase {
  GENERATED_BODY()
public:
  UPROPERTY(BlueprintAssignable)
  FSomniaEndpointSuccess OnSuccess;

  UPROPERTY(BlueprintAssignable)
  FSomniaEndpointError OnError;

  // Generic caller
  UFUNCTION(BlueprintCallable, Category="SomniaService", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* CallRaw(const FString& Method, const FString& Path, const FString& BodyJson = "");

  // Health/Status/Publisher
  UFUNCTION(BlueprintCallable, Category="SomniaService", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* Health();

  UFUNCTION(BlueprintCallable, Category="SomniaService", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* Status();

  UFUNCTION(BlueprintCallable, Category="SomniaService", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* Publisher();

  // Schemas basic
  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasCompute(const FString& Schema);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasRegister(const FString& Label, const FString& Schema, const FString& ParentSchemaId = TEXT("0x0000000000000000000000000000000000000000000000000000000000000000"), bool IgnoreIfRegistered = true);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasList();

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasGet(const FString& Label);

  // Versioning
  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasRegisterVersion(const FString& Label, const FString& Version, const FString& Schema, const FString& ParentSchemaId = TEXT("0x0000000000000000000000000000000000000000000000000000000000000000"), bool IgnoreIfRegistered = true);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasSetLatest(const FString& Label, const FString& Version);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasVersions(const FString& Label);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasVersion(const FString& Label, const FString& Version);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasDiff(const FString& LeftLabel, const FString& LeftVersion, const FString& LeftSchema,
                                           const FString& RightLabel, const FString& RightVersion, const FString& RightSchema);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasDeprecate(const FString& Label, const FString& Version, bool Deprecated = true);

  // Encode and Publish
  UFUNCTION(BlueprintCallable, Category="SomniaService|Schemas", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SchemasEncode(const FString& Label, const FString& Schema, const FString& ValuesJson, const FString& Version = TEXT(""));

  UFUNCTION(BlueprintCallable, Category="SomniaService|Data", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* DataPublish(const FString& Label, const FString& Schema, const FString& SchemaId, const FString& ValuesJson, const FString& DataId = TEXT(""), const FString& ParentSchemaId = TEXT("0x0000000000000000000000000000000000000000000000000000000000000000"), const FString& Version = TEXT(""), bool AllowDeprecated = false);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Data", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* DataGetByKey(const FString& Label, const FString& SchemaId, const FString& Publisher, const FString& DataId);

  // Subscriptions (HTTP-side creation). Use /ws WebSocket for push data.
  UFUNCTION(BlueprintCallable, Category="SomniaService|Streams", meta=(BlueprintInternalUseOnly="true", AutoCreateRefTerm="Labels"))
  static USomniaEndpointAsync* Subscribe(const FString& EventId, const FString& Context = TEXT("data"), bool OnlyPushChanges = true, bool LatestOnly = false, bool ExcludeDeprecated = false, const TArray<FString>& Labels);

  UFUNCTION(BlueprintCallable, Category="SomniaService|Streams", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* SubscribeSimple(const FString& EventId, const FString& Context = TEXT("data"), bool OnlyPushChanges = true, bool LatestOnly = false, bool ExcludeDeprecated = false);
  UFUNCTION(BlueprintCallable, Category="SomniaService|Streams", meta=(BlueprintInternalUseOnly="true", AutoCreateRefTerm="EthCalls,Labels"))
  static USomniaEndpointAsync* StreamsSubscribe(const FString& EventId, const TArray<FString>& EthCalls, const FString& Context = TEXT("data"), bool OnlyPushChanges = true, bool LatestOnly = false, bool ExcludeDeprecated = false, const TArray<FString>& Labels);
  UFUNCTION(BlueprintCallable, Category="SomniaService|Streams", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* StreamsSubscribeSimple(const FString& EventId, const TArray<FString>& EthCalls, const FString& Context = TEXT("data"), bool OnlyPushChanges = true, bool LatestOnly = false, bool ExcludeDeprecated = false);

  // Test endpoints
  UFUNCTION(BlueprintCallable, Category="SomniaService|Test", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* TestPing();

  UFUNCTION(BlueprintCallable, Category="SomniaService|Test", meta=(BlueprintInternalUseOnly="true"))
  static USomniaEndpointAsync* TestEmit(const FString& DataJson);

  virtual void Activate() override;

  // JSON helpers (public so helpers in .cpp can access)
  static FString QuoteJson(const FString& S);
  static FString RawJson(const FString& Json);

private:
  FString Verb = TEXT("GET");
  FString EndpointPath = TEXT("/");
  FString Body;
};