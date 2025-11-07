using UnrealBuildTool;
using System.Collections.Generic;

public class SDSUnrealTarget : TargetRules
{
    public SDSUnrealTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        // UE 5.6 build settings and include order
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_6;
        CppStandard = CppStandardVersion.Cpp20;

        // Use shared build environment for installed engine
        BuildEnvironment = TargetBuildEnvironment.Shared;
        // Do not override build environment in shared mode
        // bOverrideBuildEnvironment = false;

        // Rely on installed engine defaults and project plugin settings
        // Avoid explicit plugin toggling or global defines that conflict in shared environment

        // Game modules
        ExtraModuleNames.AddRange(new string[] { "UnrealCpp" });
    }
}