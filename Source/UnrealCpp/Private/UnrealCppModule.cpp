#include "Modules/ModuleManager.h"

class FUnrealCppModule : public IModuleInterface {
public:
  virtual void StartupModule() override {}
  virtual void ShutdownModule() override {}
};

IMPLEMENT_MODULE(FUnrealCppModule, UnrealCpp);